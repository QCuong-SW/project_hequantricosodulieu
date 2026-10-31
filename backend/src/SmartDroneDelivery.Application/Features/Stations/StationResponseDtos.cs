using System;
using System.Collections.Generic;

namespace SmartDroneDelivery.Application.Features.Stations;

public record StationSlotResponseDto(
    Guid Id,
    Guid StationId,
    int SlotNumber,
    string SlotType,
    string Status,
    DateTime UpdatedAt
);

public record LandingStationResponseDto(
    Guid Id,
    string StationCode,
    string Name,
    string AddressLine,
    decimal Latitude,
    decimal Longitude,
    decimal AltitudeMeter,
    int TotalSlots,
    int AvailableSlotsCount,
    int AvailableLandingPadsCount,
    int AvailableChargingDocksCount,
    string Status,
    IReadOnlyList<StationSlotResponseDto> AvailableSlots
);