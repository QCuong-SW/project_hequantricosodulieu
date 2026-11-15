using SmartDroneDelivery.Application.Features.Scheduling.Interfaces;
using SmartDroneDelivery.Application.Features.Scheduling.Services;

namespace SmartDroneDelivery.Api.Extensions;

public static class SchedulingModuleExtensions
{
    public static IServiceCollection AddSchedulingModule(this IServiceCollection services)
    {
        services.AddScoped<IFlightScheduleService, FlightScheduleService>();
        return services;
    }
}
