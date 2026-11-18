using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SmartDroneDelivery.Application.Common.Interfaces;
using SmartDroneDelivery.Domain.Common;
using SmartDroneDelivery.Domain.Entities.Identity;

namespace SmartDroneDelivery.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Tự động ghi audit_logs mỗi khi có bản ghi được thêm, sửa hoặc xóa.
/// Không ghi cho AuditLog (tránh lặp vô hạn), RefreshToken (AuthService đã tự ghi),
/// TrackingEvent (tần suất cao) và các entity gắn [NotAudited].
/// </summary>
public sealed class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private static readonly HashSet<string> ExcludedEntities =
        new() { nameof(AuditLog), nameof(RefreshToken), "TrackingEvent" };

    // Các cột nhạy cảm: không bao giờ ghi giá trị thật vào log
    private static readonly HashSet<string> SensitiveProperties =
        new(StringComparer.OrdinalIgnoreCase) { "PasswordHash", "TokenHash", "ReplacedByTokenHash" };

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ICurrentUser _currentUser;
    private List<PendingAudit> _pending = new();

    public AuditSaveChangesInterceptor(ICurrentUser currentUser)
    {
        _currentUser = currentUser;
    }

    // ---------- Trước khi lưu: ghi nhớ các thay đổi ----------
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData, InterceptionResult<int> result)
    {
        Capture(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Capture(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    // ---------- Sau khi lưu thành công: ghi audit_logs ----------
    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        var context = eventData.Context;
        if (context is not null)
        {
            var logs = BuildAuditLogs();
            if (logs.Count > 0)
            {
                context.Set<AuditLog>().AddRange(logs);
                context.SaveChanges();
            }
        }
        return base.SavedChanges(eventData, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        var context = eventData.Context;
        if (context is not null)
        {
            var logs = BuildAuditLogs();
            if (logs.Count > 0)
            {
                context.Set<AuditLog>().AddRange(logs);
                await context.SaveChangesAsync(cancellationToken);
            }
        }
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    // ---------- Lưu thất bại: bỏ danh sách đã ghi nhớ ----------
    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        _pending = new List<PendingAudit>();
        base.SaveChangesFailed(eventData);
    }

    public override Task SaveChangesFailedAsync(
        DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        _pending = new List<PendingAudit>();
        return base.SaveChangesFailedAsync(eventData, cancellationToken);
    }

    // ------------------------------------------------------------------
    private void Capture(DbContext? context)
    {
        _pending = new List<PendingAudit>();
        if (context is null) return;

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
                continue;
            if (IsExcluded(entry))
                continue;

            switch (entry.State)
            {
                case EntityState.Added:
                    // Id chỉ có sau khi lưu nên để BuildAuditLogs điền sau
                    _pending.Add(new PendingAudit(entry, "Create", null, null));
                    break;

                case EntityState.Modified:
                    var changes = BuildChanges(entry);
                    if (changes.Count > 0)
                        _pending.Add(new PendingAudit(entry, "Update", GetEntityId(entry), new { changes }));
                    break;

                case EntityState.Deleted:
                    _pending.Add(new PendingAudit(entry, "Delete", GetEntityId(entry),
                        new { values = BuildValues(entry, useOriginal: true) }));
                    break;
            }
        }
    }

    private List<AuditLog> BuildAuditLogs()
    {
        var pending = _pending;
        _pending = new List<PendingAudit>();   // đặt lại trước khi lưu lần hai để không bị lặp

        var now = DateTime.UtcNow;
        var logs = new List<AuditLog>();

        foreach (var item in pending)
        {
            object detail = item.Detail ?? new { values = BuildValues(item.Entry, useOriginal: false) };

            logs.Add(new AuditLog
            {
                UserId = _currentUser.UserId,
                UserEmail = _currentUser.Email,
                Action = item.Action,
                EntityName = item.Entry.Metadata.ClrType.Name,
                EntityId = (item.EntityId ?? GetEntityId(item.Entry)) ?? "N/A",
                Detail = JsonSerializer.Serialize(detail, JsonOptions),   // luôn là JSON hợp lệ
                IpAddress = _currentUser.IpAddress,
                CreatedAt = now
            });
        }

        return logs;
    }

    private static bool IsExcluded(EntityEntry entry)
    {
        var type = entry.Metadata.ClrType;
        return ExcludedEntities.Contains(type.Name)
            || Attribute.IsDefined(type, typeof(NotAuditedAttribute), inherit: true);
    }

    private static Dictionary<string, object?> BuildChanges(EntityEntry entry)
    {
        var changes = new Dictionary<string, object?>();

        foreach (var property in entry.Properties.Where(p => p.IsModified))
        {
            if (Equals(property.OriginalValue, property.CurrentValue))
                continue;

            var name = property.Metadata.Name;
            changes[name] = SensitiveProperties.Contains(name)
                ? new { old = "***", @new = "***" }
                : new { old = property.OriginalValue, @new = property.CurrentValue };
        }

        return changes;
    }

    private static Dictionary<string, object?> BuildValues(EntityEntry entry, bool useOriginal)
    {
        var values = new Dictionary<string, object?>();

        foreach (var property in entry.Properties)
        {
            var name = property.Metadata.Name;
            values[name] = SensitiveProperties.Contains(name)
                ? "***"
                : useOriginal ? property.OriginalValue : property.CurrentValue;
        }

        return values;
    }

    private static string? GetEntityId(EntityEntry entry)
    {
        var key = entry.Metadata.FindPrimaryKey();
        if (key is null) return null;

        var id = string.Join(",", key.Properties.Select(p => entry.Property(p.Name).CurrentValue));
        return id.Length > 50 ? id[..50] : id;   // cột entity_id dài 50 ký tự
    }

    private sealed record PendingAudit(EntityEntry Entry, string Action, string? EntityId, object? Detail);
}