using System.Text.Encodings.Web;
using System.Text.Json;
using SmartDroneDelivery.Application.Common.Models;

namespace SmartDroneDelivery.Api.Middlewares;

/// <summary>Ghi phản hồi lỗi theo khung ApiResponse trực tiếp ra HttpResponse (dùng ngoài MVC).</summary>
public static class ApiResponseWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        // Giữ nguyên ký tự tiếng Việt thay vì mã hóa thành \uXXXX (giống phản hồi do MVC tạo ra)
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static string DefaultMessage(int status) => status switch
    {
        StatusCodes.Status400BadRequest => "Yêu cầu không hợp lệ.",
        StatusCodes.Status401Unauthorized => "Chưa xác thực hoặc token không hợp lệ.",
        StatusCodes.Status403Forbidden => "Không đủ quyền thực hiện thao tác này.",
        StatusCodes.Status404NotFound => "Không tìm thấy tài nguyên.",
        StatusCodes.Status405MethodNotAllowed => "Phương thức không được hỗ trợ.",
        StatusCodes.Status409Conflict => "Xung đột trạng thái dữ liệu.",
        >= 500 => "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
        _ => "Yêu cầu không thành công."
    };

    /// <summary>Đổi tên trường về camelCase, bỏ tiền tố "$." của lỗi đọc JSON.</summary>
    public static string NormalizeField(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key == "$")
            return string.Empty;

        var path = key.StartsWith("$.", StringComparison.Ordinal) ? key[2..] : key;
        var parts = path.Split('.').Select(p => p.Length > 0 ? char.ToLowerInvariant(p[0]) + p[1..] : p);
        return string.Join('.', parts);
    }

    public static Task WriteAsync(
        HttpContext context,
        int statusCode,
        string? message = null,
        IReadOnlyList<ApiError>? errors = null)
    {
        var body = ApiResponse.Fail(statusCode, message ?? DefaultMessage(statusCode), errors);

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        return context.Response.WriteAsync(JsonSerializer.Serialize(body, JsonOptions));
    }
}