using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Features.Identity;
using SmartDroneDelivery.Infrastructure.Persistence;

namespace SmartDroneDelivery.Api.Controllers;

public class AdminUserItem
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public string Role { get; set; } = "CUSTOMER";
    public List<string> Roles { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CreateUserAdminRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "CUSTOMER";
}

public class UpdateUserStatusRequest
{
    public string Status { get; set; } = "ACTIVE";
}

[ApiController]
[Route("api/auth")]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly SmartDroneDbContext _db;
    private static readonly ConcurrentDictionary<string, AdminUserItem> RuntimeUsers = SeedInitialUsers();

    public AuthController(IAuthService auth, SmartDroneDbContext db)
    {
        _auth = auth;
        _db = db;
    }

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

    /// <summary>Đăng ký tài khoản người dùng mới (ROLE: CUSTOMER) với không gian dữ liệu riêng biệt.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var result = await _auth.RegisterAsync(request, GetClientIp(), ct);
        if (!result.Success)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Đăng ký thất bại",
                Detail = result.Error
            });
        }

        if (result.Data?.User != null)
        {
            var u = result.Data.User;
            RuntimeUsers[u.UserId.ToString()] = new AdminUserItem
            {
                Id = u.UserId.ToString(),
                Email = u.Email,
                FullName = u.FullName,
                Phone = request.Phone,
                Status = "ACTIVE",
                Role = "CUSTOMER",
                Roles = new List<string> { "CUSTOMER" },
                CreatedAt = DateTime.UtcNow
            };
        }

        return Ok(result.Data);
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

    /// <summary>Danh sách người dùng và vai trò trong hệ thống.</summary>
    [HttpGet("users")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        try
        {
            var dbUsers = await _db.Users
                .AsNoTracking()
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .ToListAsync(ct);

            if (dbUsers.Count > 0)
            {
                var response = dbUsers.Select(u => new AdminUserItem
                {
                    Id = u.UserId.ToString(),
                    Email = u.Email,
                    FullName = u.FullName,
                    Phone = u.Phone,
                    Status = u.Status,
                    Role = u.UserRoles.Select(ur => ur.Role.RoleName).FirstOrDefault() ?? "CUSTOMER",
                    Roles = u.UserRoles.Select(ur => ur.Role.RoleName).ToList(),
                    CreatedAt = u.CreatedAt
                }).ToList();

                // Merge in any newly created in-memory accounts not in db
                foreach (var runtimeUser in RuntimeUsers.Values)
                {
                    if (!response.Any(r => r.Email.Equals(runtimeUser.Email, StringComparison.OrdinalIgnoreCase)))
                    {
                        response.Add(runtimeUser);
                    }
                }

                return Ok(response.OrderByDescending(u => u.CreatedAt).ToList());
            }
        }
        catch
        {
            // Fallback sang tài khoản runtime khi SQL Server chưa chạy
        }

        return Ok(RuntimeUsers.Values.OrderByDescending(u => u.CreatedAt).ToList());
    }

    /// <summary>Tạo mới người dùng và phân quyền RBAC.</summary>
    [HttpPost("users")]
    [AllowAnonymous]
    public IActionResult CreateUser([FromBody] CreateUserAdminRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { success = false, message = "Họ tên và Email là bắt buộc." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (RuntimeUsers.Values.Any(u => u.Email.Equals(normalizedEmail, StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(new { success = false, message = $"Email '{normalizedEmail}' đã tồn tại trong hệ thống." });
        }

        var role = string.IsNullOrWhiteSpace(request.Role) ? "CUSTOMER" : request.Role.Trim().ToUpperInvariant();
        var newUser = new AdminUserItem
        {
            Id = Guid.NewGuid().ToString(),
            Email = normalizedEmail,
            FullName = request.FullName.Trim(),
            Phone = request.Phone?.Trim() ?? string.Empty,
            Status = "ACTIVE",
            Role = role,
            Roles = new List<string> { role },
            CreatedAt = DateTime.UtcNow
        };

        RuntimeUsers[newUser.Id] = newUser;

        return CreatedAtAction(
            nameof(GetUsers),
            new { id = newUser.Id },
            new
            {
                success = true,
                message = $"Tạo tài khoản người dùng '{newUser.Email}' thành công.",
                data = newUser
            });
    }

    /// <summary>Cập nhật trạng thái người dùng (ACTIVE / LOCKED).</summary>
    [HttpPatch("users/{id}/status")]
    [AllowAnonymous]
    public IActionResult UpdateUserStatus(string id, [FromBody] UpdateUserStatusRequest request)
    {
        var targetUser = RuntimeUsers.Values.FirstOrDefault(u =>
            u.Id.Equals(id, StringComparison.OrdinalIgnoreCase) ||
            u.Email.Equals(id, StringComparison.OrdinalIgnoreCase));

        if (targetUser == null)
        {
            return NotFound(new { success = false, message = $"Không tìm thấy người dùng với ID/Email: {id}" });
        }

        targetUser.Status = string.IsNullOrWhiteSpace(request.Status) ? "ACTIVE" : request.Status.Trim().ToUpperInvariant();

        return Ok(new
        {
            success = true,
            message = $"Tài khoản {targetUser.Email} đã được chuyển sang trạng thái {targetUser.Status}.",
            data = targetUser
        });
    }

    private static ConcurrentDictionary<string, AdminUserItem> SeedInitialUsers()
    {
        var dict = new ConcurrentDictionary<string, AdminUserItem>();
        var defaults = new[]
        {
            new AdminUserItem { Id = "11111111-1111-1111-1111-111111111001", Email = "admin@smartdrone.vn", FullName = "Quản trị viên Hệ Thống", Phone = "0900000001", Status = "ACTIVE", Role = "ADMIN", Roles = new List<string> { "ADMIN" }, CreatedAt = DateTime.UtcNow.AddDays(-30) },
            new AdminUserItem { Id = "11111111-1111-1111-1111-111111111002", Email = "dispatcher@smartdrone.vn", FullName = "Điều phối viên Chuyến Bay", Phone = "0900000002", Status = "ACTIVE", Role = "DISPATCHER", Roles = new List<string> { "DISPATCHER" }, CreatedAt = DateTime.UtcNow.AddDays(-28) },
            new AdminUserItem { Id = "11111111-1111-1111-1111-111111111003", Email = "operator@smartdrone.vn", FullName = "Nhân viên Bãi Đáp Trạm", Phone = "0900000003", Status = "ACTIVE", Role = "STATION_OPERATOR", Roles = new List<string> { "STATION_OPERATOR" }, CreatedAt = DateTime.UtcNow.AddDays(-25) },
            new AdminUserItem { Id = "11111111-1111-1111-1111-111111111004", Email = "manager@smartdrone.vn", FullName = "Quản lý Logistics Vận Hành", Phone = "0900000004", Status = "ACTIVE", Role = "LOGISTICS_MANAGER", Roles = new List<string> { "LOGISTICS_MANAGER" }, CreatedAt = DateTime.UtcNow.AddDays(-20) },
            new AdminUserItem { Id = "11111111-1111-1111-1111-111111111005", Email = "customer@smartdrone.vn", FullName = "Nguyễn Văn An (Khách hàng A)", Phone = "0900000005", Status = "ACTIVE", Role = "CUSTOMER", Roles = new List<string> { "CUSTOMER" }, CreatedAt = DateTime.UtcNow.AddDays(-15) },
            new AdminUserItem { Id = "11111111-1111-1111-1111-111111111006", Email = "customer2@smartdrone.vn", FullName = "Trần Thị Bích (Khách hàng B)", Phone = "0900000006", Status = "ACTIVE", Role = "CUSTOMER", Roles = new List<string> { "CUSTOMER" }, CreatedAt = DateTime.UtcNow.AddDays(-10) },
        };

        foreach (var u in defaults)
            dict[u.Id] = u;

        return dict;
    }

    /// <summary>Lịch sử nhật ký kiểm toán (Audit Logs).</summary>
    [HttpGet("audit-logs")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAuditLogs(CancellationToken ct)
    {
        try
        {
            var logs = await _db.AuditLogs
                .AsNoTracking()
                .OrderByDescending(a => a.CreatedAt)
                .Take(50)
                .ToListAsync(ct);

            if (logs.Count > 0)
            {
                return Ok(logs);
            }
        }
        catch
        {
            // Fallback sang nhật ký mẫu
        }

        var sampleLogs = new[]
        {
            new { auditLogId = Guid.NewGuid(), action = "LOGIN_SUCCESS", userEmail = "admin@smartdrone.vn", entityName = "Auth", entityId = "SESSION", ipAddress = "127.0.0.1", createdAt = DateTime.UtcNow.AddMinutes(-5), detail = "Đăng nhập thành công với vai trò ADMIN" },
            new { auditLogId = Guid.NewGuid(), action = "ORDER_APPROVED", userEmail = "dispatcher@smartdrone.vn", entityName = "DeliveryOrder", entityId = "SDD-20261118-754642", ipAddress = "127.0.0.1", createdAt = DateTime.UtcNow.AddMinutes(-12), detail = "Duyệt đơn hàng và kiểm tra tải trọng kiện" },
            new { auditLogId = Guid.NewGuid(), action = "FLIGHT_SCHEDULED", userEmail = "dispatcher@smartdrone.vn", entityName = "FlightSchedule", entityId = "FLT-20261118-101003", ipAddress = "127.0.0.1", createdAt = DateTime.UtcNow.AddMinutes(-25), detail = "Phân bổ Drone DRN-003 cho lộ trình STN-Q1 -> STN-TD" },
            new { auditLogId = Guid.NewGuid(), action = "HANDOFF_SCAN", userEmail = "operator@smartdrone.vn", entityName = "StationSlot", entityId = "STN-Q1", ipAddress = "127.0.0.1", createdAt = DateTime.UtcNow.AddMinutes(-40), detail = "Quét mã kiện hàng tại bãi đáp STATION_RECEIVED" },
            new { auditLogId = Guid.NewGuid(), action = "TOKEN_REFRESH", userEmail = "customer@smartdrone.vn", entityName = "RefreshToken", entityId = "AUTH", ipAddress = "127.0.0.1", createdAt = DateTime.UtcNow.AddHours(-1), detail = "Gia hạn phiên làm việc JWT an toàn" },
        };

        return Ok(sampleLogs);
    }

    private string? GetClientIp() => HttpContext.Connection.RemoteIpAddress?.ToString();

    private static ProblemDetails Problem401(string? detail) => new()
    {
        Status = StatusCodes.Status401Unauthorized,
        Title = "Xác thực thất bại",
        Detail = detail
    };
}
