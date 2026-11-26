using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Orders.DTOs;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Application.Features.Scheduling.Interfaces;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/delivery-orders")]
public class OrdersController : ControllerBase
{
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (double Progress, DateTime UpdatedAt, bool Paused)> TelemetryOverrides = new(StringComparer.OrdinalIgnoreCase);
    private static readonly DateTime ServerBootTime = DateTime.UtcNow;

    private readonly IOrderService _orderService;
    private readonly IOrderCancellationService _orderCancellationService;
    private readonly IOrderRepository _orderRepository;
    private readonly IFlightScheduleService? _flightScheduleService;

    public OrdersController(
        IOrderService orderService,
        IOrderCancellationService orderCancellationService,
        IOrderRepository orderRepository,
        IFlightScheduleService? flightScheduleService = null)
    {
        _orderService = orderService;
        _orderCancellationService = orderCancellationService;
        _orderRepository = orderRepository;
        _flightScheduleService = flightScheduleService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(sub, out var callerId) && callerId != Guid.Empty)
        {
            request.CustomerId = callerId;
        }
        else if (request.CustomerId == Guid.Empty)
        {
            request.CustomerId = Guid.Parse("11111111-1111-1111-1111-111111111005");
        }

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

        // Đặt xong tự động chuyển sang trạng thái đang giao hàng (IN_TRANSIT) để Drone bay giao ngay từ điểm xuất phát (2%)
        var storedOrder = await _orderRepository.GetByIdAsync(order.Id, cancellationToken);
        if (storedOrder is not null)
        {
            storedOrder.Status = "IN_TRANSIT";
            storedOrder.UpdatedAt = DateTime.UtcNow;
            await _orderRepository.AddAsync(storedOrder, cancellationToken);
            order.Status = "IN_TRANSIT";
        }

        if (!string.IsNullOrWhiteSpace(order.TrackingNumber))
        {
            TelemetryOverrides[order.TrackingNumber] = (0.02, DateTime.UtcNow, false);
        }

        if (_flightScheduleService is not null)
        {
            var dist = storedOrder?.AddressSnapshot is not null
                ? (decimal)CalculateHaversineKm(
                    (double)storedOrder.AddressSnapshot.SenderLatitude,
                    (double)storedOrder.AddressSnapshot.SenderLongitude,
                    (double)storedOrder.AddressSnapshot.RecipientLatitude,
                    (double)storedOrder.AddressSnapshot.RecipientLongitude)
                : 12.5m;
            await _flightScheduleService.AutoDispatchForNewOrderAsync(order.Id, dist, cancellationToken);
        }

