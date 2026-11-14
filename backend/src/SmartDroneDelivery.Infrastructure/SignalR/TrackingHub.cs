using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace SmartDroneDelivery.Infrastructure.SignalR;

public class TrackingHub : Hub
{
    public static string GetOrderGroupName(string orderId) => $"order-{orderId}";

    public async Task JoinOrderTrackingGroup(string orderId)
    {
        if (string.IsNullOrWhiteSpace(orderId))
            return;

        var groupName = GetOrderGroupName(orderId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        await Clients.Caller.SendAsync("JoinedTrackingGroup", new
        {
            OrderId = orderId,
            GroupName = groupName,
            ConnectionId = Context.ConnectionId,
            JoinedAt = DateTime.UtcNow
        });
    }

    public async Task LeaveOrderTrackingGroup(string orderId)
    {
        if (string.IsNullOrWhiteSpace(orderId))
            return;

        var groupName = GetOrderGroupName(orderId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task BroadcastDroneTelemetry(
        string orderId,
        double latitude,
        double longitude,
        double altitudeMeters,
        double speedKmh,
        double batteryPercent,
        string flightStatus)
    {
        var groupName = GetOrderGroupName(orderId);
        await Clients.Group(groupName).SendAsync("ReceiveDronePosition", new
        {
            OrderId = orderId,
            Latitude = latitude,
            Longitude = longitude,
            AltitudeMeters = altitudeMeters,
            SpeedKmh = speedKmh,
            BatteryPercent = batteryPercent,
            Status = flightStatus,
            Timestamp = DateTime.UtcNow
        });
    }
}