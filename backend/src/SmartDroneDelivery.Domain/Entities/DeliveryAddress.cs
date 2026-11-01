
namespace SmartDroneDelivery.Domain.Entities;

public class DeliveryAddress
{
    public Guid Id { get; set; }

    public Guid CustomerId { get; set; }

    public string AddressLine { get; set; } = string.Empty;

    public string? Ward { get; set; }

    public string? District { get; set; }

    public string City { get; set; } = string.Empty;

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public bool IsDefault { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; }

    public CustomerProfile Customer { get; set; } = null!;
}
