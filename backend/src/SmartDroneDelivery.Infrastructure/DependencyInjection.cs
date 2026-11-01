using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartDroneDelivery.Application.Common.Interfaces;
using SmartDroneDelivery.Application.Features.Identity;
using SmartDroneDelivery.Infrastructure.Auth;
using SmartDroneDelivery.Infrastructure.Persistence;

namespace SmartDroneDelivery.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // ===== [w2-04] DbContext + chuỗi kết nối SQL Server =====
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Thiếu ConnectionStrings:DefaultConnection trong cấu hình.");

        services.AddDbContext<SmartDroneDbContext>(options =>
            options.UseSqlServer(connectionString)
                   .UseSnakeCaseNamingConvention());

        // ===== [w2-05] Băm mật khẩu bằng BCrypt =====
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();

        // ===== [w2-06] JWT token provider =====
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        // ===== [w2-07] Dịch vụ đăng nhập / refresh token =====
        services.AddScoped<IAuthService, AuthService>();

        return services;
    }
}
// Đăng ký các service liên quan đến Customer Address của bạn ở đây
services.AddScoped<ICustomerAddressRepository, CustomerAddressRepository>();