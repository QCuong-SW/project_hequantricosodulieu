using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Api.Filters;
using SmartDroneDelivery.Api.Middlewares;

namespace SmartDroneDelivery.Api.Extensions;

public static class ApiResponseExtensions
{
    /// <summary>Bọc mọi kết quả của controller trong khung ApiResponse.</summary>
    public static IServiceCollection AddApiResponseWrapping(this IServiceCollection services)
    {
        services.Configure<MvcOptions>(options => options.Filters.Add<ApiResponseWrapperFilter>());
        return services;
    }

    /// <summary>
    /// Bắt exception toàn cục và đổi các phản hồi lỗi rỗng (vd 404 do sai đường dẫn) sang khung ApiResponse.
    /// Phải đặt đầu tiên trong pipeline.
    /// </summary>
    public static IApplicationBuilder UseApiResponseHandling(this IApplicationBuilder app)
    {
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        app.UseStatusCodePages(context =>
            ApiResponseWriter.WriteAsync(context.HttpContext, context.HttpContext.Response.StatusCode));
        return app;
    }
}