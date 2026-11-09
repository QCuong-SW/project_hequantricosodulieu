using SmartDroneDelivery.Domain.Entities.Orders;

namespace SmartDroneDelivery.Application.Features.Orders.Interfaces;

public interface IOrderRepository
{
    Task<DeliveryOrder> AddAsync(DeliveryOrder order, CancellationToken cancellationToken = default);
    Task<DeliveryOrder?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DeliveryOrder?> GetByTrackingNumberAsync(string trackingNumber, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DeliveryOrder>> GetByCustomerIdAsync(Guid customerId, CancellationToken cancellationToken = default);
}
