namespace SmartDroneDelivery.Application.Features.Orders.DTOs;

public class CreateOrderRequest
{
    public Guid CustomerId { get; set; }
    public string PickupMethod { get; set; } = "SENDER_ADDRESS";
    public string DeliveryMethod { get; set; } = "CUSTOMER_ADDRESS";
    public DateTime? RequestedDeliveryTime { get; set; }

    public OrderContactAddressDto Sender { get; set; } = new();
    public OrderContactAddressDto Recipient { get; set; } = new();
    public List<CreateOrderPackageDto> Packages { get; set; } = new();
}

public class OrderContactAddressDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string AddressText { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
}

public class CreateOrderPackageDto
{
    public string Description { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
    public decimal LengthCm { get; set; }
    public decimal WidthCm { get; set; }
    public decimal HeightCm { get; set; }
    public decimal DeclaredValue { get; set; }
    public bool IsFragile { get; set; }
    public bool IsHazardous { get; set; }
    public string? PackagePhotoUrl { get; set; }
}
