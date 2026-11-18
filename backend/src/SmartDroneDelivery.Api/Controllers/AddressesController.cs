using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.DTOs;
using SmartDroneDelivery.Application.Interfaces;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/addresses")]
public class AddressesController : ControllerBase
{
    private static readonly Guid DefaultCustomerUserId = Guid.Parse("11111111-1111-1111-1111-111111111005");
    private readonly IAddressService _addressService;

    public AddressesController(IAddressService addressService)
    {
        _addressService = addressService;
    }

    // GET: api/v1/addresses
    [HttpGet]
    public async Task<IActionResult> GetMyAddresses()
    {
        var userId = ResolveCurrentUserId();
        var addresses = await _addressService.GetMyAddressesAsync(userId);
        return Ok(new
        {
            success = true,
            data = addresses
        });
    }

    // POST: api/v1/addresses
    [HttpPost]
    public async Task<IActionResult> CreateAddress(
        [FromBody] CreateAddressRequest request)
    {
        var userId = ResolveCurrentUserId();
        var address = await _addressService.CreateAddressAsync(
            userId,
            request);

        return CreatedAtAction(
            nameof(GetMyAddresses),
            new { id = address.Id },
            new
            {
                success = true,
                data = address
            });
    }

    private Guid ResolveCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value;
        return Guid.TryParse(sub, out var id) && id != Guid.Empty ? id : DefaultCustomerUserId;
    }
}