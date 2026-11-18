using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using SmartDroneDelivery.Api.Authorization;
using SmartDroneDelivery.Api.Middlewares;
using SmartDroneDelivery.Infrastructure.Auth;

namespace SmartDroneDelivery.Api.Extensions;

public static class AuthServiceCollectionExtensions
{
    /// <summary>Kiểm tra JWT Bearer trên mọi request có header Authorization.</summary>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? new JwtSettings();

        var keyBytes = Encoding.UTF8.GetBytes(jwt.Secret);
        if (keyBytes.Length < 32)
            throw new InvalidOperationException("Jwt:Secret phải có ít nhất 32 ký tự.");

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                // Giữ nguyên tên claim trong token ("sub", "email", "role"), không đổi sang URI của Microsoft
                options.MapInboundClaims = false;

                // SignalR/WebSocket trên trình duyệt không gửi được header Authorization,
                // nên token đi theo ?access_token=... và chỉ được chấp nhận cho đường dẫn /hubs
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(accessToken) &&
                            context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }

                        return Task.CompletedTask;
                    }
                };

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = "email",
                    RoleClaimType = "role"
                };
            });

        return services;
    }

    /// <summary>Đăng ký các policy theo role và bộ trả lỗi 401/403 dạng JSON.</summary>
    public static IServiceCollection AddRoleAuthorization(this IServiceCollection services)
    {
        services.AddAuthorization(AuthorizationPolicies.Configure);
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ApiAuthorizationResultHandler>();
        return services;
    }
}