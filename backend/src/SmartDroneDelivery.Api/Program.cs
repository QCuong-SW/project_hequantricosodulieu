using SmartDroneDelivery.Application;
using SmartDroneDelivery.Infrastructure;
using SmartDroneDelivery.Api.Extensions;
using SmartDroneDelivery.Api.Services;
using SmartDroneDelivery.Application.Common.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Đăng ký Controllers
builder.Services.AddControllers();
builder.Services.AddApiResponseWrapping();      // thêm dòng này ngay dưới AddControllers

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

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
  builder.Services.AddJwtAuthentication(builder.Configuration);
  builder.Services.AddRoleAuthorization();

var app = builder.Build();
app.UseApiResponseHandling();    

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
  app.UseAuthentication();
  app.UseAuthorization();

// Kích hoạt Controllers
app.MapControllers();

app.Run();