namespace SmartDroneDelivery.Domain.Entities.Orders;

public class OrderAddressSnapshot
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
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
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
