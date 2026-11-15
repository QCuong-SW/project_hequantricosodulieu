using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Mvc;

namespace SmartDroneDelivery.Api.Middlewares;

/// <summary>
/// Trả lỗi 401 (chưa đăng nhập / token sai hoặc hết hạn) và 403 (không đủ quyền)
/// dưới dạng ProblemDetails JSON thống nhất, thay cho phản hồi rỗng mặc định.
/// </summary>
public sealed class ApiAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly AuthorizationMiddlewareResultHandler _default = new();

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Challenged)
        {
            await WriteProblemAsync(context, StatusCodes.Status401Unauthorized,
                "Chưa xác thực", "Bạn cần đăng nhập hoặc access token đã hết hạn.");
            return;
        }

        if (authorizeResult.Forbidden)
        {
            await WriteProblemAsync(context, StatusCodes.Status403Forbidden,
                "Không đủ quyền", "Tài khoản của bạn không có quyền thực hiện thao tác này.");
            return;
        }

        await _default.HandleAsync(next, context, policy, authorizeResult);
    }

    private static async Task WriteProblemAsync(HttpContext context, int status, string title, string detail)
    {
        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail };

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(problem, JsonOptions));
    }
}