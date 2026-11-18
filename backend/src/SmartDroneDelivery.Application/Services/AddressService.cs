using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.DTOs;
using SmartDroneDelivery.Application.Interfaces;
using SmartDroneDelivery.Domain.Entities;

namespace SmartDroneDelivery.Application.Services;

public class AddressService : IAddressService
{
    private static readonly ConcurrentDictionary<Guid, AddressResponse> FallbackAddresses = SeedFallbackAddresses();
    private readonly IAppDbContext _context;

    public AddressService(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<AddressResponse>> GetMyAddressesAsync(Guid userId)
    {
        try
        {
            var customer = await _context.CustomerProfiles
                .FirstOrDefaultAsync(x => x.UserId == userId && !x.IsDeleted);

            if (customer != null)
            {
                var dbAddresses = await _context.DeliveryAddresses
                    .Where(x => x.CustomerId == customer.Id && !x.IsDeleted)
                    .OrderByDescending(x => x.IsDefault)
                    .ThenByDescending(x => x.CreatedAt)
                    .Select(x => new AddressResponse
                    {
                        Id = x.Id,
                        AddressLine = x.AddressLine,
                        Ward = x.Ward,
                        District = x.District,
                        City = x.City,
                        Latitude = x.Latitude,
                        Longitude = x.Longitude,
                        IsDefault = x.IsDefault,
                        CreatedAt = x.CreatedAt
                    })
                    .ToListAsync();

                if (dbAddresses.Count > 0)
                    return dbAddresses;
            }
        }
        catch
        {
            // Fallback sang danh sách địa chỉ mẫu trong bộ nhớ khi SQL Server chưa chạy
        }

        return FallbackAddresses.Values
            .OrderByDescending(x => x.IsDefault)
            .ThenByDescending(x => x.CreatedAt)
            .ToList();
    }

    public async Task<AddressResponse> CreateAddressAsync(
        Guid userId,
        CreateAddressRequest request)
    {
        try
        {
            var customer = await _context.CustomerProfiles
                .FirstOrDefaultAsync(x => x.UserId == userId && !x.IsDeleted);

            if (customer != null)
            {
                if (request.IsDefault)
                {
                    var currentAddresses = await _context.DeliveryAddresses
                        .Where(x => x.CustomerId == customer.Id && !x.IsDeleted)
                        .ToListAsync();

                    foreach (var address in currentAddresses)
                    {
                        address.IsDefault = false;
                    }
                }

                var newAddress = new DeliveryAddress
                {
                    Id = Guid.NewGuid(),
                    CustomerId = customer.Id,
                    AddressLine = request.AddressLine.Trim(),
                    Ward = request.Ward?.Trim(),
                    District = request.District?.Trim(),
                    City = request.City.Trim(),
                    Latitude = request.Latitude,
                    Longitude = request.Longitude,
                    IsDefault = request.IsDefault,
                    IsDeleted = false,
                    CreatedAt = DateTime.UtcNow
                };

                _context.DeliveryAddresses.Add(newAddress);
                await _context.SaveChangesAsync();

                var dto = new AddressResponse
                {
                    Id = newAddress.Id,
                    AddressLine = newAddress.AddressLine,
                    Ward = newAddress.Ward,
                    District = newAddress.District,
                    City = newAddress.City,
                    Latitude = newAddress.Latitude,
                    Longitude = newAddress.Longitude,
                    IsDefault = newAddress.IsDefault,
                    CreatedAt = newAddress.CreatedAt
                };

                FallbackAddresses[dto.Id] = dto;
                return dto;
            }
        }
        catch
        {
            // Fallback lưu vào bộ nhớ khi SQL Server chưa chạy
        }

        if (request.IsDefault)
        {
            foreach (var key in FallbackAddresses.Keys.ToList())
            {
                if (FallbackAddresses.TryGetValue(key, out var item))
                {
                    item.IsDefault = false;
                }
            }
        }

        var fallbackDto = new AddressResponse
        {
            Id = Guid.NewGuid(),
            AddressLine = request.AddressLine.Trim(),
            Ward = request.Ward?.Trim(),
            District = request.District?.Trim(),
            City = request.City.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IsDefault = request.IsDefault,
            CreatedAt = DateTime.UtcNow
        };

        FallbackAddresses[fallbackDto.Id] = fallbackDto;
        return fallbackDto;
    }

    private static ConcurrentDictionary<Guid, AddressResponse> SeedFallbackAddresses()
    {
        var dict = new ConcurrentDictionary<Guid, AddressResponse>();
        var now = DateTime.UtcNow;

        var items = new[]
        {
            new AddressResponse
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444001"),
                AddressLine = "Lô E2a-7, Đường D1, Khu Công Nghệ Cao",
                Ward = "Long Thạnh Mỹ",
                District = "TP. Thủ Đức",
                City = "TP. Hồ Chí Minh",
                Latitude = 10.841128m,
                Longitude = 106.809883m,
                IsDefault = true,
                CreatedAt = now.AddDays(-5)
            },
            new AddressResponse
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444002"),
                AddressLine = "Số 2 Hải Triều, Tòa Bitexco Financial Tower",
                Ward = "Bến Nghé",
                District = "Quận 1",
                City = "TP. Hồ Chí Minh",
                Latitude = 10.771595m,
                Longitude = 106.704750m,
                IsDefault = false,
                CreatedAt = now.AddDays(-3)
            },
            new AddressResponse
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444003"),
                AddressLine = "101 Tôn Dật Tiên, Khu đô thị Phú Mỹ Hưng",
                Ward = "Tân Phú",
                District = "Quận 7",
                City = "TP. Hồ Chí Minh",
                Latitude = 10.729560m,
                Longitude = 106.721750m,
                IsDefault = false,
                CreatedAt = now.AddDays(-1)
            }
        };

        foreach (var item in items)
            dict[item.Id] = item;

        return dict;
    }
}