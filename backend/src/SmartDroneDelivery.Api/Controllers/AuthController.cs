using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Identity;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    /// <summary>Đăng nhập bằng email + mật khẩu, nhận access token và refresh token.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await _auth.LoginAsync(request, GetClientIp(), ct);
        return result.Success ? Ok(result.Data) : Unauthorized(Problem401(result.Error));
    }

    /// <summary>Đổi refresh token lấy cặp token mới (refresh token cũ bị thu hồi).</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        var result = await _auth.RefreshTokenAsync(request, GetClientIp(), ct);
        return result.Success ? Ok(result.Data) : Unauthorized(Problem401(result.Error));
    }

    /// <summary>Trả về thông tin lấy từ access token, dùng để kiểm tra token và role.</summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() => Ok(new
    {
        userId = User.FindFirst("sub")?.Value,
        email = User.FindFirst("email")?.Value,
        fullName = User.FindFirst("full_name")?.Value,
        roles = User.FindAll("role").Select(c => c.Value).ToList()
    });

    private string? GetClientIp() => HttpContext.Connection.RemoteIpAddress?.ToString();

    private static ProblemDetails Problem401(string? detail) => new()
    {
        Status = StatusCodes.Status401Unauthorized,
        Title = "Xác thực thất bại",
        Detail = detail
    };
}