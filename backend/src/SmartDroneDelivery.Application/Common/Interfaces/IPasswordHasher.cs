namespace SmartDroneDelivery.Application.Common.Interfaces;

public interface IPasswordHasher
{
    /// <summary>Băm mật khẩu (có salt ngẫu nhiên).</summary>
    string Hash(string password);

    /// <summary>Kiểm tra mật khẩu với chuỗi hash đã lưu. Trả về false nếu hash sai định dạng.</summary>
    bool Verify(string password, string passwordHash);
}