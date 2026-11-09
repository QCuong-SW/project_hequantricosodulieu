using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

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

    private static readonly ConcurrentDictionary<string, PackageHandoffResponseDto> HandoffStore = new();

    public Task<PackageHandoffResponseDto> ScanPackageBarcodeAsync(
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
            return Task.FromResult(existingRecord with { IsIdempotentReplay = true });
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
        return Task.FromResult(newRecord);
    }

    public Task<IReadOnlyList<PackageHandoffResponseDto>> GetStationHandoffHistoryAsync(
        Guid stationId, CancellationToken cancellationToken = default)
    {
        var history = HandoffStore.Values
            .Where(h => h.StationId == stationId)
            .OrderByDescending(h => h.ScannedAt)
            .ToList();

        return Task.FromResult<IReadOnlyList<PackageHandoffResponseDto>>(history);
    }
}