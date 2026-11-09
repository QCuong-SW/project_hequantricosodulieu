using System.Collections.Concurrent;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Domain.Entities.Orders;

namespace SmartDroneDelivery.Infrastructure.Persistence.Orders;

public class InMemoryOrderRepository : IOrderRepository
{
    private static readonly ConcurrentDictionary<Guid, DeliveryOrder> Orders = new();

    public Task<DeliveryOrder> AddAsync(DeliveryOrder order, CancellationToken cancellationToken = default)
    {
        Orders[order.Id] = order;
        return Task.FromResult(order);
    }

    public Task<DeliveryOrder?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        Orders.TryGetValue(id, out var order);
        return Task.FromResult(order);
    }

    public Task<DeliveryOrder?> GetByTrackingNumberAsync(string trackingNumber, CancellationToken cancellationToken = default)
    {
        var match = Orders.Values.FirstOrDefault(
            o => string.Equals(o.TrackingNumber, trackingNumber, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(match);
    }

    public Task<IReadOnlyList<DeliveryOrder>> GetByCustomerIdAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<DeliveryOrder> list = Orders.Values
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.CreatedAt)
            .ToList();
        return Task.FromResult(list);
    }
}
