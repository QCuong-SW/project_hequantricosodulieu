using SmartDroneDelivery.Application.Common.Interfaces;

namespace SmartDroneDelivery.Infrastructure.Persistence.Interceptors;

internal sealed class AnonymousCurrentUser : ICurrentUser
{
    public int? UserId => null;
    public string? Email => null;
    public string? IpAddress => null;
}