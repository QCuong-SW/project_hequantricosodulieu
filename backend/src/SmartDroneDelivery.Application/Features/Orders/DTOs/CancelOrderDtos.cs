namespace SmartDroneDelivery.Application.Features.Orders.DTOs;

public class CancelOrderRequest
{
    public Guid OrderId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public string RequestedByRole { get; set; } = "CUSTOMER";
    public string CancellationReason { get; set; } = string.Empty;
    public int ExpectedConcurrencyVersion { get; set; } = 1;
}

public class RejectOrderRequest
{
    public Guid OrderId { get; set; }
    public Guid ReviewedByUserId { get; set; }
    public string RejectionReason { get; set; } = string.Empty;
    public int ExpectedConcurrencyVersion { get; set; } = 1;
}

public class OrderCancellationResultDto
{
    public Guid OrderId { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public string PreviousStatus { get; set; } = string.Empty;
    public string CurrentStatus { get; set; } = string.Empty;
    public string PaymentStatus { get; set; } = string.Empty;
    public string? CancellationReason { get; set; }
    public bool DroneReleased { get; set; }
    public bool StationSlotReleased { get; set; }
    public int ConcurrencyVersion { get; set; }
    public DateTime UpdatedAt { get; set; }
}
