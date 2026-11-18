using System.ComponentModel.DataAnnotations;

namespace SmartDroneDelivery.Application.Features.Identity;

/// <summary>Tham số truy vấn danh sách người dùng (pageNumber, pageSize, sortBy, sortOrder, status, search).</summary>
public class UserListQuery
{
    [Range(1, int.MaxValue, ErrorMessage = "pageNumber phải từ 1 trở lên.")]
    public int PageNumber { get; set; } = 1;

    [Range(1, 100, ErrorMessage = "pageSize phải từ 1 đến 100.")]
    public int PageSize { get; set; } = 10;

    /// <summary>Tìm theo email, họ tên hoặc số điện thoại.</summary>
    [StringLength(100, ErrorMessage = "Từ khóa tìm kiếm tối đa 100 ký tự.")]
    public string? Search { get; set; }

    /// <summary>Lọc theo trạng thái: Active, Inactive, Locked.</summary>
    public string? Status { get; set; }

    /// <summary>Lọc theo tên vai trò.</summary>
    public string? Role { get; set; }

    /// <summary>createdAt (mặc định), email, fullName, status.</summary>
    public string? SortBy { get; set; }

    /// <summary>asc hoặc desc (mặc định desc).</summary>
    public string? SortOrder { get; set; }
}

public class UserListItemDto
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class RoleDto
{
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateUserRolesRequest
{
    [Required(ErrorMessage = "Cần chọn ít nhất một vai trò.")]
    [MinLength(1, ErrorMessage = "Cần chọn ít nhất một vai trò.")]
    public List<string> RoleNames { get; set; } = new();
}

public class UpdateUserStatusRequest
{
    [Required(ErrorMessage = "Trạng thái là bắt buộc.")]
    [RegularExpression("^(Active|Inactive|Locked)$", ErrorMessage = "Trạng thái phải là Active, Inactive hoặc Locked.")]
    public string Status { get; set; } = string.Empty;
}