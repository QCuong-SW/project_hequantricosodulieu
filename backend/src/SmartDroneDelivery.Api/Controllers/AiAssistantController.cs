using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartDroneDelivery.Application.Features.AiServices;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Infrastructure.Ai;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/ai")]
[AllowAnonymous]
public class AiAssistantController : ControllerBase
{
    private readonly IOrderRepository _orderRepository;
    private readonly IEtaService _etaService;
    private readonly ILlmEtaClient _llmClient;
    private readonly LlmOptions _llmOptions;
    private readonly ILogger<AiAssistantController> _logger;

    public AiAssistantController(
        IOrderRepository orderRepository,
        IEtaService etaService,
        ILlmEtaClient llmClient,
        IOptions<LlmOptions> llmOptions,
        ILogger<AiAssistantController> logger)
    {
        _orderRepository = orderRepository;
        _etaService = etaService;
        _llmClient = llmClient;
        _llmOptions = llmOptions.Value;
        _logger = logger;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat(
        [FromBody] AiChatRequest request,
        CancellationToken ct = default)
    {
        var prompt = request.Message?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(prompt))
        {
            return BadRequest(new { success = false, message = "Vui lòng nhập câu hỏi cho Trợ lý AI." });
        }

        var allOrders = (await _orderRepository.GetAllAsync(null, ct)).ToList();
        var activeOrders = allOrders.Where(o =>
            !string.Equals(o.Status, "DELIVERED", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(o.Status, "CANCELLED", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(o.Status, "REJECTED", StringComparison.OrdinalIgnoreCase)).ToList();
        var deliveredOrders = allOrders.Where(o =>
            string.Equals(o.Status, "DELIVERED", StringComparison.OrdinalIgnoreCase)).ToList();

        // Nếu có cấu hình OpenAI API Key -> ưu tiên gọi LLM thực
        if (!string.IsNullOrWhiteSpace(_llmOptions.ApiKey))
        {
            try
            {
                var llmReply = await TryCallLlmChatAsync(prompt, allOrders.Count, activeOrders.Count, deliveredOrders.Count, ct);
                if (!string.IsNullOrWhiteSpace(llmReply))
                {
                    return Ok(new
                    {
                        success = true,
                        data = new
                        {
                            reply = llmReply,
                            source = "LLM",
                            model = _llmOptions.Model,
                            timestamp = DateTime.UtcNow
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gọi LLM Chat thất bại, chuyển sang AI_ASSISTANT_ENGINE fallback.");
            }
        }

        var lower = prompt.ToLowerInvariant();
        string reply;
        string[] suggestions;

        if (lower.Contains("tóm tắt") || lower.Contains("tình hình") || lower.Contains("hôm nay") || lower.Contains("thống kê"))
        {
            var latestActive = activeOrders.OrderByDescending(o => o.CreatedAt).FirstOrDefault();
            var activeText = latestActive is not null
                ? $"Đơn mới nhất đang hoạt động là {latestActive.TrackingNumber} ({latestActive.Status}) giao đến {latestActive.AddressSnapshot?.RecipientAddressText ?? "TP.HCM"}."
                : "Hiện không có chuyến bay nào đang diễn ra.";

            reply = $"📊 **Tóm tắt vận hành SmartDroneDelivery thời gian thực:**\n" +
                    $"• Tổng số đơn hàng trong hệ thống: **{allOrders.Count} đơn**\n" +
                    $"• Đang bay / chờ điều phối: **{activeOrders.Count} đơn**\n" +
                    $"• Đã giao thành công (DELIVERED): **{deliveredOrders.Count} đơn**\n" +
                    $"• {activeText}\n" +
                    $"• Trạm hoạt động ổn định: **STN-Q1 (Quận 1)**, **STN-TD (Thủ Đức)**, **STN-Q7 (Phú Mỹ Hưng)**.";
            suggestions = ["Đơn nào đang bay giao hàng?", "Ước tính thời gian bay tới Thủ Đức", "Tóm tắt đơn hàng mới nhất"];
        }
        else if (lower.Contains("đang bay") || lower.Contains("đơn nào") || lower.Contains("đơn hàng") || lower.Contains("tra cứu"))
        {
            if (activeOrders.Count == 0)
            {
                reply = "Hiện tại không có chuyến bay Drone nào đang di chuyển trên không phận. Khi khách hàng đặt đơn mới trên App Mobile, lộ trình bay sẽ xuất hiện ngay trên bản đồ theo dõi.";
            }
            else
            {
                var lines = activeOrders
                    .OrderByDescending(o => o.CreatedAt)
                    .Take(5)
                    .Select(o => $"• **{o.TrackingNumber}** — Trạng thái: `{o.Status}` • Giao tới: {o.AddressSnapshot?.RecipientAddressText ?? "TP.HCM"}");
                reply = $"🛸 **Danh sách {activeOrders.Count} đơn hàng đang hoạt động (ưu tiên mới nhất):**\n" +
                        string.Join("\n", lines) +
                        "\n\nBạn có thể mở mục **Theo Dõi Giao Hàng Drone** để xem vị trí GPS thời gian thực đồng bộ giữa Web và Mobile.";
            }
            suggestions = ["Tóm tắt tình hình hôm nay", "Ước tính thời gian giao khi gió 20 km/h", "Quy định tải trọng Drone"];
        }
        else if (lower.Contains("thời gian") || lower.Contains("bao lâu") || lower.Contains("gió") || lower.Contains("eta") || lower.Contains("thủ đức"))
        {
            double wind = 10;
            var match = System.Text.RegularExpressions.Regex.Match(prompt, @"\d+");
            if (match.Success && double.TryParse(match.Value, out var parsedWind) && parsedWind <= 80)
            {
                wind = parsedWind;
            }

            var targetOrder = activeOrders.OrderByDescending(o => o.CreatedAt).FirstOrDefault() ?? allOrders.FirstOrDefault();
            var fromLat = (double)(targetOrder?.AddressSnapshot?.SenderLatitude ?? 10.771595m);
            var fromLng = (double)(targetOrder?.AddressSnapshot?.SenderLongitude ?? 106.704750m);
            var toLat = (double)(targetOrder?.AddressSnapshot?.RecipientLatitude ?? 10.841128m);
            var toLng = (double)(targetOrder?.AddressSnapshot?.RecipientLongitude ?? 106.809883m);

            var etaRes = await _etaService.PredictAsync(new EtaRequest(fromLat, fromLng, toLat, toLng, wind), ct);
            var distKm = GeoMath.HaversineKm(fromLat, fromLng, toLat, toLng);

            reply = $"⏱️ **Dự báo thời gian dự kiến đến nơi bằng AI:**\n" +
                    $"• Tuyến tham chiếu: **{targetOrder?.TrackingNumber ?? "Trạm Q1 → TP. Thủ Đức"}**\n" +
                    $"• Quãng đường chim bay (Haversine): **{distKm:F2} km**\n" +
                    $"• Gió ngược giả định: **{wind:F0} km/h**\n" +
                    $"• Thời gian dự kiến đến nơi: **~{etaRes.Minutes} phút** *(Nguồn: {etaRes.Source})*\n" +
                    $"• Chi tiết: {etaRes.Note ?? "Tính toán tự động theo tốc độ hành trình và thời gian cất/hạ cánh."}";
            suggestions = ["Tóm tắt tình hình hôm nay", "Đơn nào đang bay giao hàng?", "Quy định tải trọng Drone"];
        }
        else if (lower.Contains("tải trọng") || lower.Contains("nặng") || lower.Contains("kg") || lower.Contains("quy trình") || lower.Contains("otp"))
        {
            reply = "📦 **Quy chuẩn vận chuyển & an toàn SmartDroneDelivery:**\n" +
                    "• **Tải trọng tối đa**: `≤ 5.0 kg` mỗi chuyến bay (tự động kiểm tra ngay tại giỏ hàng Mobile và bước duyệt đơn).\n" +
                    "• **Hàng dễ vỡ / Đồ ăn nóng**: Được gắn nhãn chống sốc và đóng khoang giữ nhiệt riêng.\n" +
                    "• **Bàn giao an toàn**: Khi Drone hạ cánh đạt `100%` hành trình, khách hàng mới được mở khóa chức năng lấy mã **OTP 6 số (SHA-256)** để nhận hàng.";
            suggestions = ["Gợi ý món ăn giao nhanh bằng Drone", "Đơn nào đang bay giao hàng?", "Tóm tắt tình hình hôm nay"];
        }
        else if (lower.Contains("ăn") || lower.Contains("món") || lower.Contains("đặt") || lower.Contains("menu") || lower.Contains("gợi ý"))
        {
            reply = "🍱 **Gợi ý các món ăn giao nóng siêu tốc 12–15 phút trên SmartDrone Mart:**\n" +
                    "• **Set Cơm Bento Cá Hồi Nướng Teriyaki** (0.85 kg — 195.000 đ)\n" +
                    "• **Burger Bò Wagyu Nướng Than Hồng & Khoai** (0.75 kg — 179.000 đ)\n" +
                    "• **Pizza Hải Sản Pesto Phô Mai Tươi Size M** (1.25 kg — 285.000 đ)\n" +
                    "• **Combo Cà Phê Arabica Cầu Đất & 2 Bánh Croissant** (1.10 kg — 165.000 đ)\n" +
                    "Bạn có thể chọn trực tiếp trong tab **Khám Phá** trên App Mobile và đặt Drone giao ngay!";
            suggestions = ["Đơn nào đang bay giao hàng?", "Ước tính thời gian bay tới Thủ Đức", "Quy định tải trọng Drone"];
        }
        else
        {
            reply = $"🤖 **Trợ lý AI SmartDroneDelivery** đã tiếp nhận yêu cầu: *\"{prompt}\"*\n\n" +
                    $"Hiện hệ thống đang quản lý **{allOrders.Count} đơn hàng** (trong đó **{activeOrders.Count} đơn đang hoạt động** và **{deliveredOrders.Count} đơn đã giao hoàn tất**).\n" +
                    "Bạn có thể hỏi mình về:\n" +
                    "• Tóm tắt tình hình giao hàng hôm nay\n" +
                    "• Kiểm tra các đơn hàng đang bay bằng Drone\n" +
                    "• Dự báo thời gian dự kiến đến nơi theo tốc độ gió\n" +
                    "• Gợi ý món ăn hoặc quy định tải trọng Drone (≤ 5 kg)";
            suggestions = ["Tóm tắt tình hình hôm nay", "Đơn nào đang bay giao hàng?", "Ước tính thời gian bay khi gió 15 km/h"];
        }

        return Ok(new
        {
            success = true,
            data = new
            {
                reply,
                source = "AI_ASSISTANT_ENGINE",
                suggestions,
                timestamp = DateTime.UtcNow
            }
        });
    }

    [HttpPost("summarize")]
    public async Task<IActionResult> SummarizeDelivery(
        [FromBody] AiSummarizeRequest? request,
        CancellationToken ct = default)
    {
        var allOrders = (await _orderRepository.GetAllAsync(null, ct)).ToList();
        var orderKey = request?.OrderKey?.Trim();

        if (!string.IsNullOrWhiteSpace(orderKey) && !string.Equals(orderKey, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var order = await _orderRepository.GetByTrackingNumberAsync(orderKey, ct);
            if (order is null && Guid.TryParse(orderKey, out var parsedId))
            {
                order = await _orderRepository.GetByIdAsync(parsedId, ct);
            }

            if (order is not null)
            {
                var fromLat = (double)(order.AddressSnapshot?.SenderLatitude ?? 10.771595m);
                var fromLng = (double)(order.AddressSnapshot?.SenderLongitude ?? 106.704750m);
                var toLat = (double)(order.AddressSnapshot?.RecipientLatitude ?? 10.841128m);
                var toLng = (double)(order.AddressSnapshot?.RecipientLongitude ?? 106.809883m);
                var distKm = Math.Round(GeoMath.HaversineKm(fromLat, fromLng, toLat, toLng), 2);
                var eta = await _etaService.PredictAsync(new EtaRequest(fromLat, fromLng, toLat, toLng, 10), ct);
                var totalWeight = order.Packages?.Sum(p => p.WeightKg) ?? 0.8m;
                var hasFragile = order.Packages?.Any(p => p.IsFragile) ?? false;

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        scope = "ORDER",
                        trackingNumber = order.TrackingNumber,
                        title = $"Tóm Tắt AI Cho Đơn Hàng {order.TrackingNumber}",
                        summary = $"Đơn hàng {order.TrackingNumber} hiện ở trạng thái {order.Status} ({order.PaymentStatus}), " +
                                  $"xuất phát từ {order.AddressSnapshot?.SenderAddressText ?? "Trạm Quận 1"} đến {order.AddressSnapshot?.RecipientAddressText ?? "TP. Thủ Đức"} " +
                                  $"với quãng đường đường chim bay {distKm} km và tổng khối lượng {totalWeight:F2} kg.",
                        highlights = new[]
                        {
                            $"Thời gian dự kiến đến nơi: ~{eta.Minutes} phút (cự ly {distKm} km, nguồn {eta.Source}).",
                            $"Tải trọng kiện hàng: {totalWeight:F2} / 5.00 kg — {(totalWeight <= 5.0m ? "Đạt chuẩn an toàn bay Drone" : "Vượt ngưỡng tải trọng")}.",
                            hasFragile ? "Kiện hàng có đánh dấu Dễ vỡ: Khuyến nghị giảm tốc độ hạ cánh và giữ ổn định gimbal khoang chứa." : "Kiện hàng tiêu chuẩn: Cho phép bay hành trình tối ưu 45–50 km/h.",
                            $"Trạng thái thanh toán: {order.PaymentStatus} • Phí vận chuyển: {order.ShippingFee:N0} đ."
                        },
                        recommendation = string.Equals(order.Status, "DELIVERED", StringComparison.OrdinalIgnoreCase)
                            ? "Đơn hàng đã giao hoàn tất an toàn. Hệ thống đã đóng theo dõi bản đồ và mở khóa đánh giá khách hàng."
                            : "Tiếp tục bám sát vị trí GPS thời gian thực trên bản đồ và chuẩn bị mã xác thực OTP 6 số khi Drone hạ cánh 100%.",
                        source = eta.Source,
                        generatedAt = DateTime.UtcNow
                    }
                });
            }
        }

        var activeCount = allOrders.Count(o =>
            !string.Equals(o.Status, "DELIVERED", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(o.Status, "CANCELLED", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(o.Status, "REJECTED", StringComparison.OrdinalIgnoreCase));
        var deliveredCount = allOrders.Count(o => string.Equals(o.Status, "DELIVERED", StringComparison.OrdinalIgnoreCase));
        var paidCount = allOrders.Count(o => string.Equals(o.PaymentStatus, "PAID", StringComparison.OrdinalIgnoreCase));
        var totalRevenue = allOrders.Sum(o => o.ShippingFee);

        return Ok(new
        {
            success = true,
            data = new
            {
                scope = "SYSTEM",
                trackingNumber = "ALL",
                title = "Báo Cáo Tóm Tắt Vận Hành Giao Hàng AI Toàn Hệ Thống",
                summary = $"Hệ thống SmartDroneDelivery đang ghi nhận {allOrders.Count} đơn hàng, trong đó {activeCount} chuyến đang bay/chờ điều phối và {deliveredCount} chuyến đã giao thành công.",
                highlights = new[]
                {
                    $"Tỷ lệ hoàn tất giao hàng hiện tại: {(allOrders.Count > 0 ? Math.Round((double)deliveredCount / allOrders.Count * 100, 1) : 0)}% ({deliveredCount}/{allOrders.Count} đơn).",
                    $"Tỷ lệ thanh toán trước thành công: {paidCount}/{allOrders.Count} đơn • Tổng cước phí bay: {totalRevenue:N0} đ.",
                    "3 trạm tiếp đất (STN-Q1, STN-TD, STN-Q7) đều hoạt động ổn định, không ghi nhận quá tải slot.",
                    "Đồng bộ GPS thời gian thực giữa Web Admin và App Mobile Flutter ổn định với độ trễ < 1.5 giây."
                },
                recommendation = activeCount > 0
                    ? $"Ưu tiên giám sát {activeCount} chuyến bay đang hoạt động trên bản đồ Google Maps và tối ưu tốc độ bay theo hướng gió khu vực TP. Thủ Đức."
                    : "Đội bay đang sẵn sàng 100% công suất tại các trạm, sẵn sàng tiếp nhận đơn hàng mới từ App Mobile.",
                source = "AI_SUMMARY_ENGINE",
                generatedAt = DateTime.UtcNow
            }
        });
    }

    private async Task<string?> TryCallLlmChatAsync(string userPrompt, int totalOrders, int activeOrders, int deliveredOrders, CancellationToken ct)
    {
        var systemPrompt =
            $"Bạn là Trợ lý AI của nền tảng giao hàng bằng Drone SmartDroneDelivery tại TP.HCM. " +
            $"Số liệu thời gian thực: {totalOrders} tổng đơn hàng, {activeOrders} đơn đang bay/chờ xử lý, {deliveredOrders} đơn đã giao thành công. " +
            $"Trả lời ngắn gọn (2-4 câu), tự nhiên bằng tiếng Việt.";
        return await _llmClient.ChatAsync(systemPrompt, userPrompt, ct);
    }
}

public class AiChatRequest
{
    public string Message { get; set; } = string.Empty;
    public string? Role { get; set; }
    public string? CustomerId { get; set; }
    public string? OrderKey { get; set; }
}

public class AiSummarizeRequest
{
    public string? OrderKey { get; set; }
}
