namespace SmartDroneDelivery.Domain.Entities.Identity;

public class AuditLog
{
    public Guid AuditLogId { get; set; } = Guid.NewGuid();
    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = "N/A";
    public string? OldValues { get; set; }
    public string? Detail { get; set; }          // ánh xạ vào cột new_values trong dbo.audit_logs
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}