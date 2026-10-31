using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Application.Common.Interfaces;

public sealed record AccessToken(string Token, DateTime ExpiresAtUtc);

/// <summary>Refresh token vừa sinh: Token trả cho client, TokenHash mới được lưu vào DB.</summary>
public sealed record GeneratedRefreshToken(string Token, string TokenHash, DateTime ExpiresAtUtc);

public interface IJwtTokenService
{
    AccessToken GenerateAccessToken(User user, IEnumerable<string> roles);
    GeneratedRefreshToken GenerateRefreshToken();
    string HashToken(string token);
}