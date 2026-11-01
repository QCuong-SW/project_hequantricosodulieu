using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.Interfaces;
using SmartDroneDelivery.Domain.Entities;

namespace SmartDroneDelivery.Infrastructure.Data;

public class AppDbContext : DbContext, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();

    public DbSet<DeliveryAddress> DeliveryAddresses => Set<DeliveryAddress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<CustomerProfile>(entity =>
        {
            entity.ToTable("customer_profiles");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.CustomerCode)
            .HasColumnName("customer_code")
            .HasMaxLength(50)
            .IsUnicode(false);
            entity.Property(x => x.CompanyName)
            .HasColumnName("company_name")
            .HasMaxLength(150);

            entity.Property(x => x.TotalOrders).HasColumnName("total_orders");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(x => x.UserId).IsUnique();
            entity.HasIndex(x => x.CustomerCode).IsUnique();
        });

        modelBuilder.Entity<DeliveryAddress>(entity =>
        {
            entity.ToTable("delivery_addresses");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.AddressLine)
            .HasColumnName("address_line")
            .HasMaxLength(255);
            entity.Property(x => x.Ward).HasColumnName("ward").HasMaxLength(100);
            entity.Property(x => x.District).HasColumnName("district").HasMaxLength(100);
            entity.Property(x => x.City).HasColumnName("city").HasMaxLength(100);
            entity.Property(x => x.Latitude).HasColumnName("latitude").HasPrecision(9, 6);
            entity.Property(x => x.Longitude).HasColumnName("longitude").HasPrecision(9, 6);
            entity.Property(x => x.IsDefault).HasColumnName("is_default");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");

            entity.HasOne(x => x.Customer)
                .WithMany(x => x.DeliveryAddresses)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}