using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SmartDroneDelivery.Application.Common.Interfaces;
using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Infrastructure.Auth;

public sealed class JwtTokenService : IJwtTokenService
{
    private readonly JwtSettings _settings;
    private readonly SigningCredentials _credentials;

    public JwtTokenService(IOptions<JwtSettings> options)
    {
        _settings = options.Value;

        var keyBytes = Encoding.UTF8.GetBytes(_settings.Secret ?? string.Empty);
        if (keyBytes.Length < 32)
            throw new InvalidOperationException(
                "Jwt:Secret phải có ít nhất 32 ký tự. Hãy cấu hình bằng user-secrets hoặc biến môi trường.");

        _credentials = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);
    }

    public AccessToken GenerateAccessToken(User user, IEnumerable<string> roles)
    {
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(_settings.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("full_name", user.FullName)
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var jwt = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: _credentials);

        return new AccessToken(new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }

    public GeneratedRefreshToken GenerateRefreshToken()
    {
        // 64 byte ngẫu nhiên an toàn về mật mã; DB chỉ lưu bản băm SHA-256
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        return new GeneratedRefreshToken(
            token,
            HashToken(token),
            DateTime.UtcNow.AddDays(_settings.RefreshTokenDays));
    }

    public string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);   // 64 ký tự, vừa cột token_hash NVARCHAR(128)
    }
}