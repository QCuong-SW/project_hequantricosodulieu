using SmartDroneDelivery.Application.Features.Orders.DTOs;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Application.Features.Scheduling.DTOs;
using SmartDroneDelivery.Application.Features.Scheduling.Interfaces;

namespace SmartDroneDelivery.Application.Features.Orders.Services;

public class OrderLifecycleE2EVerifier
{
    private readonly IOrderService _orderService;
    private readonly IOrderCancellationService _cancellationService;
    private readonly IFlightScheduleService _scheduleService;

    public OrderLifecycleE2EVerifier(
        IOrderService orderService,
        IOrderCancellationService cancellationService,
        IFlightScheduleService scheduleService)
    {
        _orderService = orderService;
        _cancellationService = cancellationService;
        _scheduleService = scheduleService;
    }

    public async Task<(bool Passed, List<string> StepsLog)> RunLifecycleVerificationAsync(
        CancellationToken cancellationToken = default)
    {
        var steps = new List<string>();

        var createRequest = new CreateOrderRequest
        {
            CustomerId = Guid.NewGuid(),
            PickupMethod = "STATION_DROP",
            DeliveryMethod = "CUSTOMER_ADDRESS",
            Sender = new OrderContactAddressDto
            {
                Name = "Nguyen Van An",
                Phone = "0901234567",
                AddressText = "Bitexco Financial Tower, District 1, HCMC",
                Latitude = 10.771595m,
                Longitude = 106.704750m
            },
            Recipient = new OrderContactAddressDto
            {
                Name = "Tran Thi Bich",
                Phone = "0909876543",
                AddressText = "Saigon Hi-Tech Park, Thu Duc City, HCMC",
                Latitude = 10.841128m,
                Longitude = 106.809883m
            },
            Packages = new List<CreateOrderPackageDto>
            {
                new()
                {
                    Description = "Medical Diagnostic Kit",
                    WeightKg = 2.15m,
                    LengthCm = 28m,
                    WidthCm = 18m,
                    HeightCm = 14m,
                    DeclaredValue = 3500000m,
                    IsFragile = true,
                    IsHazardous = false
                }
            }
        };

        var (createdOrder, createErrors) = await _orderService.CreateOrderAsync(
            createRequest,
            cancellationToken);

        if (createdOrder is null || createErrors.Count > 0)
        {
            steps.Add($"[FAIL] Step 1 CreateOrder: {string.Join("; ", createErrors)}");
            return (false, steps);
        }
        steps.Add($"[PASS] Step 1: Order '{createdOrder.TrackingNumber}' created in status '{createdOrder.Status}'.");

        var (approved, approvalStatus, reviewErrors) = await _scheduleService.ReviewOrderApprovalAsync(
            new ApproveOrderRequest
            {
                OrderId = createdOrder.Id,
                ApprovedByUserId = Guid.NewGuid(),
                IsApproved = true
            },
            cancellationToken);

        if (!approved || reviewErrors.Count > 0)
        {
            steps.Add($"[FAIL] Step 2 ReviewOrderApproval: {string.Join("; ", reviewErrors)}");
            return (false, steps);
        }
        steps.Add($"[PASS] Step 2: Order '{createdOrder.TrackingNumber}' transitioned to '{approvalStatus}'.");

        var availableDrones = await _scheduleService.GetAvailableDronesAsync(
            createdOrder.TotalWeightKg,
            cancellationToken);

        var targetDrone = availableDrones.FirstOrDefault();
        if (targetDrone is null)
        {
            steps.Add("[FAIL] Step 3 GetAvailableDrones: No eligible IDLE drone available.");
            return (false, steps);
        }

        var (schedule, assignErrors) = await _scheduleService.AssignFlightScheduleAsync(
            new AssignFlightScheduleRequest
            {
                OrderId = createdOrder.Id,
                DroneId = targetDrone.Id,
                OriginStationId = Guid.Parse("22222222-2222-2222-2222-222222222001"),
                DestinationStationId = Guid.Parse("22222222-2222-2222-2222-222222222002"),
                OrderWeightKg = createdOrder.TotalWeightKg,
                FlightDistanceKm = 12.5m,
                ScheduledDeparture = DateTime.UtcNow.AddMinutes(15),
                Waypoints = new List<FlightWaypointDto>
                {
                    new() { SequenceOrder = 1, Latitude = 10.771595m, Longitude = 106.704750m, TargetAltitudeMeter = 65m },
                    new() { SequenceOrder = 2, Latitude = 10.841128m, Longitude = 106.809883m, TargetAltitudeMeter = 65m }
                }
            },
            cancellationToken);

        if (schedule is null || assignErrors.Count > 0)
        {
            steps.Add($"[FAIL] Step 3 AssignFlightSchedule: {string.Join("; ", assignErrors)}");
            return (false, steps);
        }
        steps.Add($"[PASS] Step 3: Flight '{schedule.FlightCode}' scheduled on drone '{schedule.DroneCode}'.");

        var (cancelResult, cancelErrors) = await _cancellationService.CancelOrderAsync(
            new CancelOrderRequest
            {
                OrderId = createdOrder.Id,
                RequestedByUserId = createdOrder.CustomerId,
                RequestedByRole = "CUSTOMER",
                CancellationReason = "E2E verification test cancellation before takeoff.",
                ExpectedConcurrencyVersion = 1
            },
            cancellationToken);

        if (cancelResult is null || cancelErrors.Count > 0)
        {
            steps.Add($"[FAIL] Step 4 CancelOrder: {string.Join("; ", cancelErrors)}");
            return (false, steps);
        }
        steps.Add($"[PASS] Step 4: Order cancelled cleanly (Status='{cancelResult.CurrentStatus}', ConcurrencyVersion={cancelResult.ConcurrencyVersion}).");

        return (true, steps);
    }
}
