// backend/src/SmartDroneDelivery.Application/Features/AiServices/GeoMath.cs
namespace SmartDroneDelivery.Application.Features.AiServices;

public static class GeoMath
{
    private const double EarthRadiusKm = 6371.0;

    /// <summary>Khoảng cách đường chim bay (km) giữa 2 tọa độ theo công thức Haversine.</summary>
    public static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        static double Rad(double d) => d * Math.PI / 180;
        var dLat = Rad(lat2 - lat1);
        var dLon = Rad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return EarthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
