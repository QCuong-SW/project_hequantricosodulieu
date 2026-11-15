// backend/src/SmartDroneDelivery.Application/Features/AiServices/EtaDtos.cs
namespace SmartDroneDelivery.Application.Features.AiServices;

/// <summary>Kết quả ETA của một đơn hàng trả về cho client.</summary>
public class OrderEtaResponse
{
    public Guid OrderId { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal DistanceKm { get; set; }
    public int EstimatedMinutes { get; set; }
    /// <summary>"LLM" hoặc "FALLBACK".</summary>
    public string Source { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime EstimatedArrival { get; set; }
}

/// <summary>Tuyến người gửi -> người nhận của một đơn (đọc từ order_address_snapshots).</summary>
public class OrderRouteRow
{
    public Guid OrderId { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal SenderLatitude { get; set; }
    public decimal SenderLongitude { get; set; }
    public decimal RecipientLatitude { get; set; }
    public decimal RecipientLongitude { get; set; }
}
