using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Infrastructure.Persistence.Configurations;

// Database-first: script SQL trong database/modules/01_identity_security là nguồn chính.
// Các cấu hình dưới đây ánh xạ chính xác các thuộc tính C# với cột SQL Server.

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users");
        b.HasKey(x => x.UserId);
        b.Property(x => x.UserId).HasColumnName("id");
        b.Property(x => x.Email).HasColumnName("email").IsRequired().HasMaxLength(256);
        b.Property(x => x.PasswordHash).HasColumnName("password_hash").IsRequired().HasMaxLength(500);
        b.Property(x => x.FullName).HasColumnName("full_name").IsRequired().HasMaxLength(100);
        b.Property(x => x.Phone).HasColumnName("phone_number").HasMaxLength(20);
        b.Property(x => x.Status).HasColumnName("status").IsRequired().HasMaxLength(20);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
    }
}

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> b)
    {
        b.ToTable("roles");
        b.HasKey(x => x.RoleId);
        b.Property(x => x.RoleId).HasColumnName("id");
        b.Property(x => x.RoleName).HasColumnName("role_name").IsRequired().HasMaxLength(50);
        b.Property(x => x.Description).HasColumnName("description").HasMaxLength(255);
    }
}

internal sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> b)
    {
        b.ToTable("user_roles");
        b.HasKey(x => new { x.UserId, x.RoleId });
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.RoleId).HasColumnName("role_id");
        b.Property(x => x.AssignedAt).HasColumnName("assigned_at");

        b.HasOne(x => x.User)
         .WithMany(u => u.UserRoles)
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Role)
         .WithMany(r => r.UserRoles)
         .HasForeignKey(x => x.RoleId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("refresh_tokens");
        b.HasKey(x => x.RefreshTokenId);
        b.Property(x => x.RefreshTokenId).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.TokenHash).HasColumnName("token").IsRequired().HasMaxLength(500);
        b.Property(x => x.ExpiresAt).HasColumnName("expires_at");
        b.Property(x => x.IsRevoked).HasColumnName("is_revoked");
        b.Property(x => x.CreatedAt).HasColumnName("created_at");

        b.HasOne(x => x.User)
         .WithMany(u => u.RefreshTokens)
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.Cascade);

        // Các thuộc tính phụ / tính toán không có cột trong DB
        b.Ignore(x => x.CreatedByIp);
        b.Ignore(x => x.RevokedAt);
        b.Ignore(x => x.ReplacedByTokenHash);
        b.Ignore(x => x.IsExpired);
        b.Ignore(x => x.IsActive);
    }
}

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.ToTable("audit_logs");
        b.HasKey(x => x.AuditLogId);
        b.Property(x => x.AuditLogId).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.Action).HasColumnName("action").IsRequired().HasMaxLength(50);
        b.Property(x => x.EntityName).HasColumnName("entity_name").IsRequired().HasMaxLength(50);
        b.Property(x => x.EntityId).HasColumnName("entity_id").IsRequired().HasMaxLength(50);
        b.Property(x => x.OldValues).HasColumnName("old_values");
        b.Property(x => x.Detail).HasColumnName("new_values");
        b.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(45);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");

        b.Ignore(x => x.UserEmail);

        // FK user_id: ON DELETE SET NULL (khớp với script SQL)
        b.HasOne<User>()
         .WithMany()
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.SetNull);
    }
}