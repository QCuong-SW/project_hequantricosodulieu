namespace SmartDroneDelivery.Domain.Entities.Orders;

public class DeliveryOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TrackingNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public string Status { get; set; } = "PENDING_APPROVAL";
    public decimal TotalWeightKg { get; set; }
    public decimal ShippingFee { get; set; }
    public string PaymentStatus { get; set; } = "PENDING";
    public string PickupMethod { get; set; } = "SENDER_ADDRESS";
    public string DeliveryMethod { get; set; } = "CUSTOMER_ADDRESS";
    public DateTime? RequestedDeliveryTime { get; set; }
    public DateTime? EstimatedDeliveryTime { get; set; }
    public DateTime? ActualDeliveryTime { get; set; }
    public string? CancellationReason { get; set; }
    public int ConcurrencyVersion { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public OrderAddressSnapshot? AddressSnapshot { get; set; }
    public List<Package> Packages { get; set; } = new();
}
