using SmartDroneDelivery.Application.Common.Interfaces;

namespace SmartDroneDelivery.Api.Services;

/// <summary>Đọc người dùng hiện tại từ JWT của request đang xử lý.</summary>
public sealed class HttpCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public HttpCurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    public int? UserId
    {
        get
        {
            var value = _accessor.HttpContext?.User.FindFirst("sub")?.Value;
            return int.TryParse(value, out var id) ? id : null;
        }
    }

    public string? Email => _accessor.HttpContext?.User.FindFirst("email")?.Value;

    public string? IpAddress => _accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}
