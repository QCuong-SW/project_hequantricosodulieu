using Microsoft.AspNetCore.Authorization;
using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Api.Authorization;

/// <summary>
/// Các policy phân quyền theo role. Dùng trong controller:
///   [Authorize(Policy = AuthorizationPolicies.DispatcherAccess)]
/// SystemAdmin luôn được phép vào các khu vực nghiệp vụ để hỗ trợ và kiểm tra.
/// </summary>
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
        options.AddPolicy(CustomerOnly, p => p.RequireRole(RoleNames.Customer));

        options.AddPolicy(DispatcherAccess, p =>
            p.RequireRole(RoleNames.Dispatcher, RoleNames.SystemAdmin));

        options.AddPolicy(StationAccess, p =>
            p.RequireRole(RoleNames.StationOperator, RoleNames.SystemAdmin));

        options.AddPolicy(AnalyticsAccess, p =>
            p.RequireRole(RoleNames.LogisticsManager, RoleNames.SystemAdmin));

        options.AddPolicy(AdminOnly, p => p.RequireRole(RoleNames.SystemAdmin));

        // Mọi nhân sự nội bộ (không gồm khách hàng)
        options.AddPolicy(StaffAccess, p => p.RequireRole(
            RoleNames.Dispatcher,
            RoleNames.StationOperator,
            RoleNames.LogisticsManager,
            RoleNames.SystemAdmin));
    }
}