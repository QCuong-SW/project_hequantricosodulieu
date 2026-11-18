using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Orders.DTOs;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/delivery-orders")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly IOrderCancellationService _orderCancellationService;

    public OrdersController(
        IOrderService orderService,
        IOrderCancellationService orderCancellationService)
    {
        _orderService = orderService;
        _orderCancellationService = orderCancellationService;
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

    [HttpGet]
    public async Task<IActionResult> GetAllOrders(
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderService.GetAllOrdersAsync(status, cancellationToken);
        return Ok(new
        {
            success = true,
            data = orders
        });
    }

    [HttpGet("tracking/{trackingNumber}")]
    public async Task<IActionResult> GetOrderByTrackingNumber(
        string trackingNumber,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderService.GetOrderByTrackingNumberAsync(trackingNumber, cancellationToken);
        if (order is null)
        {
            return NotFound(new
            {
                success = false,
                message = $"Không tìm thấy đơn hàng với mã '{trackingNumber}'."
            });
        }

        return Ok(new
        {
            success = true,
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

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> TransitionOrderStatus(
        Guid id,
        [FromBody] TransitionOrderStatusRequest request,
        CancellationToken cancellationToken)
    {
        request.OrderId = id;
        var (result, errors) = await _orderService.TransitionOrderStatusAsync(request, cancellationToken);
        if (errors.Count > 0 || result is null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Order status transition failed.",
                errors
            });
        }

        return Ok(new
        {
            success = true,
            message = $"Order status transitioned from '{result.PreviousStatus}' to '{result.CurrentStatus}'.",
            data = result
        });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> CancelOrder(
        Guid id,
        [FromBody] CancelOrderRequest request,
        CancellationToken cancellationToken)
    {
        request.OrderId = id;
        var (result, errors) = await _orderCancellationService.CancelOrderAsync(request, cancellationToken);
        if (errors.Count > 0 || result is null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Order cancellation failed.",
                errors
            });
        }

        return Ok(new
        {
            success = true,
            message = "Order cancelled successfully.",
            data = result
        });
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> RejectOrder(
        Guid id,
        [FromBody] RejectOrderRequest request,
        CancellationToken cancellationToken)
    {
        request.OrderId = id;
        var (result, errors) = await _orderCancellationService.RejectOrderAsync(request, cancellationToken);
        if (errors.Count > 0 || result is null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Order rejection failed.",
                errors
            });
        }

        return Ok(new
        {
            success = true,
            message = "Order rejected successfully.",
            data = result
        });
    }
}
