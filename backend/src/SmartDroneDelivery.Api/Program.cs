using SmartDroneDelivery.Application.Features.Stations;
using SmartDroneDelivery.Infrastructure.SignalR;
using SmartDroneDelivery.Application;
using SmartDroneDelivery.Infrastructure;
using SmartDroneDelivery.Api.Extensions;
using SmartDroneDelivery.Api.Services;
using SmartDroneDelivery.Application.Common.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Đăng ký Controllers
builder.Services.AddControllers();

// M4: SignalR, simulator và các service trạm/bàn giao
builder.Services.AddSignalR();
builder.Services.AddHostedService<DroneSimulatorWorker>();
builder.Services.AddScoped<IStationQueryService, StationQueryService>();
builder.Services.AddScoped<IPackageHandoffService, PackageHandoffService>();

// Đăng ký OpenAPI
builder.Services.AddOpenApi();

// Đăng ký Application
builder.Services.AddApplicationServices();

// Kiểm tra cấu hình Database
var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Database connection string is missing.");
}

// Đăng ký Infrastructure và thông tin người dùng hiện tại
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

// Authentication và Authorization
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddRoleAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

// Kích hoạt Controllers và SignalR Hub
app.MapControllers();
app.MapHub<TrackingHub>("/hubs/tracking");

app.Run();