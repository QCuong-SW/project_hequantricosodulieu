namespace SmartDroneDelivery.Domain.Entities.Drones;

public class Drone
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string DroneCode { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public decimal MaxPayloadKg { get; set; }
    public decimal MaxFlightRangeKm { get; set; }
    public decimal MaxSpeedKmh { get; set; }
    public int BatteryPercentage { get; set; } = 100;
    public string Status { get; set; } = "IDLE";
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
