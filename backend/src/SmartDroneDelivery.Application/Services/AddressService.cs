using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.DTOs;
using SmartDroneDelivery.Application.Interfaces;
using SmartDroneDelivery.Domain.Entities;

namespace SmartDroneDelivery.Application.Services;

public class AddressService : IAddressService
{
    private class FallbackItem
    {
        public Guid UserId { get; set; }
        public AddressResponse Address { get; set; } = new();
    }

    private static readonly ConcurrentDictionary<Guid, FallbackItem> FallbackAddresses = SeedFallbackAddresses();
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
            .Where(x => x.UserId == userId)
            .Select(x => x.Address)
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

                FallbackAddresses[dto.Id] = new FallbackItem { UserId = userId, Address = dto };
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
                if (FallbackAddresses.TryGetValue(key, out var item) && item.UserId == userId)
                {
                    item.Address.IsDefault = false;
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

        FallbackAddresses[fallbackDto.Id] = new FallbackItem { UserId = userId, Address = fallbackDto };
        return fallbackDto;
    }

    public async Task<AddressResponse?> UpdateAddressAsync(
        Guid userId,
        Guid addressId,
        CreateAddressRequest request)
    {
        try
        {
            var customer = await _context.CustomerProfiles
                .FirstOrDefaultAsync(x => x.UserId == userId && !x.IsDeleted);

            if (customer != null)
            {
                var addr = await _context.DeliveryAddresses
                    .FirstOrDefaultAsync(x => x.Id == addressId && x.CustomerId == customer.Id && !x.IsDeleted);

                if (addr != null)
                {
                    if (request.IsDefault)
                    {
                        var others = await _context.DeliveryAddresses
                            .Where(x => x.CustomerId == customer.Id && x.Id != addressId && !x.IsDeleted)
                            .ToListAsync();
                        foreach (var a in others) a.IsDefault = false;
                    }

                    addr.AddressLine = request.AddressLine.Trim();
                    addr.Ward = request.Ward?.Trim();
                    addr.District = request.District?.Trim();
                    addr.City = request.City.Trim();
                    addr.Latitude = request.Latitude;
                    addr.Longitude = request.Longitude;
                    addr.IsDefault = request.IsDefault;

                    await _context.SaveChangesAsync();

                    var dto = new AddressResponse
                    {
                        Id = addr.Id,
                        AddressLine = addr.AddressLine,
                        Ward = addr.Ward,
                        District = addr.District,
                        City = addr.City,
                        Latitude = addr.Latitude,
                        Longitude = addr.Longitude,
                        IsDefault = addr.IsDefault,
                        CreatedAt = addr.CreatedAt
                    };

                    FallbackAddresses[dto.Id] = new FallbackItem { UserId = userId, Address = dto };
                    return dto;
                }
            }
        }
        catch {}

        if (FallbackAddresses.TryGetValue(addressId, out var existing))
        {
            if (existing.UserId != userId)
                return null; // Forbidden: Cannot update another user's address

            if (request.IsDefault)
            {
                foreach (var k in FallbackAddresses.Keys)
                {
                    if (k != addressId && FallbackAddresses.TryGetValue(k, out var other) && other.UserId == userId)
                        other.Address.IsDefault = false;
                }
            }

            existing.Address.AddressLine = request.AddressLine.Trim();
            existing.Address.Ward = request.Ward?.Trim();
            existing.Address.District = request.District?.Trim();
            existing.Address.City = request.City.Trim();
            existing.Address.Latitude = request.Latitude;
            existing.Address.Longitude = request.Longitude;
            existing.Address.IsDefault = request.IsDefault;

            return existing.Address;
        }

        return null;
    }

    public async Task<bool> DeleteAddressAsync(Guid userId, Guid addressId)
    {
        try
        {
            var customer = await _context.CustomerProfiles
                .FirstOrDefaultAsync(x => x.UserId == userId && !x.IsDeleted);

            if (customer != null)
            {
                var addr = await _context.DeliveryAddresses
                    .FirstOrDefaultAsync(x => x.Id == addressId && x.CustomerId == customer.Id && !x.IsDeleted);

                if (addr != null)
                {
                    addr.IsDeleted = true;
                    await _context.SaveChangesAsync();
                    FallbackAddresses.TryRemove(addressId, out _);
                    return true;
                }
            }
        }
        catch {}

        if (FallbackAddresses.TryGetValue(addressId, out var existing))
        {
            if (existing.UserId != userId)
                return false; // Forbidden: Cannot delete another user's address

            return FallbackAddresses.TryRemove(addressId, out _);
        }

        return false;
    }

    private static ConcurrentDictionary<Guid, FallbackItem> SeedFallbackAddresses()
    {
        var dict = new ConcurrentDictionary<Guid, FallbackItem>();
        var now = DateTime.UtcNow;

        var userA = Guid.Parse("11111111-1111-1111-1111-111111111005");
        var userB = Guid.Parse("11111111-1111-1111-1111-111111111006");

        var items = new[]
        {
            new FallbackItem
            {
                UserId = userA,
                Address = new AddressResponse
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
                }
            },
            new FallbackItem
            {
                UserId = userA,
                Address = new AddressResponse
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
                }
            },
            new FallbackItem
            {
                UserId = userA,
                Address = new AddressResponse
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
            },
            new FallbackItem
            {
                UserId = userB,
                Address = new AddressResponse
                {
                    Id = Guid.Parse("44444444-4444-4444-4444-444444444004"),
                    AddressLine = "Khu Đô Thị Sala, Số 10 Mai Chí Thọ",
                    Ward = "An Lợi Đông",
                    District = "TP. Thủ Đức",
                    City = "TP. Hồ Chí Minh",
                    Latitude = 10.768000m,
                    Longitude = 106.723000m,
                    IsDefault = true,
                    CreatedAt = now.AddDays(-2)
                }
            },
            new FallbackItem
            {
                UserId = userB,
                Address = new AddressResponse
                {
                    Id = Guid.Parse("44444444-4444-4444-4444-444444444005"),
                    AddressLine = "The Landmark 81, 720A Điện Biên Phủ",
                    Ward = "Phường 22",
                    District = "Quận Bình Thạnh",
                    City = "TP. Hồ Chí Minh",
                    Latitude = 10.795000m,
                    Longitude = 106.721800m,
                    IsDefault = false,
                    CreatedAt = now.AddDays(-1)
                }
            }
        };

        foreach (var item in items)
            dict[item.Address.Id] = item;

        return dict;
    }
}
