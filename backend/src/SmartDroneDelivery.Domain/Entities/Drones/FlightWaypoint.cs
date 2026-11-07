namespace SmartDroneDelivery.Domain.Entities.Drones;

public class FlightWaypoint
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FlightScheduleId { get; set; }
    public int SequenceOrder { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public decimal TargetAltitudeMeter { get; set; } = 60.0m;
    public decimal EstimatedSpeedKmh { get; set; } = 45.0m;
}
