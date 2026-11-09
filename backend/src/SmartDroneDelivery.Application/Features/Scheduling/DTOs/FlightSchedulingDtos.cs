namespace SmartDroneDelivery.Application.Features.Scheduling.DTOs;

public class ApproveOrderRequest
{
    public Guid OrderId { get; set; }
    public Guid ApprovedByUserId { get; set; }
    public bool IsApproved { get; set; } = true;
    public string? RejectionReason { get; set; }
}

public class AssignFlightScheduleRequest
{
    public Guid OrderId { get; set; }
    public Guid DroneId { get; set; }
    public Guid OriginStationId { get; set; }
    public Guid DestinationStationId { get; set; }
    public Guid? DispatcherId { get; set; }
    public decimal OrderWeightKg { get; set; }
    public decimal FlightDistanceKm { get; set; }
    public DateTime ScheduledDeparture { get; set; }
    public List<FlightWaypointDto> Waypoints { get; set; } = new();
}

public class FlightWaypointDto
{
    public int SequenceOrder { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public decimal TargetAltitudeMeter { get; set; } = 60.0m;
    public decimal EstimatedSpeedKmh { get; set; } = 45.0m;
}

public class DroneStatusDto
{
    public Guid Id { get; set; }
    public string DroneCode { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public decimal MaxPayloadKg { get; set; }
    public decimal MaxFlightRangeKm { get; set; }
    public decimal MaxSpeedKmh { get; set; }
    public int BatteryPercentage { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class FlightScheduleResponseDto
{
    public Guid Id { get; set; }
    public string FlightCode { get; set; } = string.Empty;
    public Guid? OrderId { get; set; }
    public Guid DroneId { get; set; }
    public string DroneCode { get; set; } = string.Empty;
    public Guid OriginStationId { get; set; }
    public Guid DestinationStationId { get; set; }
    public Guid? DispatcherId { get; set; }
    public DateTime ScheduledDeparture { get; set; }
    public DateTime ScheduledArrival { get; set; }
    public decimal FlightDistanceKm { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<FlightWaypointDto> Waypoints { get; set; } = new();
}
