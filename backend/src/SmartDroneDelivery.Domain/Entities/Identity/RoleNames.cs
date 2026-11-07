namespace SmartDroneDelivery.Domain.Entities.Identity;

/// <summary>Tên role, phải khớp với cột role_name trong bảng roles.</summary>
public static class RoleNames
{
    public const string Customer = "Customer";
    public const string Dispatcher = "Dispatcher";
    public const string StationOperator = "StationOperator";
    public const string LogisticsManager = "LogisticsManager";
    public const string SystemAdmin = "SystemAdmin";
}