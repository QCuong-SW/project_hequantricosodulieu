namespace SmartDroneDelivery.Application.Features.Identity;

public sealed class AuthResult
{
    public bool Success { get; private init; }
    public string? Error { get; private init; }
    public AuthResponse? Data { get; private init; }

    public static AuthResult Ok(AuthResponse data) => new() { Success = true, Data = data };
    public static AuthResult Fail(string error) => new() { Success = false, Error = error };
}