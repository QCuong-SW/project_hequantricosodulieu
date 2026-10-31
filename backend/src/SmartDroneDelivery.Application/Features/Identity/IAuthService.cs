namespace SmartDroneDelivery.Application.Features.Identity;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequest request, string? ipAddress, CancellationToken ct = default);
    Task<AuthResult> RefreshTokenAsync(RefreshTokenRequest request, string? ipAddress, CancellationToken ct = default);
}