        return CreatedAtAction(
            nameof(GetOrderById),
            new { id = order.Id },
            new
            {
                success = true,
                message = "Đặt hàng thành công! Drone đã cất cánh và đang trên đường giao hàng.",
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

        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var role = User.FindFirst("role")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (Guid.TryParse(sub, out var callerId) && (role == "CUSTOMER" || string.IsNullOrEmpty(role)) && order.CustomerId != callerId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                success = false,
                message = "Bạn không có quyền truy cập đơn hàng của người dùng khác (Data Isolation)."
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

    [HttpPost("{id:guid}/pay")]
    public async Task<IActionResult> PayOrder(
        Guid id,
        CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(id, cancellationToken);
        if (order is null)
        {
            return NotFound(new
            {
                success = false,
                message = $"Delivery order '{id}' was not found."
            });
        }

        order.PaymentStatus = "PAID";
        order.UpdatedAt = DateTime.UtcNow;
        await _orderRepository.AddAsync(order, cancellationToken);

        return Ok(new
        {
            success = true,
            message = "Thanh toán cước phí thành công. Đơn hàng đã chuyển sang trạng thái PAID.",
            data = new
            {
                orderId = order.Id,
                paymentStatus = order.PaymentStatus,
                paidAt = DateTime.UtcNow
            }
        });
    }

    [HttpGet("telemetry/{key}")]
    public async Task<IActionResult> GetSynchronizedTelemetry(
        string key,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByTrackingNumberAsync(key, cancellationToken);
        if (order is null && Guid.TryParse(key, out var guidId))
        {
            order = await _orderRepository.GetByIdAsync(guidId, cancellationToken);
        }

        var originLat = (double)(order?.AddressSnapshot?.SenderLatitude ?? 10.771595m);
        var originLng = (double)(order?.AddressSnapshot?.SenderLongitude ?? 106.704750m);
        var originLabel = order?.AddressSnapshot?.SenderAddressText ?? "Trạm Drone Hub Trung Tâm Quận 1";

        var destLat = (double)(order?.AddressSnapshot?.RecipientLatitude ?? 10.841128m);
        var destLng = (double)(order?.AddressSnapshot?.RecipientLongitude ?? 106.809883m);
        var destLabel = order?.AddressSnapshot?.RecipientAddressText ?? "Khu Công Nghệ Cao TP. Thủ Đức";

        var trackingKey = order?.TrackingNumber ?? key;
        var nowUtc = DateTime.UtcNow;
        var nowUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        const double speedPerSecond = 1.0 / 60.0; // 60 giây bay trọn hành trình thực tế (từ 0% đến 100%), đồng bộ 1:1 Web & Mobile

        double baseProgress;
        long baseUnixMs;
        bool paused;
        double progress;

        var isCompletedOrder = order is not null &&
            (string.Equals(order.Status, "DELIVERED", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(order.Status, "CANCELLED", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(order.Status, "REJECTED", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(order.Status, "DELIVERY_FAILED", StringComparison.OrdinalIgnoreCase));

        if (isCompletedOrder)
        {
            baseProgress = 1.0;
            baseUnixMs = nowUnixMs;
            paused = true;
            progress = 1.0;
        }
        else if (TelemetryOverrides.TryGetValue(trackingKey, out var ov))
        {
            baseProgress = ov.Progress;
            baseUnixMs = new DateTimeOffset(ov.UpdatedAt, TimeSpan.Zero).ToUnixTimeMilliseconds();
            paused = ov.Paused;
            if (paused)
            {
                progress = baseProgress;
            }
            else
            {
                var elapsedSec = Math.Max(0, (nowUnixMs - baseUnixMs) / 1000.0);
                var raw = baseProgress + elapsedSec * speedPerSecond;
                // Khi bay đến 100% thì Drone hạ cánh tại điểm giao để khách hàng xác nhận nhận hàng!
                if (raw >= 1.0)
                {
                    progress = 1.0;
                    paused = true;
                    TelemetryOverrides[trackingKey] = (1.0, nowUtc, true);
                }
                else
                {
                    progress = raw;
                }
            }
        }
        else
        {
            // Lần đầu theo dõi chuyến bay đang hoạt động: bắt đầu bay từ điểm xuất phát (5%) theo thời gian thực
            baseProgress = 0.05;
            baseUnixMs = nowUnixMs;
            paused = false;
            progress = 0.05;
            TelemetryOverrides[trackingKey] = (0.05, nowUtc, false);
        }

        progress = Math.Clamp(progress, 0.0, 1.0);

        var currentLat = Math.Round(originLat + (destLat - originLat) * progress, 6);
        var currentLng = Math.Round(originLng + (destLng - originLng) * progress, 6);

        var totalDistKm = CalculateHaversineKm(originLat, originLng, destLat, destLng);
        var remainingDistKm = Math.Round(totalDistKm * (1.0 - progress), 2);
        var etaMinutes = Math.Max(1, (int)Math.Ceiling((remainingDistKm / 48.0) * 60.0));

        var altitude = progress >= 1.0 ? 0.0 : (progress > 0.85 ? 28.0 : 65.0);
        var speed = (paused || progress >= 1.0) ? 0.0 : 48.5;
        var battery = Math.Round(Math.Max(24.0, 96.0 - progress * 18.0), 1);
        var isApproaching = progress >= 0.70 && progress < 1.0;

        var stage = progress switch
        {
            >= 1.0 => "ARRIVED",
            >= 0.70 => "APPROACHING",
            >= 0.15 => "IN_TRANSIT",
            _ => "TAKEOFF"
        };

        return Ok(new
        {
            success = true,
            data = new
            {
                orderId = order?.Id.ToString() ?? key,
                trackingNumber = trackingKey,
                orderStatus = order?.Status ?? "IN_TRANSIT",
                droneCode = "DRN-VN-04",
                progress = Math.Round(progress, 5),
                progressPercent = Math.Round(progress * 100.0, 1),
                baseProgress = Math.Round(progress, 5),
                baseUnixMs = nowUnixMs,
                speedPerSecond = paused ? 0.0 : speedPerSecond,
                paused,
                serverUnixMs = nowUnixMs,
                latitude = currentLat,
                longitude = currentLng,
                originLat,
                originLng,
                originLabel,
                destLat,
                destLng,
                destLabel,
                altitudeMeters = altitude,
                speedKmh = speed,
                batteryPercent = battery,
                totalDistanceKm = totalDistKm,
                remainingDistanceKm = remainingDistKm,
                etaMinutes,
                isApproaching,
                flightStage = stage,
                timestamp = nowUtc
            }
        });
    }

    [HttpPost("telemetry/{key}")]
    public async Task<IActionResult> SetSynchronizedTelemetry(
        string key,
        [FromBody] TelemetryOverrideRequest request,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByTrackingNumberAsync(key, cancellationToken);
        if (order is null && Guid.TryParse(key, out var guidId))
        {
            order = await _orderRepository.GetByIdAsync(guidId, cancellationToken);
        }
        var trackingKey = order?.TrackingNumber ?? key;
        var clamped = Math.Clamp(request.Progress, 0.0, 1.0);
        TelemetryOverrides[trackingKey] = (clamped, DateTime.UtcNow, request.Paused);

        return await GetSynchronizedTelemetry(trackingKey, cancellationToken);
    }

    private static double CalculateHaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return Math.Round(R * c, 2);
    }
}

public class TelemetryOverrideRequest
{
    public double Progress { get; set; } = 0.80;
    public bool Paused { get; set; }
}
