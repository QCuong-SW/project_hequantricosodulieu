using Microsoft.AspNetCore.Authorization;
using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Api.Authorization;

public static class AuthorizationPolicies
{
    public const string CustomerOnly = "CustomerOnly";
    public const string DispatcherAccess = "DispatcherAccess";
    public const string StationAccess = "StationAccess";
    public const string AnalyticsAccess = "AnalyticsAccess";
    public const string AdminOnly = "AdminOnly";
    public const string StaffAccess = "StaffAccess";

    public static void Configure(AuthorizationOptions options)
    {
        options.AddPolicy(CustomerOnly, p =>
            p.RequireRole(RoleNames.Customer));

        options.AddPolicy(DispatcherAccess, p =>
            p.RequireRole(
                RoleNames.Dispatcher,
                RoleNames.SystemAdmin));

        // Nhận đúng role trong database seed và hỗ trợ tên role cũ.
        options.AddPolicy(StationAccess, p =>
            p.RequireRole(
                "STATION_OPERATOR",
                "ADMIN",
                RoleNames.StationOperator,
                RoleNames.SystemAdmin));

        options.AddPolicy(AnalyticsAccess, p =>
            p.RequireRole(
                RoleNames.LogisticsManager,
                RoleNames.SystemAdmin));

        options.AddPolicy(AdminOnly, p =>
            p.RequireRole(RoleNames.SystemAdmin));

        options.AddPolicy(StaffAccess, p =>
            p.RequireRole(
                RoleNames.Dispatcher,
                RoleNames.StationOperator,
                RoleNames.LogisticsManager,
                RoleNames.SystemAdmin));
    }
}