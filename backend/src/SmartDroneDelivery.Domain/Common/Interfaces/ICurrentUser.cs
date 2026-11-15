namespace SmartDroneDelivery.Application.Common.Interfaces;

/// <summary>Thông tin người đang thao tác, dùng để ghi audit_logs.</summary>
public interface ICurrentUser
{
    int? UserId { get; }
    string? Email { get; }
    string? IpAddress { get; }
}