namespace SmartDroneDelivery.Domain.Entities.Orders;

public class Package
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public string PackageCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
    public decimal LengthCm { get; set; }
    public decimal WidthCm { get; set; }
    public decimal HeightCm { get; set; }
    public decimal DeclaredValue { get; set; }
    public bool IsFragile { get; set; }
    public bool IsHazardous { get; set; }
    public string? PackagePhotoUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
