using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartDroneDelivery.Application.Features.Stations;

public record GetStationsWithAvailableSlotsQuery(string? SlotType = null, bool OnlyActive = true);

public interface IStationQueryService
{
    Task<IReadOnlyList<LandingStationResponseDto>> GetStationsWithAvailableSlotsAsync(
        GetStationsWithAvailableSlotsQuery query, CancellationToken cancellationToken = default);
    Task<LandingStationResponseDto?> GetStationByIdAsync(
        Guid stationId, CancellationToken cancellationToken = default);
}

public class StationQueryService : IStationQueryService
{
    private readonly IEnumerable<LandingStationResponseDto> _stations;
    public StationQueryService(IEnumerable<LandingStationResponseDto>? stations = null)
    {
        _stations = stations ?? Array.Empty<LandingStationResponseDto>();
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
                AvailableSlots = availableSlots,
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
}