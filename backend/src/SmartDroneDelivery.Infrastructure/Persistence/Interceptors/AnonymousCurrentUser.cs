using SmartDroneDelivery.Application.Common.Interfaces;

namespace SmartDroneDelivery.Infrastructure.Persistence.Interceptors;

internal sealed class AnonymousCurrentUser : ICurrentUser
{
    public Guid? UserId => null;
    public string? Email => null;
    public string? IpAddress => null;
}