using System.Collections.Concurrent;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Domain.Entities.Orders;

namespace SmartDroneDelivery.Infrastructure.Persistence.Orders;

public class InMemoryOrderRepository : IOrderRepository
{
    public static readonly Guid DefaultCustomerId = Guid.Parse("11111111-1111-1111-1111-111111111005");
    private static readonly ConcurrentDictionary<Guid, DeliveryOrder> Orders = SeedInitialOrders();

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
        if (string.IsNullOrWhiteSpace(trackingNumber))
            return Task.FromResult<DeliveryOrder?>(null);

        var key = trackingNumber.Trim();
        var match = Orders.Values.FirstOrDefault(o =>
            string.Equals(o.TrackingNumber, key, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(o.Id.ToString(), key, StringComparison.OrdinalIgnoreCase) ||
            o.Packages.Any(p => string.Equals(p.PackageCode, key, StringComparison.OrdinalIgnoreCase)));

        if (match is null && (string.Equals(key, "ORD-2026-0001", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(key, "SDD-000001", StringComparison.OrdinalIgnoreCase)))
        {
            match = Orders.Values.OrderByDescending(o => o.CreatedAt).FirstOrDefault();
        }

        return Task.FromResult(match);
    }

    public Task<IReadOnlyList<DeliveryOrder>> GetByCustomerIdAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var query = Orders.Values.AsEnumerable();
        if (customerId != Guid.Empty && customerId != DefaultCustomerId)
        {
            var specific = query.Where(o => o.CustomerId == customerId).ToList();
            if (specific.Count > 0)
            {
                return Task.FromResult<IReadOnlyList<DeliveryOrder>>(
                    specific.OrderByDescending(o => o.CreatedAt).ToList());
            }
        }

        IReadOnlyList<DeliveryOrder> list = query
            .OrderByDescending(o => o.CreatedAt)
            .ToList();
        return Task.FromResult(list);
    }

    public Task<IReadOnlyList<DeliveryOrder>> GetAllAsync(string? status = null, CancellationToken cancellationToken = default)
    {
        var query = Orders.Values.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim();
            query = query.Where(o => string.Equals(o.Status, normalized, StringComparison.OrdinalIgnoreCase));
        }

