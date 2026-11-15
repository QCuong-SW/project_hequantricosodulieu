namespace SmartDroneDelivery.Application.Features.Orders.DTOs;

public class TransitionOrderStatusRequest
{
    public Guid OrderId { get; set; }
    public string TargetStatus { get; set; } = string.Empty;
    public string TriggeredByModule { get; set; } = "SYSTEM";
    public int? ExpectedConcurrencyVersion { get; set; }
    public string? Reason { get; set; }
}

public class OrderStatusTransitionResponseDto
{
    public Guid OrderId { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public string PreviousStatus { get; set; } = string.Empty;
    public string CurrentStatus { get; set; } = string.Empty;
    public int ConcurrencyVersion { get; set; }
    public DateTime? ActualDeliveryTime { get; set; }
    public DateTime UpdatedAt { get; set; }
    public IReadOnlyCollection<string> AllowedNextStatuses { get; set; } = Array.Empty<string>();
}
