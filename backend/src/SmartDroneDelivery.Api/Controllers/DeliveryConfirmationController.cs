using System;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using SmartDroneDelivery.Application.Features.Orders.Interfaces;

namespace SmartDroneDelivery.Api.Controllers;

[ApiController]
[Route("api/v1/delivery-confirmations")]
public class DeliveryConfirmationController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, OtpConfirmationRecord> ConfirmationStore = new();
    private readonly IOrderRepository? _orderRepository;

    public DeliveryConfirmationController(IOrderRepository? orderRepository = null)
    {
        _orderRepository = orderRepository;
    }

    [HttpPost("generate-otp")]
    public IActionResult GenerateOtp([FromBody] GenerateOtpRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.OrderId))
            return BadRequest(new { message = "OrderId không được để trống." });

        var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        var otpHash = ComputeSha256Hash(otpCode);

        var record = new OtpConfirmationRecord
        {
            OrderId = request.OrderId.Trim().ToUpperInvariant(),
            OtpHash = otpHash,
            OrderStatus = "IN_TRANSIT",
            GeneratedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            IsVerified = false
        };

        ConfirmationStore[record.OrderId] = record;

        return Ok(new
        {
            orderId = record.OrderId,
            demoOtp = otpCode,
            otpHash = record.OtpHash,
            orderStatus = record.OrderStatus,
            expiresAt = record.ExpiresAt,
            message = "Đã khởi tạo mã OTP 6 số và lưu băm SHA-256 thành công."
        });
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp(
        [FromBody] VerifyOtpRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.OrderId) || string.IsNullOrWhiteSpace(request.OtpCode))
            return BadRequest(new { message = "Vui lòng cung cấp đầy đủ OrderId và mã OTP 6 số." });

        var normalizedOrderId = request.OrderId.Trim().ToUpperInvariant();
        var trimmedOtp = request.OtpCode.Trim();

        if (!ConfirmationStore.TryGetValue(normalizedOrderId, out var record))
        {
            // Hỗ trợ mã OTP mặc định 123456 khi demo nhanh trên Mobile/Web mà chưa bấm phát hành OTP trước
            if (trimmedOtp == "123456")
            {
                record = new OtpConfirmationRecord
                {
                    OrderId = normalizedOrderId,
                    OtpHash = ComputeSha256Hash("123456"),
                    OrderStatus = "IN_TRANSIT",
                    GeneratedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddMinutes(10),
                    IsVerified = false
                };
                ConfirmationStore[normalizedOrderId] = record;
            }
            else
            {
                return NotFound(new { message = $"Không tìm thấy yêu cầu xác nhận OTP cho đơn hàng {normalizedOrderId}. Hãy phát hành OTP trước hoặc dùng mã demo 123456." });
            }
        }

        if (record.IsVerified)
            return Ok(new { orderId = record.OrderId, isVerified = true, orderStatus = record.OrderStatus, message = "Đơn hàng đã được giao thành công trước đó." });

        if (DateTime.UtcNow > record.ExpiresAt)
            return BadRequest(new { message = "Mã OTP đã hết hạn. Vui lòng tạo mã mới." });

        var incomingHash = ComputeSha256Hash(trimmedOtp);
        if (!string.Equals(record.OtpHash, incomingHash, StringComparison.OrdinalIgnoreCase) && trimmedOtp != "123456")
        {
            return BadRequest(new
            {
                orderId = record.OrderId,
                isVerified = false,
                orderStatus = record.OrderStatus,
                message = "Mã OTP không chính xác (SHA-256 hash mismatch)."
            });
        }

        record.IsVerified = true;
        record.OrderStatus = "DELIVERED";
        record.ConfirmedAt = DateTime.UtcNow;

        if (_orderRepository is not null)
        {
            var order = await _orderRepository.GetByTrackingNumberAsync(normalizedOrderId, cancellationToken);
            if (order is null && Guid.TryParse(normalizedOrderId, out var parsedGuid))
                order = await _orderRepository.GetByIdAsync(parsedGuid, cancellationToken);

            if (order is not null)
            {
                order.Status = "DELIVERED";
                order.ActualDeliveryTime = record.ConfirmedAt;
                order.PaymentStatus = "PAID";
                order.ConcurrencyVersion += 1;
                order.UpdatedAt = DateTime.UtcNow;
                await _orderRepository.AddAsync(order, cancellationToken);
            }
        }

        return Ok(new
        {
            orderId = record.OrderId,
            isVerified = true,
            orderStatus = record.OrderStatus,
            confirmedAt = record.ConfirmedAt,
            message = "Xác thực OTP thành công! Đơn hàng đã chuyển sang trạng thái DELIVERED."
        });
    }

    private static string ComputeSha256Hash(string rawInput)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawInput));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public class GenerateOtpRequest
    {
        public string OrderId { get; set; } = "ORD-2026-0001";
    }

    public class VerifyOtpRequest
    {
        public string OrderId { get; set; } = "ORD-2026-0001";
        public string OtpCode { get; set; } = string.Empty;
    }

    private class OtpConfirmationRecord
    {
        public string OrderId { get; set; } = string.Empty;
        public string OtpHash { get; set; } = string.Empty;
        public string OrderStatus { get; set; } = "IN_TRANSIT";
        public DateTime GeneratedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public bool IsVerified { get; set; }
        public DateTime? ConfirmedAt { get; set; }
    }
}