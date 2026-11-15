// backend/src/SmartDroneDelivery.Infrastructure/Ai/FallbackRuleBasedService.cs
using SmartDroneDelivery.Application.Features.AiServices;

namespace SmartDroneDelivery.Infrastructure.Ai;

/// <summary>
/// Tính ETA bằng công thức vật lý đơn giản (không cần mạng):
/// thời gian = quãng đường / tốc độ + thời gian cất/hạ cánh.
/// </summary>
public class FallbackRuleBasedService : IEtaService
{
    private const double CruiseSpeedKmh = 40;   // tốc độ bay hành trình giả định (drone tối đa 60 km/h)
    private const int OverheadMinutes = 4;      // cất cánh + hạ cánh + dự phòng

    public Task<EtaResult> PredictAsync(EtaRequest request, CancellationToken ct = default)
    {
        var distanceKm = GeoMath.HaversineKm(request.FromLat, request.FromLng, request.ToLat, request.ToLng);

        // Gió ngược làm chậm drone nhưng không để tốc độ xuống dưới 50% tốc độ hành trình
        var speed = Math.Max(CruiseSpeedKmh - (request.WindSpeedKmh ?? 0), CruiseSpeedKmh * 0.5);
        var minutes = (int)Math.Ceiling(distanceKm / speed * 60) + OverheadMinutes;

        return Task.FromResult(new EtaResult(
            minutes, "FALLBACK",
            $"Công thức: {distanceKm:F2} km / {speed:F0} km/h + {OverheadMinutes} phút cất/hạ cánh."));
    }
}
