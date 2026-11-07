namespace SmartDroneDelivery.Infrastructure.Auth;

public sealed class JwtSettings
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "SmartDroneDelivery";
    public string Audience { get; set; } = "SmartDroneDelivery.Clients";

    /// <summary>Khóa ký HMAC-SHA256, tối thiểu 32 ký tự. KHÔNG commit giá trị thật lên Git.</summary>
    public string Secret { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
}