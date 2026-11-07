using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.DTOs;
using SmartDroneDelivery.Application.Interfaces;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/addresses")]
public class AddressesController : ControllerBase
{
    private readonly IAddressService _addressService;

    public AddressesController(IAddressService addressService)
    {
        _addressService = addressService;
    }

    // GET: api/v1/addresses
    [HttpGet]
    public async Task<IActionResult> GetMyAddresses()
    {
        // Tạm thời dùng UserId cố định để kiểm tra API.
        // Sẽ thay bằng UserId từ đăng nhập/JWT khi tích hợp xác thực.
        var userId = Guid.Empty;

        var addresses = await _addressService.GetMyAddressesAsync(userId);

        return Ok(addresses);
    }

    // POST: api/v1/addresses
    [HttpPost]
    public async Task<IActionResult> CreateAddress(
        [FromBody] CreateAddressRequest request)
    {
        var userId = Guid.Empty;

        var address = await _addressService.CreateAddressAsync(
            userId,
            request);

        return CreatedAtAction(
            nameof(GetMyAddresses),
            new { id = address.Id },
            address);
    }
}