namespace SmartDroneDelivery.Api.Extensions;

public static class CorsExtensions
{
    public const string PolicyName = "WebClient";

    /// <summary>
    /// Cho phép web React (Vite) gọi API từ trình duyệt. Luôn có http://localhost:5173 và
    /// http://127.0.0.1:5173; thêm origin khác (vd Flutter web) bằng cấu hình Cors:AllowedOrigins (mảng).
    /// AllowCredentials cần cho SignalR. Ứng dụng Flutter chạy native không bị CORS nên không cần cấu hình.
    /// </summary>
    public static IServiceCollection AddWebClientCors(this IServiceCollection services, IConfiguration configuration)
    {
        var configured = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

        var origins = new[] { "http://localhost:5173", "http://127.0.0.1:5173" }
            .Concat(configured)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        services.AddCors(options => options.AddPolicy(PolicyName, policy =>
            policy.WithOrigins(origins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials()));

        return services;
    }
}