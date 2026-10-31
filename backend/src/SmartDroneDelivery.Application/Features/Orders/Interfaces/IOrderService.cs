using SmartDroneDelivery.Application.Features.Orders.DTOs;

namespace SmartDroneDelivery.Application.Features.Orders.Interfaces;

public interface IOrderService
{
    Task<(OrderResponseDto? Order, List<string> Errors)> CreateOrderAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<OrderResponseDto?> GetOrderByIdAsync(
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OrderResponseDto>> GetCustomerOrdersAsync(
        Guid customerId,
        CancellationToken cancellationToken = default);
}
