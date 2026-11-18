using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;

namespace SmartDroneDelivery.Application.Features.Stations;

public record ScanPackageHandoffRequestDto(
    Guid StationId,
    Guid OperatorId,
    string PackageBarcode,
    string HandoffAction,
    Guid? DroneId = null,
    string? Notes = null
);

public record PackageHandoffResponseDto(
    Guid HandoffId,
    Guid StationId,
    Guid OperatorId,
    string PackageBarcode,
    string HandoffStatus,
    Guid? DroneId,
    string? Notes,
    DateTime ScannedAt,
    bool IsIdempotentReplay
);

public interface IPackageHandoffService
{
    Task<PackageHandoffResponseDto> ScanPackageBarcodeAsync(
        ScanPackageHandoffRequestDto request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PackageHandoffResponseDto>> GetStationHandoffHistoryAsync(
        Guid stationId, CancellationToken cancellationToken = default);
}

public class PackageHandoffService : IPackageHandoffService
{
    private static readonly HashSet<string> AllowedActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "STATION_RECEIVED",
        "LOADED_ON_DRONE"
    };

    private static readonly ConcurrentDictionary<string, PackageHandoffResponseDto> HandoffStore = SeedDefaultHandoffs();

    private readonly IOrderRepository? _orderRepository;

    public PackageHandoffService(IOrderRepository? orderRepository = null)
    {
        _orderRepository = orderRepository;
    }

    public async Task<PackageHandoffResponseDto> ScanPackageBarcodeAsync(
        ScanPackageHandoffRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request.StationId == Guid.Empty)
            throw new ArgumentException("StationId is required.");

        if (request.OperatorId == Guid.Empty)
            throw new ArgumentException("OperatorId is required.");

        if (string.IsNullOrWhiteSpace(request.PackageBarcode))
            throw new ArgumentException("PackageBarcode cannot be empty.");

        var normalizedBarcode = request.PackageBarcode.Trim().ToUpperInvariant();
        var normalizedAction = (request.HandoffAction ?? string.Empty).Trim().ToUpperInvariant();

        if (!AllowedActions.Contains(normalizedAction))
        {
            throw new ArgumentException(
                "Invalid HandoffAction. Allowed values are STATION_RECEIVED or LOADED_ON_DRONE.");
        }

        if (normalizedAction == "LOADED_ON_DRONE" && (!request.DroneId.HasValue || request.DroneId == Guid.Empty))
        {
            throw new ArgumentException("DroneId is required when status is LOADED_ON_DRONE.");
        }

        // Quy tắc chống ghi nhận trùng sự kiện khi hệ thống gửi lại yêu cầu (Idempotency)
        var deduplicationKey = $"{request.StationId}:{normalizedBarcode}:{normalizedAction}";
        if (HandoffStore.TryGetValue(deduplicationKey, out var existingRecord))
        {
            return existingRecord with { IsIdempotentReplay = true };
        }

        var newRecord = new PackageHandoffResponseDto(
            HandoffId: Guid.NewGuid(),
            StationId: request.StationId,
            OperatorId: request.OperatorId,
            PackageBarcode: normalizedBarcode,
            HandoffStatus: normalizedAction,
            DroneId: request.DroneId,
            Notes: request.Notes?.Trim(),
            ScannedAt: DateTime.UtcNow,
            IsIdempotentReplay: false
        );

        HandoffStore[deduplicationKey] = newRecord;

        if (_orderRepository is not null && normalizedAction == "LOADED_ON_DRONE")
        {
            var order = await _orderRepository.GetByTrackingNumberAsync(normalizedBarcode, cancellationToken);
            if (order is not null && order.Status is not ("DELIVERED" or "CANCELLED" or "REJECTED"))
            {
                order.Status = "IN_TRANSIT";
                order.ConcurrencyVersion += 1;
                order.UpdatedAt = DateTime.UtcNow;
                await _orderRepository.AddAsync(order, cancellationToken);
            }
        }

        return newRecord;
    }

    public Task<IReadOnlyList<PackageHandoffResponseDto>> GetStationHandoffHistoryAsync(
        Guid stationId, CancellationToken cancellationToken = default)
    {
        var history = HandoffStore.Values
            .Where(h => stationId == Guid.Empty || h.StationId == stationId)
            .OrderByDescending(h => h.ScannedAt)
            .ToList();

        if (history.Count == 0)
        {
            history = HandoffStore.Values
                .OrderByDescending(h => h.ScannedAt)
                .ToList();
        }

        return Task.FromResult<IReadOnlyList<PackageHandoffResponseDto>>(history);
    }

    private static ConcurrentDictionary<string, PackageHandoffResponseDto> SeedDefaultHandoffs()
    {
        var dict = new ConcurrentDictionary<string, PackageHandoffResponseDto>();
        var stationId = Guid.Parse("22222222-2222-2222-2222-222222222001");
        var operatorId = Guid.Parse("11111111-1111-1111-1111-111111111003");
        var droneId = Guid.Parse("33333333-3333-3333-3333-333333333001");
        var now = DateTime.UtcNow;

        var r1 = new PackageHandoffResponseDto(
            Guid.NewGuid(), stationId, operatorId, "PKG-2026-0001", "STATION_RECEIVED", null,
            "Kiện hàng nguyên vẹn, đã kiểm tra trọng lượng 1.85 kg", now.AddMinutes(-20), false);
        dict[$"{stationId}:PKG-2026-0001:STATION_RECEIVED"] = r1;

        var r2 = new PackageHandoffResponseDto(
            Guid.NewGuid(), stationId, operatorId, "PKG-2026-0002", "LOADED_ON_DRONE", droneId,
            "Đã khóa ngàm an toàn trên DRN-001", now.AddMinutes(-10), false);
        dict[$"{stationId}:PKG-2026-0002:LOADED_ON_DRONE"] = r2;

        return dict;
    }
}