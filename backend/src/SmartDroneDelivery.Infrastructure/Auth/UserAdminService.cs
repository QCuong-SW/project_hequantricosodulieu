using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Common.Exceptions;
using SmartDroneDelivery.Application.Common.Models;
using SmartDroneDelivery.Application.Features.Identity;
using SmartDroneDelivery.Domain.Entities.Identity;
using SmartDroneDelivery.Infrastructure.Persistence;

namespace SmartDroneDelivery.Infrastructure.Auth;

public sealed class UserAdminService : IUserAdminService
{
    private readonly SmartDroneDbContext _db;

    public UserAdminService(SmartDroneDbContext db) => _db = db;

    // ------------------------------------------------------------- danh sách
    public async Task<PagedResult<UserListItemDto>> GetUsersAsync(UserListQuery query, CancellationToken ct = default)
    {
        var pageNumber = Math.Max(1, query.PageNumber);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        IQueryable<User> users = _db.Users.AsNoTracking();

        var search = query.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            users = users.Where(u =>
                u.Email.Contains(search) ||
                u.FullName.Contains(search) ||
                (u.Phone != null && u.Phone.Contains(search)));
        }

        var status = query.Status?.Trim();
        if (!string.IsNullOrEmpty(status))
            users = users.Where(u => u.Status == status);

        var role = query.Role?.Trim();
        if (!string.IsNullOrEmpty(role))
            users = users.Where(u => u.UserRoles.Any(ur => ur.Role.RoleName == role));

        var totalCount = await users.CountAsync(ct);

        var items = await ApplySort(users, query.SortBy, query.SortOrder)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserListItemDto
            {
                UserId = u.UserId,
                Email = u.Email,
                FullName = u.FullName,
                Phone = u.Phone,
                Status = u.Status,
                CreatedAt = u.CreatedAt,
                Roles = u.UserRoles.Select(ur => ur.Role.RoleName).ToList()
            })
            .ToListAsync(ct);

        return new PagedResult<UserListItemDto>
        {
            Items = items,
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken ct = default)
    {
        return await _db.Roles
            .AsNoTracking()
            .OrderBy(r => r.RoleId)
            .Select(r => new RoleDto { RoleId = r.RoleId, RoleName = r.RoleName, Description = r.Description })
            .ToListAsync(ct);
    }

    // ----------------------------------------------------------- gán vai trò
    public async Task<UserListItemDto> UpdateRolesAsync(
        int userId, UpdateUserRolesRequest request, int actingUserId, CancellationToken ct = default)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId, ct)
            ?? throw new NotFoundException("Người dùng", userId);

        var requested = request.RoleNames
            .Select(r => r.Trim())
            .Where(r => r.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (requested.Count == 0)
            throw new ValidationFailedException("roleNames", "Cần chọn ít nhất một vai trò.");

        var roles = await _db.Roles.Where(r => requested.Contains(r.RoleName)).ToListAsync(ct);

        var missing = requested
            .Except(roles.Select(r => r.RoleName), StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (missing.Count > 0)
            throw new ValidationFailedException("roleNames", $"Vai trò không tồn tại: {string.Join(", ", missing)}.");

        var hadAdmin = user.UserRoles.Any(ur => ur.Role.RoleName == RoleNames.SystemAdmin);
        var willHaveAdmin = roles.Any(r => r.RoleName == RoleNames.SystemAdmin);

        if (hadAdmin && !willHaveAdmin)
        {
            if (userId == actingUserId)
                throw new ForbiddenException("Bạn không thể tự gỡ vai trò SystemAdmin của chính mình.");

            await EnsureAnotherActiveAdminAsync(userId, ct);
        }

        var desiredIds = roles.Select(r => r.RoleId).ToHashSet();

        foreach (var link in user.UserRoles.Where(ur => !desiredIds.Contains(ur.RoleId)).ToList())
            _db.UserRoles.Remove(link);

        var currentIds = user.UserRoles.Select(ur => ur.RoleId).ToHashSet();
        foreach (var role in roles.Where(r => !currentIds.Contains(r.RoleId)))
            user.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId, AssignedAt = DateTime.UtcNow });

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return ToDto(user, roles.Select(r => r.RoleName).OrderBy(n => n).ToList());
    }

    // ------------------------------------------------------- đổi trạng thái
    public async Task<UserListItemDto> UpdateStatusAsync(
        int userId, UpdateUserStatusRequest request, int actingUserId, CancellationToken ct = default)
    {
        var newStatus = request.Status.Trim();
        if (newStatus is not (UserStatuses.Active or UserStatuses.Inactive or UserStatuses.Locked))
            throw new ValidationFailedException("status", "Trạng thái phải là Active, Inactive hoặc Locked.");

        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId, ct)
            ?? throw new NotFoundException("Người dùng", userId);

        if (newStatus != UserStatuses.Active)
        {
            if (userId == actingUserId)
                throw new ForbiddenException("Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình.");

            if (user.UserRoles.Any(ur => ur.Role.RoleName == RoleNames.SystemAdmin))
                await EnsureAnotherActiveAdminAsync(userId, ct);

            // Thu hồi mọi refresh token để người dùng không gia hạn được phiên đăng nhập nữa
            var tokens = await _db.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .ToListAsync(ct);
            foreach (var token in tokens)
                token.RevokedAt = DateTime.UtcNow;
        }

        user.Status = newStatus;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return ToDto(user, user.UserRoles.Select(ur => ur.Role.RoleName).OrderBy(n => n).ToList());
    }

    // ------------------------------------------------------------- hỗ trợ
    private async Task EnsureAnotherActiveAdminAsync(int excludedUserId, CancellationToken ct)
    {
        var hasOther = await _db.UserRoles.AnyAsync(ur =>
            ur.UserId != excludedUserId &&
            ur.Role.RoleName == RoleNames.SystemAdmin &&
            ur.User.Status == UserStatuses.Active, ct);

        if (!hasOther)
            throw new ConflictException("Hệ thống phải còn ít nhất một quản trị viên đang hoạt động.");
    }

    private static IQueryable<User> ApplySort(IQueryable<User> query, string? sortBy, string? sortOrder)
    {
        var descending = !string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase);

        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "email" => descending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "fullname" => descending ? query.OrderByDescending(u => u.FullName) : query.OrderBy(u => u.FullName),
            "status" => descending ? query.OrderByDescending(u => u.Status) : query.OrderBy(u => u.Status),
            _ => descending
                ? query.OrderByDescending(u => u.CreatedAt).ThenByDescending(u => u.UserId)
                : query.OrderBy(u => u.CreatedAt).ThenBy(u => u.UserId)
        };
    }

    private static UserListItemDto ToDto(User user, List<string> roleNames) => new()
    {
        UserId = user.UserId,
        Email = user.Email,
        FullName = user.FullName,
        Phone = user.Phone,
        Status = user.Status,
        CreatedAt = user.CreatedAt,
        Roles = roleNames
    };
}
