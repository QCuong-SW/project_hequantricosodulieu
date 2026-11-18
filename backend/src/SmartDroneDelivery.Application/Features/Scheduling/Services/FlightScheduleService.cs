using System.Collections.Concurrent;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Application.Features.Scheduling.DTOs;
using SmartDroneDelivery.Application.Features.Scheduling.Interfaces;
using SmartDroneDelivery.Domain.Entities.Drones;

namespace SmartDroneDelivery.Application.Features.Scheduling.Services;

public class FlightScheduleService : IFlightScheduleService
{
    private const decimal MaxSystemPayloadKg = 5.00m;
    private const int MinimumDispatchBatteryPercent = 30;

    private static readonly ConcurrentDictionary<Guid, Drone> Drones = SeedDefaultDrones();
    private static readonly ConcurrentDictionary<Guid, FlightSchedule> Schedules = SeedDefaultSchedules();
    private static readonly ConcurrentDictionary<Guid, string> OrderApprovalStates = new();

    private readonly IOrderRepository? _orderRepository;

    public FlightScheduleService(IOrderRepository? orderRepository = null)
    {
        _orderRepository = orderRepository;
    }

    public Task<IReadOnlyList<DroneStatusDto>> GetAvailableDronesAsync(
        decimal? requiredPayloadKg = null,
        CancellationToken cancellationToken = default)
    {
        var query = Drones.Values.Where(d => !d.IsDeleted);

        if (requiredPayloadKg.HasValue && requiredPayloadKg.Value > 0)
        {
            query = query.Where(d =>
                d.Status == "IDLE" &&
                d.BatteryPercentage >= MinimumDispatchBatteryPercent &&
                d.MaxPayloadKg >= requiredPayloadKg.Value);
        }

        IReadOnlyList<DroneStatusDto> result = query
            .OrderBy(d => d.DroneCode)
            .Select(MapDroneDto)
            .ToList();

        return Task.FromResult(result);
    }

    public async Task<(bool Success, string Status, List<string> Errors)> ReviewOrderApprovalAsync(
        ApproveOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = new List<string>();

        if (request.OrderId == Guid.Empty)
            errors.Add("OrderId is required.");

        if (!request.IsApproved && string.IsNullOrWhiteSpace(request.RejectionReason))
            errors.Add("RejectionReason is required when rejecting an order.");

        if (errors.Count > 0)
            return (false, string.Empty, errors);

        var newStatus = request.IsApproved ? "APPROVED" : "REJECTED";
        OrderApprovalStates[request.OrderId] = newStatus;

        if (_orderRepository is not null)
        {
            var order = await _orderRepository.GetByIdAsync(request.OrderId, cancellationToken);
            if (order is not null)
            {
                order.Status = newStatus;
                order.ConcurrencyVersion += 1;
                order.UpdatedAt = DateTime.UtcNow;
                if (!request.IsApproved && !string.IsNullOrWhiteSpace(request.RejectionReason))
                    order.CancellationReason = request.RejectionReason.Trim();
                await _orderRepository.AddAsync(order, cancellationToken);
            }
        }

        return (true, newStatus, errors);
    }

    public async Task<(FlightScheduleResponseDto? Schedule, List<string> Errors)> AssignFlightScheduleAsync(
        AssignFlightScheduleRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = ValidateAssignmentRequest(request, out var selectedDrone);
        if (errors.Count > 0 || selectedDrone is null)
            return (null, errors);

        var now = DateTime.UtcNow;
        var scheduleId = Guid.NewGuid();
        var departureTime = request.ScheduledDeparture <= now ? now.AddMinutes(10) : request.ScheduledDeparture;
        var flightHours = (double)(request.FlightDistanceKm / Math.Max(selectedDrone.MaxSpeedKmh, 30m));
        var arrivalTime = departureTime.AddMinutes(Math.Max(15, Math.Ceiling(flightHours * 60) + 5));

        var waypoints = (request.Waypoints ?? new List<FlightWaypointDto>())
            .OrderBy(w => w.SequenceOrder)
            .Select((w, idx) => new FlightWaypoint
            {
                Id = Guid.NewGuid(),
                FlightScheduleId = scheduleId,
                SequenceOrder = w.SequenceOrder > 0 ? w.SequenceOrder : idx + 1,
                Latitude = Math.Round(w.Latitude, 6),
                Longitude = Math.Round(w.Longitude, 6),
                TargetAltitudeMeter = Math.Clamp(w.TargetAltitudeMeter, 10m, 120m),
                EstimatedSpeedKmh = w.EstimatedSpeedKmh > 0 ? w.EstimatedSpeedKmh : 45m
            })
            .ToList();

        var schedule = new FlightSchedule
        {
            Id = scheduleId,
            FlightCode = $"FLT-{now:yyyyMMdd}-{Random.Shared.Next(100000, 999999)}",
            OrderId = request.OrderId,
            DroneId = selectedDrone.Id,
            OriginStationId = request.OriginStationId,
            DestinationStationId = request.DestinationStationId,
            DispatcherId = request.DispatcherId,
            ScheduledDeparture = departureTime,
            ScheduledArrival = arrivalTime,
            FlightDistanceKm = Math.Round(request.FlightDistanceKm, 2),
            Status = "SCHEDULED",
            CreatedAt = now,
            Waypoints = waypoints
        };

        selectedDrone.Status = "ASSIGNED";
        Schedules[schedule.Id] = schedule;
        OrderApprovalStates[request.OrderId] = "SCHEDULED";

        if (_orderRepository is not null)
        {
            var order = await _orderRepository.GetByIdAsync(request.OrderId, cancellationToken);
            if (order is not null)
            {
                order.Status = "SCHEDULED";
                order.ConcurrencyVersion += 1;
                order.UpdatedAt = now;
                await _orderRepository.AddAsync(order, cancellationToken);
            }
        }

        return (MapScheduleDto(schedule, selectedDrone.DroneCode), new List<string>());
    }

