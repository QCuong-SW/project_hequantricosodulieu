// backend/src/SmartDroneDelivery.Infrastructure/Ai/AiServiceCollectionExtensions.cs
using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartDroneDelivery.Application.Features.AiServices;

namespace SmartDroneDelivery.Infrastructure.Ai;

public static class AiServiceCollectionExtensions
{
    /// <summary>
    /// Đăng ký dịch vụ ETA. Thêm 1 dòng vào Program.cs:
    /// builder.Services.AddAiServices(builder.Configuration);
    /// </summary>
    public static IServiceCollection AddAiServices(this IServiceCollection services, IConfiguration config)
    {
        var section = config.GetSection(LlmOptions.SectionName);
        services.Configure<LlmOptions>(section);
        var options = section.Get<LlmOptions>() ?? new LlmOptions();

        services.AddHttpClient<ILlmEtaClient, LlmClient>(client =>
        {
            client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            if (!string.IsNullOrWhiteSpace(options.ApiKey))
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        });

        services.AddSingleton<FallbackRuleBasedService>();
        services.AddScoped<IEtaService, EtaPredictionService>();
        return services;
    }
}
