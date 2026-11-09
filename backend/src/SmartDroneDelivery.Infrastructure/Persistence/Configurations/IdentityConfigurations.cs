using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Infrastructure.Persistence.Configurations;

// Database-first: script SQL trong database/modules/01_identity_security là nguồn chính.
// Các cấu hình dưới đây chỉ mô tả lại cho EF Core khớp với bảng đã có (KHÔNG chạy migration).

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.HasKey(x => x.UserId);
        b.Property(x => x.Email).IsRequired().HasMaxLength(256);
        b.Property(x => x.PasswordHash).IsRequired().HasMaxLength(255);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(100);
        b.Property(x => x.Phone).HasMaxLength(20);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
    }
}

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> b)
    {
        b.HasKey(x => x.RoleId);
        b.Property(x => x.RoleName).IsRequired().HasMaxLength(50);
        b.Property(x => x.Description).HasMaxLength(200);
    }
}

internal sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> b)
    {
        b.HasKey(x => new { x.UserId, x.RoleId });

        b.HasOne(x => x.User)
         .WithMany(u => u.UserRoles)
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Role)
         .WithMany(r => r.UserRoles)
         .HasForeignKey(x => x.RoleId)
         .OnDelete(DeleteBehavior.NoAction);
    }
}

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.HasKey(x => x.RefreshTokenId);
        b.Property(x => x.TokenHash).IsRequired().HasMaxLength(128);
        b.Property(x => x.CreatedByIp).HasMaxLength(45);
        b.Property(x => x.ReplacedByTokenHash).HasMaxLength(128);

        b.HasOne(x => x.User)
         .WithMany(u => u.RefreshTokens)
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.Cascade);

        // Các thuộc tính tính toán không có cột trong DB
        b.Ignore(x => x.IsRevoked);
        b.Ignore(x => x.IsExpired);
        b.Ignore(x => x.IsActive);
    }
}

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.HasKey(x => x.AuditLogId);
        b.Property(x => x.UserEmail).HasMaxLength(256);
        b.Property(x => x.Action).IsRequired().HasMaxLength(100);
        b.Property(x => x.EntityName).IsRequired().HasMaxLength(100);
        b.Property(x => x.EntityId).HasMaxLength(50);
        b.Property(x => x.IpAddress).HasMaxLength(45);

        // FK user_id: ON DELETE SET NULL (khớp với script SQL)
        b.HasOne<User>()
         .WithMany()
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.SetNull);
    }
}