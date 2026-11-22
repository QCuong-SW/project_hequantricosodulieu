using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Stations;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/landing-stations")]
public class StationsController : ControllerBase
{
    private readonly IStationQueryService _stationQueryService;
    public StationsController(IStationQueryService stationQueryService)
    {
        _stationQueryService = stationQueryService;
    }

    [HttpGet]
    public async Task<IActionResult> GetLandingStations(
        [FromQuery] string? slotType = null, [FromQuery] bool onlyActive = true, CancellationToken cancellationToken = default)
    {
        var query = new GetStationsWithAvailableSlotsQuery(slotType, onlyActive);
        var stations = await _stationQueryService.GetStationsWithAvailableSlotsAsync(query, cancellationToken);
        return Ok(stations);
    }

    [HttpGet("{stationId:guid}")]
    public async Task<IActionResult> GetLandingStationById(Guid stationId, CancellationToken cancellationToken = default)
    {
        var station = await _stationQueryService.GetStationByIdAsync(stationId, cancellationToken);
        if (station is null) return NotFound(new { Message = "Landing station not found." });
        return Ok(station);
    }

    [HttpPatch("{stationId:guid}/slots/{slotId:guid}")]
    public async Task<IActionResult> UpdateSlotStatus(
        Guid stationId,
        Guid slotId,
        [FromBody] UpdateSlotStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        var success = await _stationQueryService.UpdateSlotStatusAsync(stationId, slotId, request.Status, cancellationToken);
        if (!success)
        {
            return NotFound(new { success = false, message = "Trạm hoặc ô lưu trữ/bãi đáp không tồn tại." });
        }

        return Ok(new
        {
            success = true,
            message = "Cập nhật trạng thái slot trạm thành công.",
            stationId,
            slotId,
            status = request.Status
        });
    }
}