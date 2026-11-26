using SmartDroneDelivery.Application;
using SmartDroneDelivery.Infrastructure;
using SmartDroneDelivery.Infrastructure.Ai;
using SmartDroneDelivery.Infrastructure.SignalR;
using SmartDroneDelivery.Api.Extensions;
using SmartDroneDelivery.Api.Services;
using SmartDroneDelivery.Application.Common.Interfaces;
using SmartDroneDelivery.Application.Features.Stations;

// Tự động nạp file .env từ thư mục gốc dự án (nếu tồn tại) để đọc Ai__Llm__ApiKey, BaseUrl, Model...
LoadDotEnvFromAncestors(Directory.GetCurrentDirectory());

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

static void LoadDotEnvFromAncestors(string startDir)
{
    var dir = new DirectoryInfo(startDir);
    for (var depth = 0; depth < 6 && dir is not null; depth++, dir = dir.Parent)
    {
        var envPath = Path.Combine(dir.FullName, ".env");
        if (!File.Exists(envPath)) continue;

        foreach (var rawLine in File.ReadAllLines(envPath))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line) || line.StartsWith('#')) continue;
            var sepIndex = line.IndexOf('=');
            if (sepIndex <= 0) continue;

            var key = line[..sepIndex].Trim();
            var value = line[(sepIndex + 1)..].Trim().Trim('"', '\'');
            if (!string.IsNullOrEmpty(key) && !string.IsNullOrEmpty(value))
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
        break;
    }

    static string? ReadEnv(string name) =>
        Environment.GetEnvironmentVariable(name, EnvironmentVariableTarget.Process)
        ?? Environment.GetEnvironmentVariable(name, EnvironmentVariableTarget.User)
        ?? Environment.GetEnvironmentVariable(name, EnvironmentVariableTarget.Machine);

    // Tự động nhận diện API Key từ biến môi trường (Ai__Llm__ApiKey / OPENAI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY)
    var apiKey = ReadEnv("Ai__Llm__ApiKey");
    if (string.IsNullOrWhiteSpace(apiKey))
    {
        var openAiKey = ReadEnv("OPENAI_API_KEY");
        var geminiKey = ReadEnv("GEMINI_API_KEY");
        var groqKey = ReadEnv("GROQ_API_KEY");

        if (!string.IsNullOrWhiteSpace(openAiKey))
        {
            apiKey = openAiKey.Trim();
            Environment.SetEnvironmentVariable("Ai__Llm__ApiKey", apiKey);
            Environment.SetEnvironmentVariable("Ai__Llm__BaseUrl", "https://api.openai.com/v1");
            Environment.SetEnvironmentVariable("Ai__Llm__Model", "gpt-4o-mini");
        }
        else if (!string.IsNullOrWhiteSpace(geminiKey))
        {
            apiKey = geminiKey.Trim();
            Environment.SetEnvironmentVariable("Ai__Llm__ApiKey", apiKey);
            Environment.SetEnvironmentVariable("Ai__Llm__BaseUrl", "https://generativelanguage.googleapis.com/v1beta/openai");
            Environment.SetEnvironmentVariable("Ai__Llm__Model", "gemini-flash-lite-latest");
        }
        else if (!string.IsNullOrWhiteSpace(groqKey))
        {
            apiKey = groqKey.Trim();
            Environment.SetEnvironmentVariable("Ai__Llm__ApiKey", apiKey);
            Environment.SetEnvironmentVariable("Ai__Llm__BaseUrl", "https://api.groq.com/openai/v1");
            Environment.SetEnvironmentVariable("Ai__Llm__Model", "llama-3.3-70b-versatile");
        }
    }

    // Tự động khớp BaseUrl & Model theo định dạng key nếu người dùng dán key vào .env mà quên đổi BaseUrl
    if (!string.IsNullOrWhiteSpace(apiKey))
    {
        if (apiKey.StartsWith("sk-", StringComparison.Ordinal))
        {
            Environment.SetEnvironmentVariable("Ai__Llm__BaseUrl", "https://api.openai.com/v1");
            Environment.SetEnvironmentVariable("Ai__Llm__Model", "gpt-4o-mini");
        }
        else if (apiKey.StartsWith("gsk_", StringComparison.Ordinal))
        {
            Environment.SetEnvironmentVariable("Ai__Llm__BaseUrl", "https://api.groq.com/openai/v1");
            Environment.SetEnvironmentVariable("Ai__Llm__Model", "llama-3.3-70b-versatile");
        }
        else if (apiKey.StartsWith("AIza", StringComparison.Ordinal) || apiKey.StartsWith("AQ.", StringComparison.Ordinal))
        {
            Environment.SetEnvironmentVariable("Ai__Llm__BaseUrl", "https://generativelanguage.googleapis.com/v1beta/openai");
            if (string.IsNullOrWhiteSpace(ReadEnv("Ai__Llm__Model")) || ReadEnv("Ai__Llm__Model") == "gemini-2.0-flash")
            {
                Environment.SetEnvironmentVariable("Ai__Llm__Model", "gemini-flash-lite-latest");
            }
        }
    }
}