using SmartDroneDelivery.Application.Common.Models;

namespace SmartDroneDelivery.Application.Features.Identity;

/// <summary>Quản lý người dùng dành cho SystemAdmin.</summary>
public interface IUserAdminService
{
    Task<PagedResult<UserListItemDto>> GetUsersAsync(UserListQuery query, CancellationToken ct = default);

    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken ct = default);

    /// <summary>Gán lại toàn bộ vai trò của một người dùng.</summary>
    Task<UserListItemDto> UpdateRolesAsync(int userId, UpdateUserRolesRequest request, int actingUserId, CancellationToken ct = default);

    /// <summary>Đổi trạng thái tài khoản (Active, Inactive, Locked).</summary>
    Task<UserListItemDto> UpdateStatusAsync(int userId, UpdateUserStatusRequest request, int actingUserId, CancellationToken ct = default);
}