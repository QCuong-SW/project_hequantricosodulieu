namespace SmartDroneDelivery.Domain.Entities.Identity;

/// <summary>Tên role, phải khớp với cột role_name trong bảng roles.</summary>
public static class RoleNames
{
    public const string Customer = "CUSTOMER";
    public const string Dispatcher = "DISPATCHER";
    public const string StationOperator = "STATION_OPERATOR";
    public const string LogisticsManager = "LOGISTICS_MANAGER";
    public const string SystemAdmin = "ADMIN";
}