    public Task<IReadOnlyList<FlightScheduleResponseDto>> GetFlightSchedulesAsync(
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<FlightScheduleResponseDto> list = Schedules.Values
            .OrderByDescending(s => s.CreatedAt)
            .Select(s =>
            {
                var droneCode = Drones.TryGetValue(s.DroneId, out var d) ? d.DroneCode : string.Empty;
                return MapScheduleDto(s, droneCode);
            })
            .ToList();

        return Task.FromResult(list);
    }

    private static List<string> ValidateAssignmentRequest(
        AssignFlightScheduleRequest? request,
        out Drone? drone)
    {
        var errors = new List<string>();
        drone = null;

        if (request is null)
        {
            errors.Add("Request payload cannot be null.");
            return errors;
        }

        if (request.OrderId == Guid.Empty)
            errors.Add("OrderId is required.");

        if (request.OriginStationId == Guid.Empty || request.DestinationStationId == Guid.Empty)
            errors.Add("OriginStationId and DestinationStationId are required.");
        else if (request.OriginStationId == request.DestinationStationId)
            errors.Add("OriginStationId and DestinationStationId must be different stations.");

        if (request.OrderWeightKg <= 0 || request.OrderWeightKg > MaxSystemPayloadKg)
            errors.Add($"OrderWeightKg must be between 0.01 and {MaxSystemPayloadKg} kg.");

        if (request.FlightDistanceKm <= 0)
            errors.Add("FlightDistanceKm must be greater than 0.");

        if (!Drones.TryGetValue(request.DroneId, out drone) || drone.IsDeleted)
        {
            errors.Add("Selected drone was not found.");
            return errors;
        }

        if (drone.Status != "IDLE")
            errors.Add($"Drone '{drone.DroneCode}' is currently '{drone.Status}' and not available for dispatch.");

        if (drone.BatteryPercentage < MinimumDispatchBatteryPercent)
            errors.Add($"Drone '{drone.DroneCode}' battery ({drone.BatteryPercentage}%) is below minimum dispatch threshold ({MinimumDispatchBatteryPercent}%).");

        if (request.OrderWeightKg > drone.MaxPayloadKg)
            errors.Add($"Order weight ({request.OrderWeightKg} kg) exceeds drone '{drone.DroneCode}' max payload ({drone.MaxPayloadKg} kg).");

        if (request.FlightDistanceKm > drone.MaxFlightRangeKm)
            errors.Add($"Flight distance ({request.FlightDistanceKm} km) exceeds drone '{drone.DroneCode}' max range ({drone.MaxFlightRangeKm} km).");

        return errors;
    }

    private static DroneStatusDto MapDroneDto(Drone d) => new()
    {
        Id = d.Id,
        DroneCode = d.DroneCode,
        Model = d.Model,
        MaxPayloadKg = d.MaxPayloadKg,
        MaxFlightRangeKm = d.MaxFlightRangeKm,
        MaxSpeedKmh = d.MaxSpeedKmh,
        BatteryPercentage = d.BatteryPercentage,
        Status = d.Status
    };

    private static FlightScheduleResponseDto MapScheduleDto(FlightSchedule s, string droneCode) => new()
    {
        Id = s.Id,
        FlightCode = s.FlightCode,
        OrderId = s.OrderId,
        DroneId = s.DroneId,
        DroneCode = droneCode,
        OriginStationId = s.OriginStationId,
        DestinationStationId = s.DestinationStationId,
        DispatcherId = s.DispatcherId,
        ScheduledDeparture = s.ScheduledDeparture,
        ScheduledArrival = s.ScheduledArrival,
        FlightDistanceKm = s.FlightDistanceKm,
        Status = s.Status,
        CreatedAt = s.CreatedAt,
        Waypoints = s.Waypoints.Select(w => new FlightWaypointDto
        {
            SequenceOrder = w.SequenceOrder,
            Latitude = w.Latitude,
            Longitude = w.Longitude,
            TargetAltitudeMeter = w.TargetAltitudeMeter,
            EstimatedSpeedKmh = w.EstimatedSpeedKmh
        }).ToList()
    };

