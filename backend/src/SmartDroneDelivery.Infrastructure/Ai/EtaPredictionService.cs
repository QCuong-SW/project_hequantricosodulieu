// backend/src/SmartDroneDelivery.Infrastructure/Ai/EtaPredictionService.cs
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SmartDroneDelivery.Application.Features.AiServices;

namespace SmartDroneDelivery.Infrastructure.Ai;

/// <summary>Thử LLM trước; lỗi mạng / timeout / thiếu key / kết quả vô lý thì tự động dùng fallback.</summary>
public class EtaPredictionService : IEtaService
{
    private static readonly TimeSpan LlmTimeout = TimeSpan.FromSeconds(5);
    private const int MaxReasonableMinutes = 240;

    private readonly ILlmEtaClient _llm;
    private readonly FallbackRuleBasedService _fallback;
    private readonly ILogger<EtaPredictionService> _logger;

    public EtaPredictionService(
        ILlmEtaClient llm,
        FallbackRuleBasedService fallback,
        ILogger<EtaPredictionService> logger)
    {
        _llm = llm;
        _fallback = fallback;
        _logger = logger;
    }

    public async Task<EtaResult> PredictAsync(EtaRequest request, CancellationToken ct = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(LlmTimeout);

            var minutes = await _llm.PredictMinutesAsync(request, cts.Token);

            if (minutes is > 0 and <= MaxReasonableMinutes)
                return new EtaResult(minutes, "LLM");

            _logger.LogWarning("LLM trả ETA không hợp lý: {Minutes} phút. Dùng fallback.", minutes);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException
                                      or OperationCanceledException or JsonException
                                      or FormatException or LlmUnavailableException)
        {
            if (ct.IsCancellationRequested) throw;   // người gọi chủ động hủy thì không nuốt
            _logger.LogWarning(ex, "Gọi LLM thất bại. Dùng fallback.");
        }

        return await _fallback.PredictAsync(request, ct);
    }
}
