using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Common.Exceptions;
using SmartDroneDelivery.Application.Common.Models;

namespace SmartDroneDelivery.Api.Middlewares;

/// <summary>
/// Bắt mọi exception chưa được xử lý và trả về khung ApiResponse thống nhất.
/// Lỗi 500 không để lộ chi tiết ra ngoài (chỉ hiện khi chạy ở môi trường Development).
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex) when (ex is not OperationCanceledException && !context.Response.HasStarted)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception ex)
    {
        int status;
        string message;
        IReadOnlyList<ApiError>? errors = null;

        switch (ex)
        {
            case ValidationFailedException validation:
                status = StatusCodes.Status400BadRequest;
                message = validation.Message;
                errors = validation.Errors;
                break;

            case NotFoundException:
                status = StatusCodes.Status404NotFound;
                message = ex.Message;
                break;

            case ConflictException:
                status = StatusCodes.Status409Conflict;
                message = ex.Message;
                break;

            case ForbiddenException:
                status = StatusCodes.Status403Forbidden;
                message = ex.Message;
                break;

            case DbUpdateConcurrencyException:
                status = StatusCodes.Status409Conflict;
                message = "Dữ liệu đã bị người khác thay đổi, vui lòng tải lại rồi thử lại.";
                break;

            case BadHttpRequestException:
                status = StatusCodes.Status400BadRequest;
                message = "Yêu cầu không hợp lệ.";
                break;

            default:
                status = StatusCodes.Status500InternalServerError;
                message = ApiResponseWriter.DefaultMessage(status);
                if (_environment.IsDevelopment())
                    errors = new[] { new ApiError { Field = ex.GetType().Name, Message = ex.Message } };
                break;
        }

        if (status >= 500)
            _logger.LogError(ex, "Lỗi không mong đợi khi xử lý {Method} {Path}", context.Request.Method, context.Request.Path);
        else
            _logger.LogWarning("{Type} khi xử lý {Method} {Path}: {Message}",
                ex.GetType().Name, context.Request.Method, context.Request.Path, ex.Message);

        await ApiResponseWriter.WriteAsync(context, status, message, errors);
    }
}