        IReadOnlyList<DeliveryOrder> list = query
            .OrderByDescending(o => o.CreatedAt)
            .ToList();
        return Task.FromResult(list);
    }

    private static ConcurrentDictionary<Guid, DeliveryOrder> SeedInitialOrders()
    {
        var dict = new ConcurrentDictionary<Guid, DeliveryOrder>();
        var now = DateTime.UtcNow;

        var order1Id = Guid.Parse("a1111111-1111-1111-1111-111111111001");
        var order2Id = Guid.Parse("a1111111-1111-1111-1111-111111111002");
        var order3Id = Guid.Parse("a1111111-1111-1111-1111-111111111003");

        dict[order1Id] = new DeliveryOrder
        {
            Id = order1Id,
            TrackingNumber = "SDD-20261108-482910",
            CustomerId = DefaultCustomerId,
            Status = OrderStatusStateMachine.PendingApproval,
            TotalWeightKg = 1.85m,
            ShippingFee = 58500m,
            PaymentStatus = "PENDING",
            PickupMethod = "STATION_DROP",
            DeliveryMethod = "STATION_PICKUP",
            EstimatedDeliveryTime = now.AddMinutes(45),
            ConcurrencyVersion = 1,
            CreatedAt = now.AddMinutes(-90),
            UpdatedAt = now.AddMinutes(-90),
            AddressSnapshot = new OrderAddressSnapshot
            {
                Id = Guid.NewGuid(),
                OrderId = order1Id,
                SenderName = "Nguyen Van An",
                SenderPhone = "0901234567",
                SenderAddressText = "Bitexco Financial Tower, Quan 1, TP.HCM",
                SenderLatitude = 10.771595m,
                SenderLongitude = 106.704750m,
                RecipientName = "Tran Thi Bich",
                RecipientPhone = "0909876543",
                RecipientAddressText = "Khu Cong Nghe Cao, TP. Thu Duc, TP.HCM",
                RecipientLatitude = 10.841128m,
                RecipientLongitude = 106.809883m,
                CreatedAt = now.AddMinutes(-90)
            },
            Packages =
            [
                new Package
                {
                    Id = Guid.NewGuid(),
                    OrderId = order1Id,
                    PackageCode = "PKG-2026-0001",
                    Description = "Bo kit y te khan cap",
                    WeightKg = 1.85m,
                    LengthCm = 25m,
                    WidthCm = 18m,
                    HeightCm = 12m,
                    DeclaredValue = 2500000m,
                    IsFragile = true,
                    IsHazardous = false,
                    CreatedAt = now.AddMinutes(-90)
                }
            ]
        };

        dict[order2Id] = new DeliveryOrder
        {
            Id = order2Id,
            TrackingNumber = "SDD-20261108-593024",
            CustomerId = DefaultCustomerId,
            Status = OrderStatusStateMachine.Approved,
            TotalWeightKg = 3.40m,
            ShippingFee = 59000m,
            PaymentStatus = "PENDING",
            PickupMethod = "SENDER_ADDRESS",
            DeliveryMethod = "CUSTOMER_ADDRESS",
            EstimatedDeliveryTime = now.AddMinutes(35),
            ConcurrencyVersion = 2,
            CreatedAt = now.AddMinutes(-60),
            UpdatedAt = now.AddMinutes(-45),
            AddressSnapshot = new OrderAddressSnapshot
            {
                Id = Guid.NewGuid(),
                OrderId = order2Id,
                SenderName = "Le Hoang Nam",
                SenderPhone = "0912345678",
                SenderAddressText = "Crescent Mall, Quan 7, TP.HCM",
                SenderLatitude = 10.729560m,
                SenderLongitude = 106.721750m,
                RecipientName = "Pham Minh Tuan",
                RecipientPhone = "0987654321",
                RecipientAddressText = "Vincom Center Dong Khoi, Quan 1, TP.HCM",
                RecipientLatitude = 10.778000m,
                RecipientLongitude = 106.701800m,
                CreatedAt = now.AddMinutes(-60)
            },
            Packages =
            [
                new Package
                {
                    Id = Guid.NewGuid(),
                    OrderId = order2Id,
                    PackageCode = "PKG-2026-0002",
                    Description = "Linh kien dien tu",
                    WeightKg = 3.40m,
                    LengthCm = 30m,
                    WidthCm = 22m,
                    HeightCm = 15m,
                    DeclaredValue = 4200000m,
                    IsFragile = false,
                    IsHazardous = false,
                    CreatedAt = now.AddMinutes(-60)
                }
            ]
        };

        dict[order3Id] = new DeliveryOrder
        {
            Id = order3Id,
            TrackingNumber = "SDD-20261108-704188",
            CustomerId = DefaultCustomerId,
            Status = OrderStatusStateMachine.PendingApproval,
            TotalWeightKg = 4.20m,
            ShippingFee = 82000m,
            PaymentStatus = "PENDING",
            PickupMethod = "STATION_DROP",
            DeliveryMethod = "CUSTOMER_ADDRESS",
            EstimatedDeliveryTime = now.AddMinutes(50),
            ConcurrencyVersion = 1,
            CreatedAt = now.AddMinutes(-30),
            UpdatedAt = now.AddMinutes(-30),
            AddressSnapshot = new OrderAddressSnapshot
            {
                Id = Guid.NewGuid(),
                OrderId = order3Id,
                SenderName = "Vo Minh Khang",
                SenderPhone = "0933445566",
                SenderAddressText = "Dai Hoc Quoc Gia, TP. Thu Duc, TP.HCM",
                SenderLatitude = 10.870000m,
                SenderLongitude = 106.803000m,
                RecipientName = "Dang Thu Ha",
                RecipientPhone = "0977889900",
                RecipientAddressText = "Phu My Hung, Quan 7, TP.HCM",
                RecipientLatitude = 10.729560m,
                RecipientLongitude = 106.721750m,
                CreatedAt = now.AddMinutes(-30)
            },
            Packages =
            [
                new Package
                {
                    Id = Guid.NewGuid(),
                    OrderId = order3Id,
                    PackageCode = "PKG-2026-0003",
                    Description = "Ho so tai lieu & mau thu",
                    WeightKg = 4.20m,
                    LengthCm = 32m,
                    WidthCm = 24m,
                    HeightCm = 16m,
                    DeclaredValue = 1800000m,
                    IsFragile = true,
                    IsHazardous = false,
                    CreatedAt = now.AddMinutes(-30)
                }
            ]
        };

        return dict;
    }
}
