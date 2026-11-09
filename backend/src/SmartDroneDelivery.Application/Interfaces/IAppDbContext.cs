using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Domain.Entities;

namespace SmartDroneDelivery.Application.Interfaces;

public interface IAppDbContext
{
    DbSet<CustomerProfile> CustomerProfiles { get; }
    DbSet<DeliveryAddress> DeliveryAddresses { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}