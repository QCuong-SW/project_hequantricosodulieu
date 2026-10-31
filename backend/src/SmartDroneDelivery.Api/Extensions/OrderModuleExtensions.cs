using SmartDroneDelivery.Application.Features.Orders.Interfaces;
using SmartDroneDelivery.Application.Features.Orders.Services;
using SmartDroneDelivery.Infrastructure.Persistence.Orders;

namespace SmartDroneDelivery.Api.Extensions;

public static class OrderModuleExtensions
{
    public static IServiceCollection AddOrderModule(this IServiceCollection services)
    {
        services.AddSingleton<IOrderRepository, InMemoryOrderRepository>();
        services.AddScoped<IOrderService, OrderService>();
        return services;
    }
}
