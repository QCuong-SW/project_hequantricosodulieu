namespace SmartDroneDelivery.Application.Features.Orders.DTOs;

public class OrderResponseDto
{
    public Guid Id { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal TotalWeightKg { get; set; }
    public decimal ShippingFee { get; set; }
    public string PaymentStatus { get; set; } = string.Empty;
    public string PickupMethod { get; set; } = string.Empty;
    public string DeliveryMethod { get; set; } = string.Empty;
    public DateTime? RequestedDeliveryTime { get; set; }
    public DateTime? EstimatedDeliveryTime { get; set; }
    public DateTime CreatedAt { get; set; }

    public OrderAddressSnapshotDto? AddressSnapshot { get; set; }
    public List<OrderPackageResponseDto> Packages { get; set; } = new();
}

public class OrderAddressSnapshotDto
{
    public string SenderName { get; set; } = string.Empty;
    public string SenderPhone { get; set; } = string.Empty;
    public string SenderAddressText { get; set; } = string.Empty;
    public decimal SenderLatitude { get; set; }
    public decimal SenderLongitude { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string RecipientAddressText { get; set; } = string.Empty;
    public decimal RecipientLatitude { get; set; }
    public decimal RecipientLongitude { get; set; }
}

public class OrderPackageResponseDto
{
    public Guid Id { get; set; }
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
}
