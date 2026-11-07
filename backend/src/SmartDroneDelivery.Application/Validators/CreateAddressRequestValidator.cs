using FluentValidation;
using SmartDroneDelivery.Application.DTOs;

namespace SmartDroneDelivery.Application.Validators;

public class CreateAddressRequestValidator
    : AbstractValidator<CreateAddressRequest>
{
    public CreateAddressRequestValidator()
    {
        RuleFor(x => x.AddressLine)
            .NotEmpty()
            .WithMessage("AddressLine is required.")
            .MaximumLength(255);

        RuleFor(x => x.City)
            .NotEmpty()
            .WithMessage("City is required.")
            .MaximumLength(100);

        RuleFor(x => x.Ward)
            .MaximumLength(100);

        RuleFor(x => x.District)
            .MaximumLength(100);

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90m, 90m)
            .When(x => x.Latitude.HasValue)
            .WithMessage("Latitude must be between -90 and 90.");

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180m, 180m)
            .When(x => x.Longitude.HasValue)
            .WithMessage("Longitude must be between -180 and 180.");

        RuleFor(x => x)
            .Must(x => x.Latitude.HasValue == x.Longitude.HasValue)
            .WithMessage("Latitude and Longitude must be provided together.");
    }
}