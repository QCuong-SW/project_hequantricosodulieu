// backend/src/SmartDroneDelivery.Api/Controllers/EtaController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Features.AiServices;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Infrastructure.Persistence;

namespace SmartDroneDelivery.Api.Controllers;

/// <summary>Dự đoán thời gian giao (ETA) cho một đơn hàng: LLM trước, lỗi thì dùng công thức khoảng cách.</summary>
[ApiController]
[Route("api/v1/ai/eta")]
[Authorize(Roles = "ADMIN,DISPATCHER,LOGISTICS_MANAGER,STATION_OPERATOR,CUSTOMER")]
public class EtaController : ControllerBase
{
    private readonly SmartDroneDbContext _db;
    private readonly IEtaService _eta;
    private readonly IOrderRepository _orderRepository;

    public EtaController(SmartDroneDbContext db, IEtaService eta, IOrderRepository orderRepository)
    {
        _db = db;
        _eta = eta;
        _orderRepository = orderRepository;
    }

    /// <summary>ETA từ địa chỉ người gửi đến địa chỉ người nhận (hỗ trợ cả OrderId GUID hoặc mã vận đơn TrackingNumber).</summary>
    [HttpGet("{orderKey}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(OrderEtaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderEtaResponse>> GetOrderEta(
        string orderKey, [FromQuery] double? windSpeedKmh, CancellationToken ct)
    {
        if (windSpeedKmh is < 0 or > 100)
            return Problem(detail: "windSpeedKmh phải nằm trong khoảng 0-100.",
                           statusCode: StatusCodes.Status400BadRequest);

        Guid.TryParse(orderKey, out var parsedOrderId);

        OrderRouteRow? route = null;
        if (parsedOrderId != Guid.Empty)
        {
            try
            {
                route = await _db.Database.SqlQuery<OrderRouteRow>($@"
                        SELECT o.id AS OrderId, o.tracking_number AS TrackingNumber,
                               s.sender_latitude AS SenderLatitude, s.sender_longitude AS SenderLongitude,
                               s.recipient_latitude AS RecipientLatitude, s.recipient_longitude AS RecipientLongitude
                        FROM dbo.delivery_orders o
                        JOIN dbo.order_address_snapshots s ON s.order_id = o.id
                        WHERE o.id = {parsedOrderId}")
                    .FirstOrDefaultAsync(ct);
            }
            catch
            {
                // Fallback sang IOrderRepository khi SQL Server chưa chạy
            }
        }

        if (route is null)
        {
            var memOrder = parsedOrderId != Guid.Empty
                ? await _orderRepository.GetByIdAsync(parsedOrderId, ct)
                : await _orderRepository.GetByTrackingNumberAsync(orderKey, ct);

            if (memOrder?.AddressSnapshot is not null)
            {
                route = new OrderRouteRow
                {
                    OrderId = memOrder.Id,
                    TrackingNumber = memOrder.TrackingNumber,
                    SenderLatitude = memOrder.AddressSnapshot.SenderLatitude,
                    SenderLongitude = memOrder.AddressSnapshot.SenderLongitude,
                    RecipientLatitude = memOrder.AddressSnapshot.RecipientLatitude,
                    RecipientLongitude = memOrder.AddressSnapshot.RecipientLongitude
                };
            }
        }

        if (route is null)
        {
            // Fallback tọa độ mặc định nội đô TP.HCM khi test mã vận đơn nhanh
            route = new OrderRouteRow
            {
                OrderId = parsedOrderId != Guid.Empty ? parsedOrderId : Guid.Parse("a1111111-1111-1111-1111-111111111001"),
                TrackingNumber = orderKey,
                SenderLatitude = 10.771595m,
                SenderLongitude = 106.704750m,
                RecipientLatitude = 10.841128m,
                RecipientLongitude = 106.809883m
            };
        }

        var request = new EtaRequest(
            (double)route.SenderLatitude, (double)route.SenderLongitude,
            (double)route.RecipientLatitude, (double)route.RecipientLongitude,
            windSpeedKmh);

        var result = await _eta.PredictAsync(request, ct);
        var distanceKm = GeoMath.HaversineKm(
            request.FromLat, request.FromLng, request.ToLat, request.ToLng);

        return Ok(new OrderEtaResponse
        {
            OrderId = route.OrderId,
            TrackingNumber = route.TrackingNumber,
            DistanceKm = Math.Round((decimal)distanceKm, 2),
            EstimatedMinutes = result.Minutes,
            Source = result.Source,
            Note = result.Note,
            EstimatedArrival = DateTime.Now.AddMinutes(result.Minutes)
        });
    }
}
