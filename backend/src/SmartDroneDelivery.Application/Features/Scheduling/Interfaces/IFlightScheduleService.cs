using SmartDroneDelivery.Application.Features.Scheduling.DTOs;

namespace SmartDroneDelivery.Application.Features.Scheduling.Interfaces;

public interface IFlightScheduleService
{
    Task<IReadOnlyList<DroneStatusDto>> GetAvailableDronesAsync(
        decimal? requiredPayloadKg = null,
        CancellationToken cancellationToken = default);

    Task<(bool Success, string Status, List<string> Errors)> ReviewOrderApprovalAsync(
        ApproveOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<(FlightScheduleResponseDto? Schedule, List<string> Errors)> AssignFlightScheduleAsync(
        AssignFlightScheduleRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FlightScheduleResponseDto>> GetFlightSchedulesAsync(
        CancellationToken cancellationToken = default);

    Task<(bool Success, FlightScheduleResponseDto? Schedule, List<string> Errors)> AbortFlightScheduleAsync(
        Guid scheduleId,
        string? abortReason,
        CancellationToken cancellationToken = default);

    Task<string?> AutoDispatchForNewOrderAsync(
        Guid orderId,
        decimal distanceKm,
        CancellationToken cancellationToken = default);

    Task<string?> CompleteFlightByOrderIdAsync(
        Guid orderId,
        CancellationToken cancellationToken = default);
}
