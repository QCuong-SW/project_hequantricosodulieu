// backend/src/SmartDroneDelivery.Infrastructure/Ai/LlmClient.cs
using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using SmartDroneDelivery.Application.Features.AiServices;

namespace SmartDroneDelivery.Infrastructure.Ai;

/// <summary>
/// Gọi LLM qua API dạng OpenAI Chat Completions để ước tính ETA (phút).
/// Mọi lỗi (thiếu key, mạng, HTTP lỗi, phản hồi lạ) đều được ném ra để
/// <see cref="EtaPredictionService"/> bắt và chuyển sang công thức fallback.
/// </summary>
public class LlmClient : ILlmEtaClient
{
    private const string SystemPrompt =
        "Bạn là hệ thống ước tính thời gian giao hàng bằng drone. " +
        "Chỉ trả lời bằng MỘT số nguyên là số phút, không kèm chữ hay giải thích.";

    private readonly HttpClient _http;
    private readonly LlmOptions _options;

    public LlmClient(HttpClient http, IOptions<LlmOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public async Task<int> PredictMinutesAsync(EtaRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new LlmUnavailableException("Chưa cấu hình Ai:Llm:ApiKey.");

        var distanceKm = GeoMath.HaversineKm(request.FromLat, request.FromLng, request.ToLat, request.ToLng);
        var wind = request.WindSpeedKmh ?? 0;
        var userPrompt = string.Create(CultureInfo.InvariantCulture,
            $"Quãng đường bay thẳng: {distanceKm:F2} km. Tốc độ gió ngược: {wind:F0} km/h. ") +
            "Drone bay tối đa 60 km/h, mất khoảng 4 phút cất cánh và hạ cánh. " +
            "Ước tính tổng thời gian giao hàng (phút).";

        var body = new
        {
            model = _options.Model,
            messages = new[]
            {
                new { role = "system", content = SystemPrompt },
                new { role = "user",   content = userPrompt }
            }
        };

        using var response = await _http.PostAsJsonAsync("chat/completions", body, ct);
        response.EnsureSuccessStatusCode();   // 4xx/5xx -> HttpRequestException -> fallback

        var json = await response.Content.ReadAsStringAsync(ct);
        string? content;
        try
        {
            using var doc = JsonDocument.Parse(json);
            content = doc.RootElement.GetProperty("choices")[0]
                         .GetProperty("message").GetProperty("content").GetString();
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            throw new LlmUnavailableException("Phản hồi LLM không đúng định dạng.", ex);
        }

        var match = Regex.Match(content ?? string.Empty, @"\d+");
        if (!match.Success || !int.TryParse(match.Value, NumberStyles.None, CultureInfo.InvariantCulture, out var minutes))
            throw new LlmUnavailableException("LLM không trả về số phút hợp lệ.");

        return minutes;
    }
}
