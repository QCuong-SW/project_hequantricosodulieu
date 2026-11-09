using SmartDroneDelivery.Application.Features.Orders.DTOs;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Application.Features.Orders.Validators;
using SmartDroneDelivery.Domain.Entities.Orders;

namespace SmartDroneDelivery.Application.Features.Orders.Services;

public class OrderService : IOrderService
{
    private const decimal BaseFeeVnd = 25000m;
    private const decimal FeePerKgVnd = 10000m;
    private const decimal FragileSurchargeVnd = 15000m;

    private readonly IOrderRepository _orderRepository;

    public OrderService(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<(OrderResponseDto? Order, List<string> Errors)> CreateOrderAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = CreateOrderRequestValidator.Validate(request);
        if (errors.Count > 0)
            return (null, errors);

        var now = DateTime.UtcNow;
        var orderId = Guid.NewGuid();
        var totalWeightKg = Math.Round(request.Packages.Sum(p => p.WeightKg), 2);
        var hasFragilePackage = request.Packages.Any(p => p.IsFragile);
        var shippingFee = CalculateShippingFee(totalWeightKg, hasFragilePackage);

        var snapshot = new OrderAddressSnapshot
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            SenderName = request.Sender.Name.Trim(),
            SenderPhone = request.Sender.Phone.Trim(),
            SenderAddressText = request.Sender.AddressText.Trim(),
            SenderLatitude = Math.Round(request.Sender.Latitude, 6),
            SenderLongitude = Math.Round(request.Sender.Longitude, 6),
            RecipientName = request.Recipient.Name.Trim(),
            RecipientPhone = request.Recipient.Phone.Trim(),
            RecipientAddressText = request.Recipient.AddressText.Trim(),
            RecipientLatitude = Math.Round(request.Recipient.Latitude, 6),
            RecipientLongitude = Math.Round(request.Recipient.Longitude, 6),
            CreatedAt = now
        };

        var packages = request.Packages.Select((pkg, index) => new Package
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            PackageCode = GeneratePackageCode(now, index + 1),
            Description = pkg.Description.Trim(),
            WeightKg = Math.Round(pkg.WeightKg, 2),
            LengthCm = Math.Round(pkg.LengthCm, 2),
            WidthCm = Math.Round(pkg.WidthCm, 2),
            HeightCm = Math.Round(pkg.HeightCm, 2),
            DeclaredValue = Math.Round(pkg.DeclaredValue, 2),
            IsFragile = pkg.IsFragile,
            IsHazardous = pkg.IsHazardous,
            PackagePhotoUrl = pkg.PackagePhotoUrl?.Trim(),
            CreatedAt = now
        }).ToList();

        var order = new DeliveryOrder
        {
            Id = orderId,
            TrackingNumber = GenerateTrackingNumber(now),
            CustomerId = request.CustomerId,
            Status = "PENDING_APPROVAL",
            TotalWeightKg = totalWeightKg,
            ShippingFee = shippingFee,
            PaymentStatus = "PENDING",
            PickupMethod = request.PickupMethod.ToUpperInvariant(),
            DeliveryMethod = request.DeliveryMethod.ToUpperInvariant(),
            RequestedDeliveryTime = request.RequestedDeliveryTime,
            EstimatedDeliveryTime = request.RequestedDeliveryTime ?? now.AddMinutes(45),
            ConcurrencyVersion = 1,
            CreatedAt = now,
            UpdatedAt = now,
            AddressSnapshot = snapshot,
            Packages = packages
        };

        var savedOrder = await _orderRepository.AddAsync(order, cancellationToken);
        return (MapToResponseDto(savedOrder), new List<string>());
    }

    public async Task<OrderResponseDto?> GetOrderByIdAsync(
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(orderId, cancellationToken);
        return order is null ? null : MapToResponseDto(order);
    }

    public async Task<IReadOnlyList<OrderResponseDto>> GetCustomerOrdersAsync(
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.GetByCustomerIdAsync(customerId, cancellationToken);
        return orders.Select(MapToResponseDto).ToList();
    }

    private static decimal CalculateShippingFee(decimal totalWeightKg, bool hasFragilePackage)
    {
        var fee = BaseFeeVnd + (totalWeightKg * FeePerKgVnd);
        if (hasFragilePackage)
            fee += FragileSurchargeVnd;
        return Math.Round(fee, 2);
    }

    private static string GenerateTrackingNumber(DateTime timestamp)
    {
        var suffix = Random.Shared.Next(100000, 999999);
        return $"SDD-{timestamp:yyyyMMdd}-{suffix}";
    }

    private static string GeneratePackageCode(DateTime timestamp, int index)
    {
        var suffix = Random.Shared.Next(1000, 9999);
        return $"PKG-{timestamp:MMdd}-{index:D2}-{suffix}";
    }

    private static OrderResponseDto MapToResponseDto(DeliveryOrder order)
    {
        return new OrderResponseDto
        {
            Id = order.Id,
            TrackingNumber = order.TrackingNumber,
            CustomerId = order.CustomerId,
            Status = order.Status,
            TotalWeightKg = order.TotalWeightKg,
            ShippingFee = order.ShippingFee,
            PaymentStatus = order.PaymentStatus,
            PickupMethod = order.PickupMethod,
            DeliveryMethod = order.DeliveryMethod,
            RequestedDeliveryTime = order.RequestedDeliveryTime,
            EstimatedDeliveryTime = order.EstimatedDeliveryTime,
            CreatedAt = order.CreatedAt,
            AddressSnapshot = order.AddressSnapshot is null
                ? null
                : new OrderAddressSnapshotDto
                {
                    SenderName = order.AddressSnapshot.SenderName,
                    SenderPhone = order.AddressSnapshot.SenderPhone,
                    SenderAddressText = order.AddressSnapshot.SenderAddressText,
                    SenderLatitude = order.AddressSnapshot.SenderLatitude,
                    SenderLongitude = order.AddressSnapshot.SenderLongitude,
                    RecipientName = order.AddressSnapshot.RecipientName,
                    RecipientPhone = order.AddressSnapshot.RecipientPhone,
                    RecipientAddressText = order.AddressSnapshot.RecipientAddressText,
                    RecipientLatitude = order.AddressSnapshot.RecipientLatitude,
                    RecipientLongitude = order.AddressSnapshot.RecipientLongitude
                },
            Packages = order.Packages.Select(p => new OrderPackageResponseDto
            {
                Id = p.Id,
                PackageCode = p.PackageCode,
                Description = p.Description,
                WeightKg = p.WeightKg,
                LengthCm = p.LengthCm,
                WidthCm = p.WidthCm,
                HeightCm = p.HeightCm,
                DeclaredValue = p.DeclaredValue,
                IsFragile = p.IsFragile,
                IsHazardous = p.IsHazardous,
                PackagePhotoUrl = p.PackagePhotoUrl
            }).ToList()
        };
    }
}
