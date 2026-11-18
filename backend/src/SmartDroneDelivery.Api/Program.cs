using SmartDroneDelivery.Application;
using SmartDroneDelivery.Infrastructure;
using SmartDroneDelivery.Infrastructure.Ai;
using SmartDroneDelivery.Infrastructure.SignalR;
using SmartDroneDelivery.Api.Extensions;
using SmartDroneDelivery.Api.Services;
using SmartDroneDelivery.Application.Common.Interfaces;
using SmartDroneDelivery.Application.Features.Stations;

var builder = WebApplication.CreateBuilder(args);

// Đăng ký Controllers
builder.Services.AddControllers();

// Đăng ký OpenAPI
builder.Services.AddOpenApi();

// Đăng ký CORS cho Web (Vite) và Mobile (Flutter)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllClients", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Đăng ký Application & Các Module Nghiệp vụ
builder.Services.AddApplicationServices();
builder.Services.AddOrderModule();
builder.Services.AddSchedulingModule();
builder.Services.AddSingleton<IStationQueryService, StationQueryService>();
builder.Services.AddSingleton<IPackageHandoffService, PackageHandoffService>();

// Đăng ký kết nối Database & Infrastructure
var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Database connection string is missing.");
}

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddAiServices(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddRoleAuthorization();

// Đăng ký SignalR & Background Drone Simulator Worker
builder.Services.AddSignalR();
builder.Services.AddHostedService<DroneSimulatorWorker>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAllClients");
app.UseAuthentication();
app.UseAuthorization();

// Kích hoạt Controllers & SignalR Hubs
app.MapControllers();
app.MapHub<TrackingHub>("/hubs/tracking");

app.Run();