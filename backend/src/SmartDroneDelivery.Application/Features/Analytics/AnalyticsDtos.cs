// backend/src/SmartDroneDelivery.Application/Features/Analytics/AnalyticsDtos.cs
namespace SmartDroneDelivery.Application.Features.Analytics;

/// <summary>1 dòng của view v_station_slot_utilization: mức sử dụng slot của một trạm.</summary>
public class StationUtilizationDto
{
    public Guid StationId { get; set; }
    public string StationCode { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string StationStatus { get; set; } = string.Empty;
    public int DeclaredSlots { get; set; }
    public int ActualSlots { get; set; }
    public int AvailableSlots { get; set; }
    public int OccupiedSlots { get; set; }
    public int ReservedSlots { get; set; }
    public int MaintenanceSlots { get; set; }
    public int UsableSlots { get; set; }
    public int BusySlots { get; set; }
    public int LandingPadSlots { get; set; }
    public int LandingPadBusy { get; set; }
    public decimal UtilizationPercent { get; set; }
}

/// <summary>1 dòng của view v_flight_delivery_performance (chỉ các cột API cần dùng).</summary>
public class FlightPerformanceRow
{
    public string FlightStatus { get; set; } = string.Empty;
    public DateTime ScheduledDeparture { get; set; }
    public int? DepartureDelayMinutes { get; set; }
    public int? ArrivalDelayMinutes { get; set; }
    public decimal FlightDistanceKm { get; set; }
    public decimal? AverageSpeedKmh { get; set; }
    public bool? IsOnTime { get; set; }
}

/// <summary>Thống kê tổng hợp chuyến bay trong một khoảng ngày (dùng cho thẻ KPI).</summary>
public class FlightPerformanceSummaryDto
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public int TotalFlights { get; set; }
    public int CompletedFlights { get; set; }
    public int InProgressFlights { get; set; }
    public int ScheduledFlights { get; set; }
    public int AbortedFlights { get; set; }
    public int ReroutedFlights { get; set; }
    public int OnTimeFlights { get; set; }
    /// <summary>Tỷ lệ đúng giờ (%) trên số chuyến đã hoàn thành.</summary>
    public decimal OnTimeRatePercent { get; set; }
    public double AvgDepartureDelayMinutes { get; set; }
    public double AvgArrivalDelayMinutes { get; set; }
    public decimal TotalDistanceKm { get; set; }
    public decimal AvgSpeedKmh { get; set; }
}

/// <summary>Số liệu chuyến bay theo từng ngày (dùng cho biểu đồ).</summary>
public class DailyFlightStatDto
{
    public DateOnly Date { get; set; }
    public int TotalFlights { get; set; }
    public int CompletedFlights { get; set; }
    public int AbortedFlights { get; set; }
    public int OnTimeFlights { get; set; }
    public decimal TotalDistanceKm { get; set; }
}

/// <summary>Số đơn hàng theo trạng thái.</summary>
public class OrderStatusCountDto
{
    public string Status { get; set; } = string.Empty;
    public int Count { get; set; }
}
