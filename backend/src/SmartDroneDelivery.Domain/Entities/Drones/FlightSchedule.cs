namespace SmartDroneDelivery.Domain.Entities.Drones;

public class FlightSchedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FlightCode { get; set; } = string.Empty;
    public Guid? OrderId { get; set; }
    public Guid DroneId { get; set; }
    public Guid OriginStationId { get; set; }
    public Guid DestinationStationId { get; set; }
    public Guid? DispatcherId { get; set; }
    public DateTime ScheduledDeparture { get; set; }
    public DateTime? ActualDeparture { get; set; }
    public DateTime ScheduledArrival { get; set; }
    public DateTime? ActualArrival { get; set; }
    public decimal FlightDistanceKm { get; set; }
    public string Status { get; set; } = "SCHEDULED";
    public string? AbortReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<FlightWaypoint> Waypoints { get; set; } = new();
}
