namespace SmartDroneDelivery.Application.Common.Models;

/// <summary>Một lỗi gắn với một trường dữ liệu (theo docs/api/api-conventions.md).</summary>
public sealed class ApiError
{
    public string Field { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}

/// <summary>Dấu hiệu nhận biết phản hồi đã được bọc sẵn, để không bọc hai lần.</summary>
public interface IApiResponse
{
}

/// <summary>Khung phản hồi thống nhất cho mọi API.</summary>
public sealed class ApiResponse<T> : IApiResponse
{
    public bool Success { get; init; }
    public int StatusCode { get; init; }
    public string? Message { get; init; }
    public T? Data { get; init; }
    public IReadOnlyList<ApiError>? Errors { get; init; }
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T? data, string? message = null, int statusCode = 200) => new()
    {
        Success = true,
        StatusCode = statusCode,
        Message = message,
        Data = data
    };

    public static ApiResponse<object> Fail(
        int statusCode,
        string message,
        IReadOnlyList<ApiError>? errors = null,
        object? data = null) => new()
    {
        Success = false,
        StatusCode = statusCode,
        Message = message,
        Errors = errors,
        Data = data
    };
}