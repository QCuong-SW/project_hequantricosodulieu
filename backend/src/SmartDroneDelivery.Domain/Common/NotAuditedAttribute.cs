namespace SmartDroneDelivery.Domain.Common;

/// <summary>Đánh dấu entity không ghi audit_logs (dữ liệu tần suất cao như telemetry).</summary>
[AttributeUsage(AttributeTargets.Class, Inherited = true)]
public sealed class NotAuditedAttribute : Attribute
{
}