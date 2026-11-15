namespace SmartDroneDelivery.Domain.Entities.Orders;

public static class OrderStatusStateMachine
{
    public const string Draft = "DRAFT";
    public const string PendingApproval = "PENDING_APPROVAL";
    public const string Rejected = "REJECTED";
    public const string Approved = "APPROVED";
    public const string Scheduled = "SCHEDULED";
    public const string InTransit = "IN_TRANSIT";
    public const string Delivering = "DELIVERING";
    public const string Arrived = "ARRIVED";
    public const string Delivered = "DELIVERED";
    public const string DeliveryFailed = "DELIVERY_FAILED";
    public const string Cancelled = "CANCELLED";

    private static readonly Dictionary<string, HashSet<string>> AllowedTransitions =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [Draft] = new(StringComparer.OrdinalIgnoreCase)
            {
                PendingApproval, Cancelled
            },
            [PendingApproval] = new(StringComparer.OrdinalIgnoreCase)
            {
                Approved, Rejected, Cancelled
            },
            [Approved] = new(StringComparer.OrdinalIgnoreCase)
            {
                Scheduled, Cancelled
            },
            [Scheduled] = new(StringComparer.OrdinalIgnoreCase)
            {
                InTransit, Cancelled
            },
            [InTransit] = new(StringComparer.OrdinalIgnoreCase)
            {
                Delivering, Arrived, DeliveryFailed
            },
            [Delivering] = new(StringComparer.OrdinalIgnoreCase)
            {
                Arrived, Delivered, DeliveryFailed
            },
            [Arrived] = new(StringComparer.OrdinalIgnoreCase)
            {
                Delivered, DeliveryFailed
            },
            [DeliveryFailed] = new(StringComparer.OrdinalIgnoreCase)
            {
                Scheduled, Cancelled
            },
            [Rejected] = new(StringComparer.OrdinalIgnoreCase),
            [Delivered] = new(StringComparer.OrdinalIgnoreCase),
            [Cancelled] = new(StringComparer.OrdinalIgnoreCase)
        };

    public static bool IsValidStatus(string? status) =>
        !string.IsNullOrWhiteSpace(status) && AllowedTransitions.ContainsKey(status.Trim());

    public static bool CanTransition(string currentStatus, string targetStatus)
    {
        if (string.IsNullOrWhiteSpace(currentStatus) || string.IsNullOrWhiteSpace(targetStatus))
            return false;

        return AllowedTransitions.TryGetValue(currentStatus.Trim(), out var nextStates) &&
               nextStates.Contains(targetStatus.Trim());
    }

    public static IReadOnlyCollection<string> GetAllowedNextStatuses(string currentStatus)
    {
        if (!string.IsNullOrWhiteSpace(currentStatus) &&
            AllowedTransitions.TryGetValue(currentStatus.Trim(), out var nextStates))
        {
            return nextStates.ToList();
        }

        return Array.Empty<string>();
    }
}
