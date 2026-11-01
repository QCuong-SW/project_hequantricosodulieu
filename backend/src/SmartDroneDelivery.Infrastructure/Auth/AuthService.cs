using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Common.Interfaces;
using SmartDroneDelivery.Application.Features.Identity;
using SmartDroneDelivery.Domain.Entities.Identity;
using SmartDroneDelivery.Infrastructure.Persistence;

namespace SmartDroneDelivery.Infrastructure.Auth;

public sealed class AuthService : IAuthService
{
    private const string InvalidCredentials = "Email hoặc mật khẩu không đúng.";
    private const string InactiveAccount = "Tài khoản không ở trạng thái hoạt động.";
    private const string InvalidRefreshToken = "Refresh token không hợp lệ hoặc đã hết hạn.";

    private readonly SmartDroneDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _tokens;

    public AuthService(SmartDroneDbContext db, IPasswordHasher hasher, IJwtTokenService tokens)
    {
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
    }

    // ------------------------------------------------------------------ LOGIN
    public async Task<AuthResult> LoginAsync(LoginRequest request, string? ipAddress, CancellationToken ct = default)
    {
        var email = request.Email.Trim();

        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        // Cùng một thông báo cho "sai email" và "sai mật khẩu" để không lộ email nào tồn tại
        if (user is null || !_hasher.Verify(request.Password, user.PasswordHash))
        {
            AddAudit(user?.UserId, email, "LoginFailed", ipAddress, new { reason = "invalid_credentials" });
            await _db.SaveChangesAsync(ct);
            return AuthResult.Fail(InvalidCredentials);
        }

        if (user.Status != UserStatuses.Active)
        {
            AddAudit(user.UserId, user.Email, "LoginBlocked", ipAddress, new { status = user.Status });
            await _db.SaveChangesAsync(ct);
            return AuthResult.Fail(InactiveAccount);
        }

        var refresh = _tokens.GenerateRefreshToken();
        _db.RefreshTokens.Add(NewRefreshToken(user.UserId, refresh, ipAddress));
        AddAudit(user.UserId, user.Email, "LoginSuccess", ipAddress);
        await _db.SaveChangesAsync(ct);

        return AuthResult.Ok(BuildResponse(user, refresh));
    }

    // ---------------------------------------------------------------- REFRESH
    public async Task<AuthResult> RefreshTokenAsync(RefreshTokenRequest request, string? ipAddress, CancellationToken ct = default)
    {
        var hash = _tokens.HashToken(request.RefreshToken);

        var stored = await _db.RefreshTokens
            .Include(t => t.User).ThenInclude(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (stored is null)
            return AuthResult.Fail(InvalidRefreshToken);

        var now = DateTime.UtcNow;

        // Token đã bị thu hồi mà vẫn được dùng lại => nghi ngờ bị đánh cắp,
        // thu hồi toàn bộ token còn hiệu lực của người dùng này.
        if (stored.IsRevoked)
        {
            var activeTokens = await _db.RefreshTokens
                .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                .ToListAsync(ct);
            foreach (var t in activeTokens) t.RevokedAt = now;

            AddAudit(stored.UserId, stored.User.Email, "RefreshTokenReuseDetected", ipAddress);
            await _db.SaveChangesAsync(ct);
            return AuthResult.Fail(InvalidRefreshToken);
        }

        if (stored.IsExpired || stored.User.Status != UserStatuses.Active)
            return AuthResult.Fail(InvalidRefreshToken);

        // Xoay vòng token: thu hồi token cũ, cấp token mới, lưu trong cùng một SaveChanges (atomic)
        var newRefresh = _tokens.GenerateRefreshToken();
        stored.RevokedAt = now;
        stored.ReplacedByTokenHash = newRefresh.TokenHash;
        _db.RefreshTokens.Add(NewRefreshToken(stored.UserId, newRefresh, ipAddress));
        AddAudit(stored.UserId, stored.User.Email, "RefreshToken", ipAddress);
        await _db.SaveChangesAsync(ct);

        return AuthResult.Ok(BuildResponse(stored.User, newRefresh));
    }

    // ---------------------------------------------------------------- helpers
    private AuthResponse BuildResponse(User user, GeneratedRefreshToken refresh)
    {
        var roles = user.UserRoles.Select(ur => ur.Role.RoleName).ToList();
        var access = _tokens.GenerateAccessToken(user, roles);

        return new AuthResponse
        {
            AccessToken = access.Token,
            AccessTokenExpiresAt = access.ExpiresAtUtc,
            RefreshToken = refresh.Token,
            RefreshTokenExpiresAt = refresh.ExpiresAtUtc,
            User = new AuthUserDto
            {
                UserId = user.UserId,
                Email = user.Email,
                FullName = user.FullName,
                Roles = roles
            }
        };
    }

    private static RefreshToken NewRefreshToken(int userId, GeneratedRefreshToken token, string? ipAddress) => new()
    {
        UserId = userId,
        TokenHash = token.TokenHash,
        ExpiresAt = token.ExpiresAtUtc,
        CreatedAt = DateTime.UtcNow,
        CreatedByIp = ipAddress
    };

    private void AddAudit(int? userId, string? email, string action, string? ipAddress, object? detail = null)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            UserEmail = email,
            Action = action,
            EntityName = "User",
            EntityId = userId?.ToString(),
            Detail = detail is null ? null : JsonSerializer.Serialize(detail),   // phải là JSON hợp lệ
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
    }
}