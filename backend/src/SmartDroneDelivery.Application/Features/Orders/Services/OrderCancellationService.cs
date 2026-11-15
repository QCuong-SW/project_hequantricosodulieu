using SmartDroneDelivery.Application.Features.Orders.DTOs;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;

namespace SmartDroneDelivery.Application.Features.Orders.Services;

public class OrderCancellationService : IOrderCancellationService
{
    private static readonly HashSet<string> CancellableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "SCHEDULED"
    };

    private static readonly HashSet<string> NonCancellableInFlightStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "IN_TRANSIT",
        "DELIVERING",
        "ARRIVED",
        "DELIVERED"
    };

    private readonly IOrderRepository _orderRepository;

    public OrderCancellationService(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<(OrderCancellationResultDto? Result, List<string> Errors)> CancelOrderAsync(
        CancelOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = new List<string>();

        if (request.OrderId == Guid.Empty)
            errors.Add("OrderId is required.");

        if (string.IsNullOrWhiteSpace(request.CancellationReason) || request.CancellationReason.Length > 500)
            errors.Add("CancellationReason is required and must not exceed 500 characters.");

        if (errors.Count > 0)
            return (null, errors);

        var order = await _orderRepository.GetByIdAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            errors.Add($"Delivery order '{request.OrderId}' was not found.");
            return (null, errors);
        }

        if (request.ExpectedConcurrencyVersion > 0 &&
            order.ConcurrencyVersion != request.ExpectedConcurrencyVersion)
        {
            errors.Add($"Concurrency conflict: expected version {request.ExpectedConcurrencyVersion}, actual version is {order.ConcurrencyVersion}.");
            return (null, errors);
        }

        if (order.Status.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("Order is already cancelled.");
            return (null, errors);
        }

        if (NonCancellableInFlightStatuses.Contains(order.Status))
        {
            errors.Add($"Cannot cancel order in '{order.Status}' status because the drone flight is already in progress or completed.");
            return (null, errors);
        }

        if (!CancellableStatuses.Contains(order.Status))
        {
            errors.Add($"Order in '{order.Status}' status cannot be cancelled.");
            return (null, errors);
        }

        var previousStatus = order.Status;
        var wasScheduled = previousStatus.Equals("SCHEDULED", StringComparison.OrdinalIgnoreCase);

        order.Status = "CANCELLED";
        order.CancellationReason = request.CancellationReason.Trim();
        order.ConcurrencyVersion += 1;
        order.UpdatedAt = DateTime.UtcNow;

        if (order.PaymentStatus.Equals("PAID", StringComparison.OrdinalIgnoreCase))
        {
            order.PaymentStatus = "REFUNDED";
        }

        await _orderRepository.AddAsync(order, cancellationToken);

        return (new OrderCancellationResultDto
        {
            OrderId = order.Id,
            TrackingNumber = order.TrackingNumber,
            PreviousStatus = previousStatus,
            CurrentStatus = order.Status,
            PaymentStatus = order.PaymentStatus,
            CancellationReason = order.CancellationReason,
            DroneReleased = wasScheduled,
            StationSlotReleased = wasScheduled,
            ConcurrencyVersion = order.ConcurrencyVersion,
            UpdatedAt = order.UpdatedAt
        }, errors);
    }

    public async Task<(OrderCancellationResultDto? Result, List<string> Errors)> RejectOrderAsync(
        RejectOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = new List<string>();

        if (request.OrderId == Guid.Empty)
            errors.Add("OrderId is required.");

        if (string.IsNullOrWhiteSpace(request.RejectionReason) || request.RejectionReason.Length > 500)
            errors.Add("RejectionReason is required and must not exceed 500 characters.");

        if (errors.Count > 0)
            return (null, errors);

        var order = await _orderRepository.GetByIdAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            errors.Add($"Delivery order '{request.OrderId}' was not found.");
            return (null, errors);
        }

        if (!order.Status.Equals("PENDING_APPROVAL", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add($"Only orders in 'PENDING_APPROVAL' status can be rejected (current: '{order.Status}').");
            return (null, errors);
        }

        var previousStatus = order.Status;
        order.Status = "REJECTED";
        order.CancellationReason = request.RejectionReason.Trim();
        order.ConcurrencyVersion += 1;
        order.UpdatedAt = DateTime.UtcNow;

        if (order.PaymentStatus.Equals("PAID", StringComparison.OrdinalIgnoreCase))
        {
            order.PaymentStatus = "REFUNDED";
        }

        await _orderRepository.AddAsync(order, cancellationToken);

        return (new OrderCancellationResultDto
        {
            OrderId = order.Id,
            TrackingNumber = order.TrackingNumber,
            PreviousStatus = previousStatus,
            CurrentStatus = order.Status,
            PaymentStatus = order.PaymentStatus,
            CancellationReason = order.CancellationReason,
            DroneReleased = false,
            StationSlotReleased = false,
            ConcurrencyVersion = order.ConcurrencyVersion,
            UpdatedAt = order.UpdatedAt
        }, errors);
    }
}
