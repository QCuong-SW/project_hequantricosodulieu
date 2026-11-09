using SmartDroneDelivery.Application.Common.Interfaces;

namespace SmartDroneDelivery.Infrastructure.Auth;

public sealed class BcryptPasswordHasher : IPasswordHasher
{
    // Work factor 12: đủ chậm để chống brute-force, vẫn nhanh với đồ án (~250ms/lần)
    private const int WorkFactor = 12;

    public string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrEmpty(password);
        return BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
    }

    public bool Verify(string password, string passwordHash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(passwordHash))
            return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, passwordHash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // Hash trong DB không đúng định dạng BCrypt
            return false;
        }
    }
}