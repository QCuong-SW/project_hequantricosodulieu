using SmartDroneDelivery.Application.DTOs;

namespace SmartDroneDelivery.Application.Interfaces;

public interface IAddressService
{
    Task<IEnumerable<AddressResponse>> GetMyAddressesAsync(Guid userId);

    Task<AddressResponse> CreateAddressAsync(
        Guid userId,
        CreateAddressRequest request);
}