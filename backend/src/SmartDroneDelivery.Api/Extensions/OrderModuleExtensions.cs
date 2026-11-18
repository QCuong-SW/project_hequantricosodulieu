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
        services.AddScoped<IOrderCancellationService, OrderCancellationService>();
        services.AddScoped<OrderLifecycleE2EVerifier>();
        return services;
    }
}
