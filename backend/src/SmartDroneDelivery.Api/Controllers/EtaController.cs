// backend/src/SmartDroneDelivery.Api/Controllers/EtaController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Features.AiServices;
using SmartDroneDelivery.Infrastructure.Persistence;

namespace SmartDroneDelivery.Api.Controllers;

/// <summary>Dự đoán thời gian giao (ETA) cho một đơn hàng: LLM trước, lỗi thì dùng công thức khoảng cách.</summary>
[ApiController]
[Route("api/v1/ai/eta")]
[Authorize(Roles = "ADMIN,DISPATCHER,LOGISTICS_MANAGER,STATION_OPERATOR")]
public class EtaController : ControllerBase
{
    private readonly SmartDroneDbContext _db;
    private readonly IEtaService _eta;

    public EtaController(SmartDroneDbContext db, IEtaService eta)
    {
        _db = db;
        _eta = eta;
    }

    /// <summary>ETA từ địa chỉ người gửi đến địa chỉ người nhận (tọa độ lấy từ snapshot địa chỉ của đơn).</summary>
    [HttpGet("{orderId:guid}")]
    [ProducesResponseType(typeof(OrderEtaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderEtaResponse>> GetOrderEta(
        Guid orderId, [FromQuery] double? windSpeedKmh, CancellationToken ct)
    {
        if (windSpeedKmh is < 0 or > 100)
            return Problem(detail: "windSpeedKmh phải nằm trong khoảng 0-100.",
                           statusCode: StatusCodes.Status400BadRequest);

        var route = await _db.Database.SqlQuery<OrderRouteRow>($@"
                SELECT o.id AS OrderId, o.tracking_number AS TrackingNumber,
                       s.sender_latitude AS SenderLatitude, s.sender_longitude AS SenderLongitude,
                       s.recipient_latitude AS RecipientLatitude, s.recipient_longitude AS RecipientLongitude
                FROM dbo.delivery_orders o
                JOIN dbo.order_address_snapshots s ON s.order_id = o.id
                WHERE o.id = {orderId}")
            .FirstOrDefaultAsync(ct);

        if (route is null)
            return NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Detail = "Không tìm thấy đơn hàng hoặc đơn chưa có snapshot địa chỉ."
            });

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
