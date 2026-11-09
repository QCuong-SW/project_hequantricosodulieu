using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Scheduling.DTOs;
using SmartDroneDelivery.Application.Features.Scheduling.Interfaces;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/flight-schedules")]
public class FlightSchedulesController : ControllerBase
{
    private readonly IFlightScheduleService _flightScheduleService;

    public FlightSchedulesController(IFlightScheduleService flightScheduleService)
    {
        _flightScheduleService = flightScheduleService;
    }

    [HttpGet("drones/available")]
    public async Task<IActionResult> GetAvailableDrones(
        [FromQuery] decimal? requiredPayloadKg = null,
        CancellationToken cancellationToken = default)
    {
        var drones = await _flightScheduleService.GetAvailableDronesAsync(
            requiredPayloadKg,
            cancellationToken);

        return Ok(new
        {
            success = true,
            data = drones
        });
    }

    [HttpPost("orders/review")]
    public async Task<IActionResult> ReviewOrderApproval(
        [FromBody] ApproveOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        var (success, status, errors) = await _flightScheduleService.ReviewOrderApprovalAsync(
            request,
            cancellationToken);

        if (!success || errors.Count > 0)
        {
            return BadRequest(new
            {
                success = false,
                message = "Order approval review failed.",
                errors
            });
        }

        return Ok(new
        {
            success = true,
            message = $"Order '{request.OrderId}' has been marked as {status}.",
            data = new
            {
                orderId = request.OrderId,
                status
            }
        });
    }

    [HttpPost("assign")]
    public async Task<IActionResult> AssignFlightSchedule(
        [FromBody] AssignFlightScheduleRequest request,
        CancellationToken cancellationToken = default)
    {
        var (schedule, errors) = await _flightScheduleService.AssignFlightScheduleAsync(
            request,
            cancellationToken);

        if (errors.Count > 0 || schedule is null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Failed to assign flight schedule.",
                errors
            });
        }

        return CreatedAtAction(
            nameof(GetFlightSchedules),
            new { id = schedule.Id },
            new
            {
                success = true,
                message = "Flight schedule assigned successfully.",
                data = schedule
            });
    }

    [HttpGet]
    public async Task<IActionResult> GetFlightSchedules(
        CancellationToken cancellationToken = default)
    {
        var schedules = await _flightScheduleService.GetFlightSchedulesAsync(cancellationToken);
        return Ok(new
        {
            success = true,
            data = schedules
        });
    }
}
