// backend/src/SmartDroneDelivery.Application/Features/AiServices/EtaContracts.cs
namespace SmartDroneDelivery.Application.Features.AiServices;

/// <summary>Đầu vào dự đoán ETA: tọa độ điểm đi/đến (độ) và tốc độ gió (km/h, tùy chọn).</summary>
public record EtaRequest(
    double FromLat, double FromLng,
    double ToLat, double ToLng,
    double? WindSpeedKmh = null);

/// <summary>Kết quả ETA. Source = "LLM" hoặc "FALLBACK".</summary>
public record EtaResult(int Minutes, string Source, string? Note = null);

/// <summary>Dịch vụ dự đoán ETA mà phần còn lại của hệ thống sử dụng.</summary>
public interface IEtaService
{
    Task<EtaResult> PredictAsync(EtaRequest request, CancellationToken ct = default);
}

/// <summary>Client gọi mô hình ngôn ngữ (LLM). Trả về số phút dự đoán hoặc nội dung hội thoại.</summary>
public interface ILlmEtaClient
{
    Task<int> PredictMinutesAsync(EtaRequest request, CancellationToken ct);
    Task<string> ChatAsync(string systemPrompt, string userPrompt, CancellationToken ct);
}

/// <summary>LLM không dùng được (thiếu API key, phản hồi sai định dạng...). Dịch vụ ETA sẽ chuyển sang fallback.</summary>
public class LlmUnavailableException : Exception
{
    public LlmUnavailableException(string message, Exception? inner = null) : base(message, inner) { }
}
