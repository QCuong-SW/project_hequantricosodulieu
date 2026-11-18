using SmartDroneDelivery.Application.Common.Models;

namespace SmartDroneDelivery.Application.Common.Exceptions;

/// <summary>
/// Các lỗi nghiệp vụ có thể ném ở bất cứ tầng nào. ExceptionHandlingMiddleware sẽ đổi chúng
/// thành mã HTTP tương ứng:
///   ValidationFailedException -> 400, ForbiddenException -> 403,
///   NotFoundException -> 404, ConflictException -> 409.
/// </summary>
public abstract class AppException : Exception
{
    protected AppException(string message) : base(message)
    {
    }
}

public sealed class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message)
    {
    }

    public NotFoundException(string entity, object key)
        : base($"Không tìm thấy {entity} với mã '{key}'.")
    {
    }
}

public sealed class ConflictException : AppException
{
    public ConflictException(string message) : base(message)
    {
    }
}

public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string message) : base(message)
    {
    }
}

public sealed class ValidationFailedException : AppException
{
    public IReadOnlyList<ApiError> Errors { get; }

    public ValidationFailedException(IEnumerable<ApiError> errors)
        : base("Dữ liệu yêu cầu không hợp lệ.")
    {
        Errors = errors.ToList();
    }

    public ValidationFailedException(string field, string message)
        : this(new[] { new ApiError { Field = field, Message = message } })
    {
    }
}