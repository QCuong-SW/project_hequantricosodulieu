using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Orders.DTOs;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/delivery-orders")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var (order, errors) = await _orderService.CreateOrderAsync(request, cancellationToken);
        if (errors.Count > 0 || order is null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Order validation failed.",
                errors
            });
        }

        return CreatedAtAction(
            nameof(GetOrderById),
            new { id = order.Id },
            new
            {
                success = true,
                message = "Delivery order created successfully and is pending approval.",
                data = order
            });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOrderById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var order = await _orderService.GetOrderByIdAsync(id, cancellationToken);
        if (order is null)
        {
            return NotFound(new
            {
                success = false,
                message = $"Delivery order '{id}' was not found."
            });
        }

        return Ok(new
        {
            success = true,
            data = order
        });
    }

    [HttpGet("customer/{customerId:guid}")]
    public async Task<IActionResult> GetCustomerOrders(
        Guid customerId,
        CancellationToken cancellationToken)
    {
        var orders = await _orderService.GetCustomerOrdersAsync(customerId, cancellationToken);
        return Ok(new
        {
            success = true,
            data = orders
        });
    }
}
