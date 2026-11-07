using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Stations;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/handoffs")]
public class HandoffController : ControllerBase
{
    private readonly IPackageHandoffService _handoffService;

    public HandoffController(IPackageHandoffService? handoffService = null)
    {
        _handoffService = handoffService ?? new PackageHandoffService();
    }

    [HttpPost("scan")]
    public async Task<IActionResult> ScanPackageHandoff(
        [FromBody] ScanPackageHandoffRequestDto request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _handoffService.ScanPackageBarcodeAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("station/{stationId:guid}")]
    public async Task<IActionResult> GetStationHandoffs(
        Guid stationId,
        CancellationToken cancellationToken = default)
    {
        var history = await _handoffService.GetStationHandoffHistoryAsync(stationId, cancellationToken);
        return Ok(history);
    }
}