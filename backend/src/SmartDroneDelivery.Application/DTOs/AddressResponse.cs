namespace SmartDroneDelivery.Application.DTOs;

public class AddressResponse
{
    public Guid Id { get; set; }

    public string AddressLine { get; set; } = string.Empty;

    public string? Ward { get; set; }

    public string? District { get; set; }

    public string City { get; set; } = string.Empty;

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; }
}
