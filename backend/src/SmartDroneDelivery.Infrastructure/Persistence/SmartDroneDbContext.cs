using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Infrastructure.Persistence;

/// <summary>
/// DbContext dùng chung cho cả nhóm. Mỗi module chỉ thêm một dòng DbSet
/// và một lớp IEntityTypeConfiguration riêng (đặt trong thư mục Configurations).
/// Tên bảng/cột snake_case được tự động suy ra nhờ UseSnakeCaseNamingConvention().
/// </summary>
public sealed class SmartDroneDbContext : DbContext
{
    public SmartDroneDbContext(DbContextOptions<SmartDroneDbContext> options) : base(options)
    {
    }

    // ---- Module 1: Identity (M1) ----
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // ---- Các module khác: M2, M3, M4, M5 thêm DbSet của mình bên dưới ----

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Tự động nạp mọi lớp IEntityTypeConfiguration<T> trong assembly này
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SmartDroneDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}