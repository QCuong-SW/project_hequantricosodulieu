using SmartDroneDelivery.Application;
using SmartDroneDelivery.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Đăng ký Controllers
builder.Services.AddControllers();

// Đăng ký OpenAPI
builder.Services.AddOpenApi();

// Đăng ký Application
builder.Services.AddApplicationServices();

// Đăng ký kết nối Database
var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Database connection string is missing.");
}

builder.Services.AddInfrastructureServices(connectionString);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Kích hoạt Controllers
app.MapControllers();

app.Run();