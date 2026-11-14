using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace SmartDroneDelivery.Infrastructure.SignalR;

public class DroneSimulatorWorker : BackgroundService
{
    private readonly IHubContext<TrackingHub> _hubContext;
    private readonly ILogger<DroneSimulatorWorker> _logger;

    private const double StartLat = 10.7769;
    private const double StartLng = 106.7009;
    private const double EndLat = 10.8015;
    private const double EndLng = 106.7145;
    private const int TotalSteps = 30;

    public DroneSimulatorWorker(
        IHubContext<TrackingHub> hubContext,
        ILogger<DroneSimulatorWorker> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Drone Flight Simulator Worker started (2s GPS interval).");

        var currentStep = 0;
        const string simulatedOrderId = "ORD-2026-0001";

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                double progress = (double)currentStep / TotalSteps;

                double currentLat = Math.Round(StartLat + (EndLat - StartLat) * progress, 6);
                double currentLng = Math.Round(StartLng + (EndLng - StartLng) * progress, 6);

                double altitude = progress is > 0.1 and < 0.9 ? 65.0 : 15.0;
                double speedKmh = progress >= 1.0 ? 0.0 : 42.5;
                double battery = Math.Round(Math.Max(20.0, 98.0 - (progress * 25.0)), 1);

                string flightStatus = progress switch
                {
                    0 => "TAKEOFF",
                    >= 1.0 => "ARRIVED_WAITING_OTP",
                    > 0.85 => "APPROACHING_DESTINATION",
                    _ => "IN_TRANSIT"
                };

                var payload = new
                {
                    OrderId = simulatedOrderId,
                    DroneCode = "DRN-VN-04",
                    Latitude = currentLat,
                    Longitude = currentLng,
                    AltitudeMeters = altitude,
                    SpeedKmh = speedKmh,
                    BatteryPercent = battery,
                    ProgressPercent = Math.Round(progress * 100, 0),
                    Status = flightStatus,
                    Timestamp = DateTime.UtcNow
                };

                var groupName = TrackingHub.GetOrderGroupName(simulatedOrderId);
                await _hubContext.Clients.Group(groupName)
                    .SendAsync("ReceiveDronePosition", payload, stoppingToken);

                await _hubContext.Clients.All
                    .SendAsync("ReceiveDronePosition", payload, stoppingToken);

                currentStep = (currentStep + 1) % (TotalSteps + 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error broadcasting simulated GPS coordinates.");
            }

            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }
}