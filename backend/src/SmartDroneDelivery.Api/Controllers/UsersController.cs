using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Api.Authorization;
using SmartDroneDelivery.Application.Common.Exceptions;
using SmartDroneDelivery.Application.Common.Models;
using SmartDroneDelivery.Application.Features.Identity;

namespace SmartDroneDelivery.Api.Controllers;

/// <summary>Quản lý người dùng và vai trò. Chỉ SystemAdmin được gọi.</summary>
[ApiController]
[Route("api/v1")]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
public class UsersController : ControllerBase
{
    private readonly IUserAdminService _users;

    public UsersController(IUserAdminService users) => _users = users;

    /// <summary>Danh sách người dùng có phân trang, tìm kiếm, lọc theo trạng thái và vai trò.</summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] UserListQuery query, CancellationToken ct)
        => Ok(await _users.GetUsersAsync(query, ct));

    /// <summary>Danh sách vai trò để chọn khi gán quyền.</summary>
    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles(CancellationToken ct)
        => Ok(await _users.GetRolesAsync(ct));

    /// <summary>Gán lại toàn bộ vai trò cho một người dùng.</summary>
    [HttpPut("users/{id:int}/roles")]
    public async Task<IActionResult> UpdateRoles(int id, [FromBody] UpdateUserRolesRequest request, CancellationToken ct)
    {
        var updated = await _users.UpdateRolesAsync(id, request, GetActingUserId(), ct);
        return Ok(ApiResponse.Ok(updated, "Đã cập nhật vai trò."));
    }

    /// <summary>Đổi trạng thái tài khoản (Active, Inactive, Locked).</summary>
    [HttpPatch("users/{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateUserStatusRequest request, CancellationToken ct)
    {
        var updated = await _users.UpdateStatusAsync(id, request, GetActingUserId(), ct);
        return Ok(ApiResponse.Ok(updated, "Đã cập nhật trạng thái tài khoản."));
    }

    private int GetActingUserId() =>
        int.TryParse(User.FindFirst("sub")?.Value, out var id)
            ? id
            : throw new ForbiddenException("Không xác định được người dùng hiện tại.");
}