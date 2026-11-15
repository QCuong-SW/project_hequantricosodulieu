// backend/src/SmartDroneDelivery.Api/Controllers/AnalyticsController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Features.Analytics;
using SmartDroneDelivery.Infrastructure.Persistence;

namespace SmartDroneDelivery.Api.Controllers;

/// <summary>
/// API thống kê cơ bản cho Logistics Manager / Admin.
/// Đọc dữ liệu từ 2 SQL View (v_station_slot_utilization, v_flight_delivery_performance)
/// bằng SqlQueryRaw nên không cần sửa SmartDroneDbContext.
/// </summary>
[ApiController]
[Route("api/analytics")]
[Authorize(Roles = "LOGISTICS_MANAGER,ADMIN")]
public class AnalyticsController : ControllerBase
{
    private const int DefaultRangeDays = 30;
    private const int MaxRangeDays = 366;

    private readonly SmartDroneDbContext _db;

    public AnalyticsController(SmartDroneDbContext db)
    {
        _db = db;
    }

    /// <summary>Mức sử dụng slot của từng trạm, sắp xếp từ cao xuống thấp.</summary>
    [HttpGet("stations/utilization")]
    [ProducesResponseType(typeof(IReadOnlyList<StationUtilizationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<StationUtilizationDto>>> GetStationUtilization(
        CancellationToken ct)
    {
        var rows = await _db.Database
            .SqlQueryRaw<StationUtilizationDto>(@"
                SELECT station_id          AS StationId,
                       station_code        AS StationCode,
                       station_name        AS StationName,
                       station_status      AS StationStatus,
                       declared_slots      AS DeclaredSlots,
                       actual_slots        AS ActualSlots,
                       available_slots     AS AvailableSlots,
                       occupied_slots      AS OccupiedSlots,
                       reserved_slots      AS ReservedSlots,
                       maintenance_slots   AS MaintenanceSlots,
                       usable_slots        AS UsableSlots,
                       busy_slots          AS BusySlots,
                       landing_pad_slots   AS LandingPadSlots,
                       landing_pad_busy    AS LandingPadBusy,
                       utilization_percent AS UtilizationPercent
                FROM dbo.v_station_slot_utilization")
            .OrderByDescending(x => x.UtilizationPercent)
            .ThenBy(x => x.StationCode)
            .ToListAsync(ct);

        return Ok(rows);
    }

    /// <summary>
    /// Thống kê tổng hợp chuyến bay theo ngày khởi hành kế hoạch.
    /// Mặc định 30 ngày gần nhất; tối đa 366 ngày.
    /// </summary>
    [HttpGet("flights/summary")]
    [ProducesResponseType(typeof(FlightPerformanceSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<FlightPerformanceSummaryDto>> GetFlightSummary(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        if (!TryResolveRange(from, to, out var fromDay, out var toDay, out var error))
            return Problem(detail: error, statusCode: StatusCodes.Status400BadRequest);

        var rows = await QueryFlightRows(fromDay, toDay, ct);

        var completed = rows.Count(r => r.FlightStatus == "COMPLETED");
        var onTime = rows.Count(r => r.IsOnTime == true);

        return Ok(new FlightPerformanceSummaryDto
        {
            From = fromDay,
            To = toDay,
            TotalFlights = rows.Count,
            CompletedFlights = completed,
            InProgressFlights = rows.Count(r => r.FlightStatus == "IN_PROGRESS"),
            ScheduledFlights = rows.Count(r => r.FlightStatus == "SCHEDULED"),
            AbortedFlights = rows.Count(r => r.FlightStatus == "ABORTED"),
            ReroutedFlights = rows.Count(r => r.FlightStatus == "REROUTED"),
            OnTimeFlights = onTime,
            OnTimeRatePercent = completed == 0 ? 0m : Math.Round(100m * onTime / completed, 2),
            AvgDepartureDelayMinutes = Math.Round(AverageOrZero(
                rows.Where(r => r.DepartureDelayMinutes.HasValue)
                    .Select(r => (double)r.DepartureDelayMinutes!.Value)), 2),
            AvgArrivalDelayMinutes = Math.Round(AverageOrZero(
                rows.Where(r => r.ArrivalDelayMinutes.HasValue)
                    .Select(r => (double)r.ArrivalDelayMinutes!.Value)), 2),
            TotalDistanceKm = rows.Sum(r => r.FlightDistanceKm),
            AvgSpeedKmh = Math.Round((decimal)AverageOrZero(
                rows.Where(r => r.AverageSpeedKmh.HasValue)
                    .Select(r => (double)r.AverageSpeedKmh!.Value)), 2)
        });
    }

    /// <summary>Số chuyến bay theo từng ngày trong khoảng (có điền ngày trống = 0 để vẽ biểu đồ liền mạch).</summary>
    [HttpGet("flights/daily")]
    [ProducesResponseType(typeof(IReadOnlyList<DailyFlightStatDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<DailyFlightStatDto>>> GetFlightDaily(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        if (!TryResolveRange(from, to, out var fromDay, out var toDay, out var error))
            return Problem(detail: error, statusCode: StatusCodes.Status400BadRequest);

        var rows = await QueryFlightRows(fromDay, toDay, ct);
        var byDay = rows
            .GroupBy(r => DateOnly.FromDateTime(r.ScheduledDeparture))
            .ToDictionary(g => g.Key);

        var result = new List<DailyFlightStatDto>();
        for (var day = fromDay; day <= toDay; day = day.AddDays(1))
        {
            if (byDay.TryGetValue(day, out var g))
            {
                result.Add(new DailyFlightStatDto
                {
                    Date = day,
                    TotalFlights = g.Count(),
                    CompletedFlights = g.Count(r => r.FlightStatus == "COMPLETED"),
                    AbortedFlights = g.Count(r => r.FlightStatus == "ABORTED"),
                    OnTimeFlights = g.Count(r => r.IsOnTime == true),
                    TotalDistanceKm = g.Sum(r => r.FlightDistanceKm)
                });
            }
            else
            {
                result.Add(new DailyFlightStatDto { Date = day });
            }
        }

        return Ok(result);
    }

    /// <summary>Số đơn hàng theo từng trạng thái (cho thẻ KPI trên Dashboard).</summary>
    [HttpGet("orders/status-summary")]
    [ProducesResponseType(typeof(IReadOnlyList<OrderStatusCountDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<OrderStatusCountDto>>> GetOrderStatusSummary(
        CancellationToken ct)
    {
        var rows = await _db.Database
            .SqlQueryRaw<OrderStatusCountDto>(
                "SELECT status AS Status, COUNT(*) AS Count FROM dbo.delivery_orders GROUP BY status")
            .OrderBy(x => x.Status)
            .ToListAsync(ct);

        return Ok(rows);
    }

    // ---------------------------------------------------------------------------------------
    // Hàm phụ
    // ---------------------------------------------------------------------------------------

    private async Task<List<FlightPerformanceRow>> QueryFlightRows(
        DateOnly fromDay, DateOnly toDay, CancellationToken ct)
    {
        var start = fromDay.ToDateTime(TimeOnly.MinValue);
        var endExclusive = toDay.AddDays(1).ToDateTime(TimeOnly.MinValue);

        return await _db.Database
            .SqlQueryRaw<FlightPerformanceRow>(@"
                SELECT flight_status           AS FlightStatus,
                       scheduled_departure     AS ScheduledDeparture,
                       departure_delay_minutes AS DepartureDelayMinutes,
                       arrival_delay_minutes   AS ArrivalDelayMinutes,
                       flight_distance_km      AS FlightDistanceKm,
                       average_speed_kmh       AS AverageSpeedKmh,
                       is_on_time              AS IsOnTime
                FROM dbo.v_flight_delivery_performance")
            .Where(r => r.ScheduledDeparture >= start && r.ScheduledDeparture < endExclusive)
            .ToListAsync(ct);
    }

    /// <summary>Mặc định 30 ngày gần nhất; kiểm tra from &lt;= to và khoảng tối đa 366 ngày.</summary>
    private static bool TryResolveRange(
        DateOnly? from, DateOnly? to, out DateOnly fromDay, out DateOnly toDay, out string? error)
    {
        toDay = to ?? DateOnly.FromDateTime(DateTime.Now);
        fromDay = from ?? toDay.AddDays(-(DefaultRangeDays - 1));
        error = null;

        if (fromDay > toDay)
        {
            error = "Tham số 'from' phải nhỏ hơn hoặc bằng 'to'.";
            return false;
        }

        if (toDay.DayNumber - fromDay.DayNumber >= MaxRangeDays)
        {
            error = $"Khoảng thời gian tối đa là {MaxRangeDays} ngày.";
            return false;
        }

        return true;
    }

    private static double AverageOrZero(IEnumerable<double> values)
    {
        var list = values.ToList();
        return list.Count == 0 ? 0 : list.Average();
    }
}
