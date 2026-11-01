using Microsoft.EntityFrameworkCore;
using SmartDroneDelivery.Application.DTOs;
using SmartDroneDelivery.Application.Interfaces;
using SmartDroneDelivery.Domain.Entities;

namespace SmartDroneDelivery.Application.Services;

public class AddressService : IAddressService
{
    private readonly IAppDbContext _context;

    public AddressService(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<AddressResponse>> GetMyAddressesAsync(Guid userId)
    {
        var customer = await _context.CustomerProfiles
            .FirstOrDefaultAsync(x => x.UserId == userId && !x.IsDeleted);

        if (customer == null)
            throw new KeyNotFoundException("Customer profile not found.");

        return await _context.DeliveryAddresses
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
    }

    public async Task<AddressResponse> CreateAddressAsync(
        Guid userId,
        CreateAddressRequest request)
    {
        var customer = await _context.CustomerProfiles
            .FirstOrDefaultAsync(x => x.UserId == userId && !x.IsDeleted);

        if (customer == null)
            throw new KeyNotFoundException("Customer profile not found.");

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

        return new AddressResponse
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
    }
}