
namespace SmartDroneDelivery.Domain.Entities;

public class CustomerProfile
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string CustomerCode { get; set; } = string.Empty;

    public string? CompanyName { get; set; }

    public int TotalOrders { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<DeliveryAddress> DeliveryAddresses { get; set; }
        = new List<DeliveryAddress>();
}
