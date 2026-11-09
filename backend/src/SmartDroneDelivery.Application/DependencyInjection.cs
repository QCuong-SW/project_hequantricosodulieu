using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using SmartDroneDelivery.Application.Interfaces;
using SmartDroneDelivery.Application.Services;
using SmartDroneDelivery.Application.Validators;

namespace SmartDroneDelivery.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(
        this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(
            typeof(DependencyInjection).Assembly);

        services.AddScoped<IAddressService, AddressService>();

        return services;
    }
}