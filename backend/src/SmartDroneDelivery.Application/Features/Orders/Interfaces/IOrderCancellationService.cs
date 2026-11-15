using SmartDroneDelivery.Application.Features.Orders.DTOs;

namespace SmartDroneDelivery.Application.Features.Orders.Interfaces;

public interface IOrderCancellationService
{
    Task<(OrderCancellationResultDto? Result, List<string> Errors)> CancelOrderAsync(
        CancelOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<(OrderCancellationResultDto? Result, List<string> Errors)> RejectOrderAsync(
        RejectOrderRequest request,
        CancellationToken cancellationToken = default);
}
