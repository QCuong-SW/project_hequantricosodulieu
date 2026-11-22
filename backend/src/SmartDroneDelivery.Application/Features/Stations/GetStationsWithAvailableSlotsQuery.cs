using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartDroneDelivery.Application.Features.Stations;

public record GetStationsWithAvailableSlotsQuery(string? SlotType = null, bool OnlyActive = true);
public record UpdateSlotStatusRequest(string Status);

public interface IStationQueryService
{
    Task<IReadOnlyList<LandingStationResponseDto>> GetStationsWithAvailableSlotsAsync(
        GetStationsWithAvailableSlotsQuery query, CancellationToken cancellationToken = default);
    Task<LandingStationResponseDto?> GetStationByIdAsync(
        Guid stationId, CancellationToken cancellationToken = default);
    Task<bool> UpdateSlotStatusAsync(
        Guid stationId, Guid slotId, string status, CancellationToken cancellationToken = default);
}

public class StationQueryService : IStationQueryService
{
    private readonly List<LandingStationResponseDto> _stations;
    public StationQueryService(IEnumerable<LandingStationResponseDto>? stations = null)
    {
        var provided = stations?.ToList();
        _stations = (provided is { Count: > 0 }) ? provided : SeedDefaultStations().ToList();
    }

    public Task<IReadOnlyList<LandingStationResponseDto>> GetStationsWithAvailableSlotsAsync(
        GetStationsWithAvailableSlotsQuery request, CancellationToken cancellationToken = default)
    {
        var query = _stations.AsEnumerable();
        if (request.OnlyActive) query = query.Where(s => s.Status == "ACTIVE");

        query = query.Select(s =>
        {
            var availableSlots = s.AvailableSlots
                .Where(slot => slot.Status == "AVAILABLE" &&
                    (string.IsNullOrWhiteSpace(request.SlotType) || 
                     slot.SlotType.Equals(request.SlotType.Trim(), StringComparison.OrdinalIgnoreCase)))
                .OrderBy(slot => slot.SlotNumber).ToList();

            return s with
            {
                AvailableSlots = s.AvailableSlots, // keep all slots visible for station management
                AvailableSlotsCount = availableSlots.Count,
                AvailableLandingPadsCount = availableSlots.Count(x => x.SlotType == "LANDING_PAD"),
                AvailableChargingDocksCount = availableSlots.Count(x => x.SlotType == "CHARGING_DOCK")
            };
        });

        return Task.FromResult<IReadOnlyList<LandingStationResponseDto>>(query.OrderBy(s => s.StationCode).ToList());
    }

    public Task<LandingStationResponseDto?> GetStationByIdAsync(Guid stationId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(_stations.FirstOrDefault(s => s.Id == stationId));
    }

    public Task<bool> UpdateSlotStatusAsync(Guid stationId, Guid slotId, string status, CancellationToken cancellationToken = default)
    {
        var stationIndex = _stations.FindIndex(s => s.Id == stationId);
        if (stationIndex < 0) return Task.FromResult(false);

        var station = _stations[stationIndex];
        var slotIndex = station.AvailableSlots.ToList().FindIndex(sl => sl.Id == slotId);
        if (slotIndex < 0) return Task.FromResult(false);

        var slotsList = station.AvailableSlots.ToList();
        var existingSlot = slotsList[slotIndex];
        slotsList[slotIndex] = existingSlot with { Status = status, UpdatedAt = DateTime.UtcNow };

        var availableSlots = slotsList.Where(s => s.Status == "AVAILABLE").ToList();
        _stations[stationIndex] = station with
        {
            AvailableSlots = slotsList,
            AvailableSlotsCount = availableSlots.Count,
            AvailableLandingPadsCount = availableSlots.Count(s => s.SlotType == "LANDING_PAD"),
            AvailableChargingDocksCount = availableSlots.Count(s => s.SlotType == "CHARGING_DOCK")
        };

        return Task.FromResult(true);
    }

    private static IReadOnlyList<LandingStationResponseDto> SeedDefaultStations()
    {
        var now = DateTime.UtcNow;
        var stnQ1Id = Guid.Parse("22222222-2222-2222-2222-222222222001");
        var stnTdId = Guid.Parse("22222222-2222-2222-2222-222222222002");
        var stnQ7Id = Guid.Parse("22222222-2222-2222-2222-222222222003");

        return
        [
            BuildStation(stnQ1Id, "STN-Q1", "Trạm Trung Tâm Quận 1", "Khu vực Bến Thành, Quận 1, TP.HCM", 10.771595m, 106.704750m, 5.0m, now, occupiedSlots: 1),
            BuildStation(stnTdId, "STN-TD", "Trạm Khu Công Nghệ Cao Thủ Đức", "Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM", 10.841128m, 106.809883m, 8.0m, now, occupiedSlots: 1),
            BuildStation(stnQ7Id, "STN-Q7", "Trạm Khu Đô Thị Phú Mỹ Hưng Q7", "Khu vực Phú Mỹ Hưng, Quận 7, TP.HCM", 10.729560m, 106.721750m, 4.0m, now, occupiedSlots: 0)
        ];
    }

    private static LandingStationResponseDto BuildStation(
        Guid id, string code, string name, string address, decimal lat, decimal lng, decimal alt, DateTime now, int occupiedSlots)
    {
        var slots = new List<StationSlotResponseDto>
        {
            new(Guid.NewGuid(), id, 1, "LANDING_PAD", occupiedSlots >= 1 ? "OCCUPIED" : "AVAILABLE", now),
            new(Guid.NewGuid(), id, 2, "LANDING_PAD", "AVAILABLE", now),
            new(Guid.NewGuid(), id, 3, "CHARGING_DOCK", "AVAILABLE", now),
            new(Guid.NewGuid(), id, 4, "STORAGE_LOCKER", "AVAILABLE", now),
        };

        var available = slots.Where(s => s.Status == "AVAILABLE").ToList();
        return new LandingStationResponseDto(
            id, code, name, address, lat, lng, alt,
            TotalSlots: 4,
            AvailableSlotsCount: available.Count,
            AvailableLandingPadsCount: available.Count(s => s.SlotType == "LANDING_PAD"),
            AvailableChargingDocksCount: available.Count(s => s.SlotType == "CHARGING_DOCK"),
            Status: "ACTIVE",
            AvailableSlots: slots
        );
    }
}