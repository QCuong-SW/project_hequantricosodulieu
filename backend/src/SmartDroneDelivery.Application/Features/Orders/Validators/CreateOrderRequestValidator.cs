using SmartDroneDelivery.Application.Features.Orders.DTOs;

namespace SmartDroneDelivery.Application.Features.Orders.Validators;

public static class CreateOrderRequestValidator
{
    private static readonly HashSet<string> ValidPickupMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "STATION_DROP", "SENDER_ADDRESS"
    };

    private static readonly HashSet<string> ValidDeliveryMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "STATION_PICKUP", "CUSTOMER_ADDRESS"
    };

    private const decimal MaxOrderWeightKg = 5.00m;

    public static List<string> Validate(CreateOrderRequest? request)
    {
        var errors = new List<string>();

        if (request is null)
        {
            errors.Add("Request payload cannot be null.");
            return errors;
        }

        if (request.CustomerId == Guid.Empty)
            errors.Add("CustomerId is required.");

        if (!ValidPickupMethods.Contains(request.PickupMethod))
            errors.Add("PickupMethod must be 'STATION_DROP' or 'SENDER_ADDRESS'.");

        if (!ValidDeliveryMethods.Contains(request.DeliveryMethod))
            errors.Add("DeliveryMethod must be 'STATION_PICKUP' or 'CUSTOMER_ADDRESS'.");

        if (request.RequestedDeliveryTime.HasValue && request.RequestedDeliveryTime.Value <= DateTime.UtcNow)
            errors.Add("RequestedDeliveryTime must be in the future.");

        ValidateContactAddress(request.Sender, "Sender", errors);
        ValidateContactAddress(request.Recipient, "Recipient", errors);

        if (request.Packages is null || request.Packages.Count == 0)
        {
            errors.Add("At least one package is required.");
        }
        else
        {
            decimal totalWeight = 0m;
            for (int i = 0; i < request.Packages.Count; i++)
            {
                var pkg = request.Packages[i];
                var prefix = $"Packages[{i}]";

                if (string.IsNullOrWhiteSpace(pkg.Description) || pkg.Description.Length > 255)
                    errors.Add($"{prefix}.Description is required and must not exceed 255 characters.");

                if (pkg.WeightKg < 0.01m || pkg.WeightKg > MaxOrderWeightKg)
                    errors.Add($"{prefix}.WeightKg must be between 0.01 and {MaxOrderWeightKg} kg.");

                if (pkg.LengthCm <= 0 || pkg.WidthCm <= 0 || pkg.HeightCm <= 0)
                    errors.Add($"{prefix} dimensions (LengthCm, WidthCm, HeightCm) must be greater than 0.");

                if (pkg.DeclaredValue < 0)
                    errors.Add($"{prefix}.DeclaredValue cannot be negative.");

                if (pkg.IsHazardous)
                    errors.Add($"{prefix} hazardous items are prohibited for drone delivery.");

                totalWeight += pkg.WeightKg;
            }

            if (totalWeight > MaxOrderWeightKg)
                errors.Add($"Total order weight ({totalWeight} kg) exceeds maximum drone payload limit ({MaxOrderWeightKg} kg).");
        }

        return errors;
    }

    private static void ValidateContactAddress(OrderContactAddressDto? contact, string role, List<string> errors)
    {
        if (contact is null)
        {
            errors.Add($"{role} address information is required.");
            return;
        }

        if (string.IsNullOrWhiteSpace(contact.Name) || contact.Name.Length > 100)
            errors.Add($"{role}.Name is required and must not exceed 100 characters.");

        if (string.IsNullOrWhiteSpace(contact.Phone) || contact.Phone.Length > 20)
            errors.Add($"{role}.Phone is required and must not exceed 20 characters.");

        if (string.IsNullOrWhiteSpace(contact.AddressText) || contact.AddressText.Length > 300)
            errors.Add($"{role}.AddressText is required and must not exceed 300 characters.");

        if (contact.Latitude < -90m || contact.Latitude > 90m)
            errors.Add($"{role}.Latitude must be between -90 and 90.");

        if (contact.Longitude < -180m || contact.Longitude > 180m)
            errors.Add($"{role}.Longitude must be between -180 and 180.");
    }
}
