using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.WebUtilities;
using SmartDroneDelivery.Api.Middlewares;
using SmartDroneDelivery.Application.Common.Models;

namespace SmartDroneDelivery.Api.Filters;

/// <summary>
/// Tự động bọc kết quả của mọi action trong khung ApiResponse, nên controller cứ trả Ok(data),
/// NotFound(), BadRequest(...) như bình thường.
///  - Kết quả đã là ApiResponse thì giữ nguyên.
///  - 204 No Content giữ nguyên (không có body, theo quy ước).
///  - ProblemDetails / lỗi kiểm tra dữ liệu được đổi thành message và errors theo trường.
/// </summary>
public sealed class ApiResponseWrapperFilter : IAlwaysRunResultFilter
{
    public void OnResultExecuting(ResultExecutingContext context)
    {
        switch (context.Result)
        {
            case ObjectResult { Value: IApiResponse }:
            case ObjectResult { StatusCode: StatusCodes.Status204NoContent }:
                return;

            case ObjectResult objectResult:
            {
                var status = objectResult.StatusCode ?? StatusCodes.Status200OK;
                objectResult.Value = Wrap(status, objectResult.Value);
                objectResult.DeclaredType = null;   // tránh serialize theo kiểu khai báo cũ
                objectResult.ContentTypes.Clear();  // bỏ application/problem+json, dùng application/json
                objectResult.StatusCode = status;
                return;
            }

            case StatusCodeResult statusCodeResult when statusCodeResult.StatusCode != StatusCodes.Status204NoContent:
                context.Result = new ObjectResult(Wrap(statusCodeResult.StatusCode, null))
                {
                    StatusCode = statusCodeResult.StatusCode
                };
                return;
        }
    }

    public void OnResultExecuted(ResultExecutedContext context)
    {
    }

    private static ApiResponse<object> Wrap(int status, object? value)
    {
        if (status is >= 200 and < 300)
            return ApiResponse.Ok<object>(value, null, status);

        switch (value)
        {
            case ValidationProblemDetails validation:
                return ApiResponse.Fail(status, "Dữ liệu yêu cầu không hợp lệ.", FromDictionary(validation.Errors));

            case ProblemDetails problem:
                return ApiResponse.Fail(status, PickMessage(problem, status));

            case SerializableError serializable:
                return ApiResponse.Fail(status, "Dữ liệu yêu cầu không hợp lệ.", FromSerializableError(serializable));

            case string text:
                return ApiResponse.Fail(status, text);

            case null:
                return ApiResponse.Fail(status, ApiResponseWriter.DefaultMessage(status));

            default:
                // Kiểu lạ do controller tự định nghĩa: giữ lại trong data để không mất thông tin
                return ApiResponse.Fail(status, ApiResponseWriter.DefaultMessage(status), data: value);
        }
    }

    // Ưu tiên Detail. Title chuẩn tiếng Anh do ASP.NET tự sinh (vd "Not Found") được thay bằng thông báo tiếng Việt.
    private static string PickMessage(ProblemDetails problem, int status)
    {
        if (!string.IsNullOrWhiteSpace(problem.Detail))
            return problem.Detail;

        var isStandardTitle = string.IsNullOrWhiteSpace(problem.Title)
            || string.Equals(problem.Title, ReasonPhrases.GetReasonPhrase(status), StringComparison.OrdinalIgnoreCase);

        return isStandardTitle ? ApiResponseWriter.DefaultMessage(status) : problem.Title!;
    }

    private static List<ApiError> FromDictionary(IDictionary<string, string[]> errors) =>
        errors
            .SelectMany(pair => pair.Value.Select(message => new ApiError
            {
                Field = ApiResponseWriter.NormalizeField(pair.Key),
                Message = message
            }))
            .ToList();

    private static List<ApiError> FromSerializableError(SerializableError error)
    {
        var result = new List<ApiError>();
        foreach (var pair in error)
        {
            var messages = pair.Value is string[] array ? array : new[] { pair.Value?.ToString() ?? string.Empty };
            foreach (var message in messages)
                result.Add(new ApiError { Field = ApiResponseWriter.NormalizeField(pair.Key), Message = message });
        }
        return result;
    }
}