    private static ConcurrentDictionary<Guid, Drone> SeedDefaultDrones()
    {
        var dict = new ConcurrentDictionary<Guid, Drone>();
        var defaults = new[]
        {
            new Drone
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333001"),
                DroneCode = "DRN-001",
                Model = "DJI FlyCart 30 Lite",
                MaxPayloadKg = 5.00m,
                MaxFlightRangeKm = 25.00m,
                MaxSpeedKmh = 60.00m,
                BatteryPercentage = 95,
                Status = "IDLE"
            },
            new Drone
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333002"),
                DroneCode = "DRN-002",
                Model = "Matrice 350 Delivery",
                MaxPayloadKg = 3.50m,
                MaxFlightRangeKm = 20.00m,
                MaxSpeedKmh = 55.00m,
                BatteryPercentage = 88,
                Status = "IDLE"
            },
            new Drone
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333003"),
                DroneCode = "DRN-003",
                Model = "Wingcopter 198 Urban",
                MaxPayloadKg = 4.50m,
                MaxFlightRangeKm = 30.00m,
                MaxSpeedKmh = 65.00m,
                BatteryPercentage = 92,
                Status = "IDLE"
            }
        };

        foreach (var d in defaults)
            dict[d.Id] = d;

        return dict;
    }

    private static ConcurrentDictionary<Guid, FlightSchedule> SeedDefaultSchedules()
    {
        var dict = new ConcurrentDictionary<Guid, FlightSchedule>();
        var now = DateTime.UtcNow;

        var sampleFlights = new[]
        {
            new FlightSchedule
            {
                Id = Guid.Parse("77777777-7777-7777-7777-777777777001"),
                FlightCode = "FLT-20261116-101001",
                OrderId = Guid.Parse("a1111111-1111-1111-1111-111111111001"),
                DroneId = Guid.Parse("33333333-3333-3333-3333-333333333001"),
                OriginStationId = Guid.Parse("22222222-2222-2222-2222-222222222001"),
                DestinationStationId = Guid.Parse("22222222-2222-2222-2222-222222222002"),
                ScheduledDeparture = now.AddDays(-2),
                ActualDeparture = now.AddDays(-2).AddMinutes(2),
                ScheduledArrival = now.AddDays(-2).AddMinutes(22),
                ActualArrival = now.AddDays(-2).AddMinutes(24),
                FlightDistanceKm = 12.50m,
                Status = "COMPLETED",
                CreatedAt = now.AddDays(-2).AddMinutes(-15)
            },
            new FlightSchedule
            {
                Id = Guid.Parse("77777777-7777-7777-7777-777777777002"),
                FlightCode = "FLT-20261117-101002",
                OrderId = Guid.Parse("a1111111-1111-1111-1111-111111111002"),
                DroneId = Guid.Parse("33333333-3333-3333-3333-333333333002"),
                OriginStationId = Guid.Parse("22222222-2222-2222-2222-222222222003"),
                DestinationStationId = Guid.Parse("22222222-2222-2222-2222-222222222001"),
                ScheduledDeparture = now.AddDays(-1),
                ActualDeparture = now.AddDays(-1).AddMinutes(1),
                ScheduledArrival = now.AddDays(-1).AddMinutes(18),
                ActualArrival = now.AddDays(-1).AddMinutes(17),
                FlightDistanceKm = 8.40m,
                Status = "COMPLETED",
                CreatedAt = now.AddDays(-1).AddMinutes(-20)
            },
            new FlightSchedule
            {
                Id = Guid.Parse("77777777-7777-7777-7777-777777777003"),
                FlightCode = "FLT-20261118-101003",
                OrderId = Guid.Parse("a1111111-1111-1111-1111-111111111003"),
                DroneId = Guid.Parse("33333333-3333-3333-3333-333333333003"),
                OriginStationId = Guid.Parse("22222222-2222-2222-2222-222222222002"),
                DestinationStationId = Guid.Parse("22222222-2222-2222-2222-222222222003"),
                ScheduledDeparture = now.AddMinutes(-10),
                ActualDeparture = now.AddMinutes(-8),
                ScheduledArrival = now.AddMinutes(15),
                FlightDistanceKm = 14.20m,
                Status = "IN_PROGRESS",
                CreatedAt = now.AddMinutes(-25)
            }
        };

        foreach (var f in sampleFlights)
            dict[f.Id] = f;

        return dict;
    }
}
