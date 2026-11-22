using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartDroneDelivery.Api.Controllers;

public class StoreProductItem
{
    public string Id { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "Thiết bị & Công nghệ";
    public string Description { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal WeightKg { get; set; } = 0.5m;
    public int Stock { get; set; } = 50;
    public bool IsFragile { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UpsertProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "Thiết bị & Công nghệ";
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public decimal WeightKg { get; set; } = 0.5m;
    public int Stock { get; set; } = 50;
    public bool IsFragile { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CustomerFeedbackItem
{
    public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string TrackingNumber { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public int Rating { get; set; } = 5;
    public string Comment { get; set; } = string.Empty;
    public string? AdminReply { get; set; }
    public DateTime? RepliedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CreateFeedbackRequest
{
    public string? OrderId { get; set; }
    public string? TrackingNumber { get; set; }
    public string? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerEmail { get; set; }
    public int Rating { get; set; } = 5;
    public string Comment { get; set; } = string.Empty;
}

public class ReplyFeedbackRequest
{
    public string AdminReply { get; set; } = string.Empty;
}

[ApiController]
[Route("api/v1")]
public class StoreController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, StoreProductItem> Products = SeedInitialProducts();
    private static readonly ConcurrentDictionary<string, CustomerFeedbackItem> Feedbacks = SeedInitialFeedbacks();

    // ------------------------------------------------------------------ PRODUCTS
    [HttpGet("products")]
    [AllowAnonymous]
    public IActionResult GetProducts([FromQuery] bool activeOnly = false)
    {
        var query = Products.Values.AsEnumerable();
        if (activeOnly)
        {
            query = query.Where(p => p.IsActive && p.Stock > 0);
        }

        return Ok(new
        {
            success = true,
            data = query.OrderByDescending(p => p.CreatedAt).ToList()
        });
    }

    [HttpPost("products")]
    [AllowAnonymous]
    public IActionResult CreateProduct([FromBody] UpsertProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { success = false, message = "Tên sản phẩm không được để trống." });
        }

        if (request.WeightKg <= 0 || request.WeightKg > 5.0m)
        {
            return BadRequest(new { success = false, message = "Trọng lượng sản phẩm giao bằng Drone phải từ 0.1 kg đến tối đa 5.0 kg." });
        }

        var id = Guid.NewGuid().ToString();
        var sku = $"DRP-{Random.Shared.Next(1000, 9999)}";
        var item = new StoreProductItem
        {
            Id = id,
            Sku = sku,
            Name = request.Name.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Hàng tiêu dùng" : request.Category.Trim(),
            Description = request.Description?.Trim() ?? "Sản phẩm hỗ trợ giao nhanh bằng Drone nội đô TP.HCM.",
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl)
                ? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80"
                : request.ImageUrl.Trim(),
            Price = Math.Max(0, request.Price),
            WeightKg = Math.Round(request.WeightKg, 2),
            Stock = Math.Max(0, request.Stock),
            IsFragile = request.IsFragile,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        Products[id] = item;

        return Ok(new
        {
            success = true,
            message = $"Đã thêm sản phẩm '{item.Name}' thành công.",
            data = item
        });
    }

    [HttpPut("products/{id}")]
    [AllowAnonymous]
    public IActionResult UpdateProduct(string id, [FromBody] UpsertProductRequest request)
    {
        if (!Products.TryGetValue(id, out var existing))
        {
            return NotFound(new { success = false, message = "Không tìm thấy sản phẩm." });
        }

        if (request.WeightKg <= 0 || request.WeightKg > 5.0m)
        {
            return BadRequest(new { success = false, message = "Trọng lượng sản phẩm giao bằng Drone phải từ 0.1 kg đến tối đa 5.0 kg." });
        }

        existing.Name = string.IsNullOrWhiteSpace(request.Name) ? existing.Name : request.Name.Trim();
        existing.Category = string.IsNullOrWhiteSpace(request.Category) ? existing.Category : request.Category.Trim();
        existing.Description = request.Description?.Trim() ?? existing.Description;
        if (!string.IsNullOrWhiteSpace(request.ImageUrl))
        {
            existing.ImageUrl = request.ImageUrl.Trim();
        }
        existing.Price = Math.Max(0, request.Price);
        existing.WeightKg = Math.Round(request.WeightKg, 2);
        existing.Stock = Math.Max(0, request.Stock);
        existing.IsFragile = request.IsFragile;
        existing.IsActive = request.IsActive;

        return Ok(new
        {
            success = true,
            message = $"Đã cập nhật sản phẩm '{existing.Name}'.",
            data = existing
        });
    }

    [HttpDelete("products/{id}")]
    [AllowAnonymous]
    public IActionResult DeleteProduct(string id)
    {
        if (!Products.TryRemove(id, out _))
        {
            return NotFound(new { success = false, message = "Không tìm thấy sản phẩm cần xóa." });
        }

        return Ok(new
        {
            success = true,
            message = "Đã xóa sản phẩm khỏi danh mục."
        });
    }

    // ------------------------------------------------------------------ FEEDBACKS
    [HttpGet("feedbacks")]
    [AllowAnonymous]
    public IActionResult GetFeedbacks([FromQuery] string? customerId = null)
    {
        var query = Feedbacks.Values.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(customerId))
        {
            query = query.Where(f => string.Equals(f.CustomerId, customerId.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        return Ok(new
        {
            success = true,
            data = query.OrderByDescending(f => f.CreatedAt).ToList()
        });
    }

    [HttpPost("feedbacks")]
    [AllowAnonymous]
    public IActionResult CreateFeedback([FromBody] CreateFeedbackRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Comment))
        {
            return BadRequest(new { success = false, message = "Vui lòng nhập nội dung đánh giá / góp ý." });
        }

        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var email = User.FindFirst("email")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var fullName = User.FindFirst("full_name")?.Value;

        var item = new CustomerFeedbackItem
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = request.OrderId?.Trim() ?? string.Empty,
            TrackingNumber = string.IsNullOrWhiteSpace(request.TrackingNumber) ? "SDD-20261108-482910" : request.TrackingNumber.Trim(),
            CustomerId = !string.IsNullOrWhiteSpace(sub) ? sub : (request.CustomerId ?? "11111111-1111-1111-1111-111111111005"),
            CustomerName = !string.IsNullOrWhiteSpace(fullName) ? fullName : (string.IsNullOrWhiteSpace(request.CustomerName) ? "Khách hàng SmartDrone" : request.CustomerName.Trim()),
            CustomerEmail = !string.IsNullOrWhiteSpace(email) ? email : (string.IsNullOrWhiteSpace(request.CustomerEmail) ? "customer@smartdrone.vn" : request.CustomerEmail.Trim()),
            Rating = Math.Clamp(request.Rating, 1, 5),
            Comment = request.Comment.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        Feedbacks[item.Id] = item;

        return Ok(new
        {
            success = true,
            message = "Cảm ơn bạn đã gửi đánh giá! Phản hồi đã được chuyển tới Quản trị viên.",
            data = item
        });
    }

    [HttpPatch("feedbacks/{id}/reply")]
    [AllowAnonymous]
    public IActionResult ReplyFeedback(string id, [FromBody] ReplyFeedbackRequest request)
    {
        if (!Feedbacks.TryGetValue(id, out var existing))
        {
            return NotFound(new { success = false, message = "Không tìm thấy phản hồi." });
        }

        existing.AdminReply = request.AdminReply?.Trim();
        existing.RepliedAt = DateTime.UtcNow;

        return Ok(new
        {
            success = true,
            message = "Đã gửi phản hồi tới khách hàng.",
            data = existing
        });
    }

    private static ConcurrentDictionary<string, StoreProductItem> SeedInitialProducts()
    {
        var dict = new ConcurrentDictionary<string, StoreProductItem>();
        var now = DateTime.UtcNow;
        var items = new[]
        {
            // 1. ẨM THỰC & ĐỒ UỐNG (ĐA DẠNG MÓN ĂN KÈM ẢNH THỰC TẾ SẮC NÉT CHO GIAO DIỆN MOBILE)
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111001",
                Sku = "DRP-1001",
                Name = "Combo Cà Phê Arabica Cầu Đất & 2 Bánh Croissant Bơ Pháp",
                Category = "Ẩm thực & Đồ uống",
                Description = "2 ly Cold Brew Arabica 100% nguyên chất & 2 bánh sừng bò nướng mới, đóng thùng giữ nhiệt chuyên dụng trên Drone.",
                ImageUrl = "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80",
                Price = 165000m,
                WeightKg = 1.10m,
                Stock = 85,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-18)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111002",
                Sku = "DRP-1002",
                Name = "Set Cơm Bento Cá Hồi Nướng Teriyaki & Salad Rong Biển",
                Category = "Ẩm thực & Đồ uống",
                Description = "Cá hồi Na Uy áp chảo sốt Teriyaki, cơm Nhật dẻo, trứng cuộn Tamago và salad tươi giao nóng trong 12 phút.",
                ImageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
                Price = 195000m,
                WeightKg = 0.85m,
                Stock = 60,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-17)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111003",
                Sku = "DRP-1003",
                Name = "Combo 2 Ly Trà Sữa Oolong Nướng Kem Cheese Trân Châu",
                Category = "Ẩm thực & Đồ uống",
                Description = "Trà Oolong rang đậm vị phủ lớp kem phô mai mặn béo, nắp ép nhiệt chống tràn tuyệt đối khi bay.",
                ImageUrl = "https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=600&q=80",
                Price = 128000m,
                WeightKg = 0.95m,
                Stock = 110,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-16)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111004",
                Sku = "DRP-1004",
                Name = "Pizza Hải Sản Pesto Phô Mai Tươi Size M (Túi Giữ Nhiệt)",
                Category = "Ẩm thực & Đồ uống",
                Description = "Tôm sú, mực tươi, sốt lá húng quế Pesto và phô mai Mozzarella kéo sợi, giao thẳng từ lò nướng.",
                ImageUrl = "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
                Price = 285000m,
                WeightKg = 1.25m,
                Stock = 40,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-15)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111005",
                Sku = "DRP-1005",
                Name = "Hộp Quà Trái Cây Nhập Khẩu (Cherry Mỹ & Nho Mẫu Đơn)",
                Category = "Ẩm thực & Đồ uống",
                Description = "Cherry đỏ size 9.0, Nho Mẫu Đơn Shine Muscat và Táo Envy đóng hộp chống sốc kèm đá gel lạnh.",
                ImageUrl = "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80",
                Price = 590000m,
                WeightKg = 1.80m,
                Stock = 30,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-14)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111006",
                Sku = "DRP-1006",
                Name = "Gà Rán Giòn Hàn Quốc Sốt Mật Ong Tỏi & Khoai Tây",
                Category = "Ẩm thực & Đồ uống",
                Description = "6 miếng cánh & đùi gà rán sốt mật ong tỏi thơm lừng kèm khoai tây lắc phô mai và nước ngọt.",
                ImageUrl = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80",
                Price = 215000m,
                WeightKg = 1.15m,
                Stock = 55,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-13)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111019",
                Sku = "DRP-1007",
                Name = "Burger Bò Wagyu Nướng Than Hồng Phô Mai Cheddar & Khoai",
                Category = "Ẩm thực & Đồ uống",
                Description = "Thịt bò Wagyu Úc nướng mọng nước, phô mai Cheddar tan chảy, sốt nấm Truffle và khoai tây chiên giòn.",
                ImageUrl = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
                Price = 179000m,
                WeightKg = 0.75m,
                Stock = 70,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-12).AddHours(6)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111020",
                Sku = "DRP-1008",
                Name = "Set Sushi & Sashimi Cá Hồi Bụng Tươi Na Uy (16 Miếng)",
                Category = "Ẩm thực & Đồ uống",
                Description = "Sashimi cá hồi tươi cắt dày, Nigiri tôm ngọt, cuộn California trứng tôm kèm đá khô giữ lạnh chuẩn Nhật.",
                ImageUrl = "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80",
                Price = 345000m,
                WeightKg = 0.90m,
                Stock = 45,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-12).AddHours(4)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111021",
                Sku = "DRP-1009",
                Name = "Phở Bò Kobe Thượng Hạng Đóng Hộp Giữ Nhiệt 2 Ngăn",
                Category = "Ẩm thực & Đồ uống",
                Description = "Nước dùng ninh xương 24 giờ đựng bình giữ nhiệt riêng, thịt bò Kobe tái mềm và bánh phở tươi giao nóng hổi.",
                ImageUrl = "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80",
                Price = 155000m,
                WeightKg = 1.20m,
                Stock = 65,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-12).AddHours(2)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111022",
                Sku = "DRP-1010",
                Name = "Bánh Tiramisu Ý & Matcha Cheesecake Nhà Làm (Set 2 Hộp)",
                Category = "Ẩm thực & Đồ uống",
                Description = "Tiramisu phô mai Mascarpone béo mịn kết hợp bánh Cheesecake trà xanh Uji Nhật Bản ít ngọt.",
                ImageUrl = "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80",
                Price = 149000m,
                WeightKg = 0.60m,
                Stock = 80,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-12).AddHours(1)
            },

            // 2. Y TẾ & SỨC KHỎE
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111007",
                Sku = "DRP-2001",
                Name = "Bộ Kit Y Tế & Sơ Cứu Khẩn Cấp Gia Đình 24 Món",
                Category = "Y tế & Sức khỏe",
                Description = "Hộp sơ cứu tiêu chuẩn, thuốc hạ sốt, dung dịch sát khuẩn, băng gạc vô trùng giao hỏa tốc bằng Drone.",
                ImageUrl = "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80",
                Price = 350000m,
                WeightKg = 0.85m,
                Stock = 50,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-12)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111008",
                Sku = "DRP-2002",
                Name = "Máy Đo Huyết Áp Bắp Tay Tự Động Omron HEM-7156",
                Category = "Y tế & Sức khỏe",
                Description = "Công nghệ IntelliWrap 360 độ đo chính xác tại nhà, cảnh báo nhịp tim bất thường và cử động khi đo.",
                ImageUrl = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
                Price = 1450000m,
                WeightKg = 0.60m,
                Stock = 22,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-11)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111009",
                Sku = "DRP-2003",
                Name = "Nhiệt Kế Hồng Ngoại Đo Trán Không Tiếp Xúc Microlife",
                Category = "Y tế & Sức khỏe",
                Description = "Đo thân nhiệt cho bé và gia đình chỉ trong 1 giây, màn hình đổi màu cảnh báo sốt thông minh.",
                ImageUrl = "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80",
                Price = 790000m,
                WeightKg = 0.25m,
                Stock = 38,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-10)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111010",
                Sku = "DRP-2004",
                Name = "Combo Vitamin Tổng Hợp, Kẽm & Viên Sủi Tăng Đề Kháng",
                Category = "Y tế & Sức khỏe",
                Description = "Bộ đôi bổ sung năng lượng, Vitamin C + D3 + Kẽm giúp phục hồi thể lực nhanh chóng.",
                ImageUrl = "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=600&q=80",
                Price = 480000m,
                WeightKg = 0.45m,
                Stock = 65,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-9)
            },

            // 3. THIẾT BỊ & CÔNG NGHỆ
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111011",
                Sku = "DRP-3001",
                Name = "Tai Nghe Chống Ồn Sony WH-1000XM5 Chính Hãng",
                Category = "Thiết bị & Công nghệ",
                Description = "Tai nghe không dây chống ồn chủ động cao cấp, pin 30 giờ, đóng hộp chống sốc cho khoang Drone.",
                ImageUrl = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
                Price = 6490000m,
                WeightKg = 0.65m,
                Stock = 20,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-8)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111012",
                Sku = "DRP-3002",
                Name = "Ổ Cứng Di Động SSD Samsung T9 2TB USB 3.2 Gen 2x2",
                Category = "Thiết bị & Công nghệ",
                Description = "SSD tốc độ đọc/ghi 2000MB/s vỏ cao su chống sốc rơi từ độ cao 3m, giao nhanh cho doanh nghiệp.",
                ImageUrl = "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80",
                Price = 4250000m,
                WeightKg = 0.35m,
                Stock = 32,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-7)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111013",
                Sku = "DRP-3003",
                Name = "Sạc Dự Phòng Anker Prime 20.000mAh 200W Màn Hình LCD",
                Category = "Thiết bị & Công nghệ",
                Description = "Sạc nhanh đồng thời cho MacBook Pro và điện thoại, hiển thị công suất thực và thời lượng pin.",
                ImageUrl = "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=600&q=80",
                Price = 2490000m,
                WeightKg = 0.55m,
                Stock = 28,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-6)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111014",
                Sku = "DRP-3004",
                Name = "Chuột Không Dây Công Thái Học Logitech MX Master 3S",
                Category = "Thiết bị & Công nghệ",
                Description = "Cảm biến 8000 DPI trên mặt kính, nút bấm Quiet Click siêu êm và cuộn từ tính MagSpeed.",
                ImageUrl = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80",
                Price = 2350000m,
                WeightKg = 0.35m,
                Stock = 42,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-5)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111015",
                Sku = "DRP-3005",
                Name = "Đồng Hồ Thể Thao GPS Garmin Forerunner 265 AMOLED",
                Category = "Thiết bị & Công nghệ",
                Description = "Đồng hồ chạy bộ chuyên nghiệp định vị GPS đa băng tần, siêu nhẹ, chống nước 5 ATM.",
                ImageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
                Price = 5890000m,
                WeightKg = 0.40m,
                Stock = 18,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-4)
            },

            // 4. TÀI LIỆU & QUÀ TẶNG
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111016",
                Sku = "DRP-4001",
                Name = "Bộ Chăm Sóc Da La Roche-Posay B5 Phục Hồi Cấp Ẩm",
                Category = "Hàng tiêu dùng",
                Description = "Kem dưỡng Cicaplast Baume B5+ và Serum Hyalu B5 làm dịu, phục hồi da nhanh chóng.",
                ImageUrl = "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
                Price = 980000m,
                WeightKg = 0.40m,
                Stock = 36,
                IsFragile = true,
                IsActive = true,
                CreatedAt = now.AddDays(-3)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111017",
                Sku = "DRP-4002",
                Name = "Bút Ký Cao Cấp Parker IM Đen Vàng Kèm Hộp Quà Sang Trọng",
                Category = "Tài liệu & Văn phòng",
                Description = "Bút ký thân kim loại sơn mài đen bóng phối cài mạ vàng 23K, quà tặng đối tác doanh nghiệp.",
                ImageUrl = "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?auto=format&fit=crop&w=600&q=80",
                Price = 1250000m,
                WeightKg = 0.30m,
                Stock = 25,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-2)
            },
            new StoreProductItem
            {
                Id = "p1111111-1111-1111-1111-111111111018",
                Sku = "DRP-4003",
                Name = "Hộp Niêm Phong Bảo Mật Hồ Sơ & Hợp Đồng Hỏa Tốc",
                Category = "Tài liệu & Văn phòng",
                Description = "Hộp khóa mã số chống nước, chống cháy nhẹ chuyên vận chuyển chứng từ, hợp đồng quan trọng.",
                ImageUrl = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
                Price = 220000m,
                WeightKg = 0.50m,
                Stock = 70,
                IsFragile = false,
                IsActive = true,
                CreatedAt = now.AddDays(-1)
            }
        };

        foreach (var item in items)
        {
            dict[item.Id] = item;
        }

        return dict;
    }

    private static ConcurrentDictionary<string, CustomerFeedbackItem> SeedInitialFeedbacks()
    {
        var dict = new ConcurrentDictionary<string, CustomerFeedbackItem>();
        var now = DateTime.UtcNow;
        var items = new[]
        {
            new CustomerFeedbackItem
            {
                Id = "f1111111-1111-1111-1111-111111111001",
                OrderId = "a1111111-1111-1111-1111-111111111001",
                TrackingNumber = "SDD-20261108-482910",
                CustomerId = "11111111-1111-1111-1111-111111111005",
                CustomerName = "Nguyễn Văn An (Khách hàng A)",
                CustomerEmail = "customer@smartdrone.vn",
                Rating = 5,
                Comment = "Drone giao Bộ Kit Y Tế cực nhanh, chỉ 15 phút đã hạ cánh đúng điểm nhận tại Thủ Đức. Hộp hàng nguyên vẹn 100%!",
                AdminReply = "Cảm ơn anh An đã tin dùng dịch vụ giao hàng hỏa tốc bằng Drone của SmartDroneDelivery!",
                RepliedAt = now.AddHours(-2),
                CreatedAt = now.AddHours(-5)
            },
            new CustomerFeedbackItem
            {
                Id = "f1111111-1111-1111-1111-111111111002",
                OrderId = "a1111111-1111-1111-1111-111111111004",
                TrackingNumber = "SDD-20261109-823901",
                CustomerId = "11111111-1111-1111-1111-111111111006",
                CustomerName = "Trần Thị Bích (Khách hàng B)",
                CustomerEmail = "customer2@smartdrone.vn",
                Rating = 5,
                Comment = "Tính năng theo dõi Drone bay trên bản đồ và xác nhận mã OTP 6 số rất tiện lợi, an toàn.",
                AdminReply = null,
                RepliedAt = null,
                CreatedAt = now.AddHours(-1)
            }
        };

        foreach (var item in items)
        {
            dict[item.Id] = item;
        }

        return dict;
    }
}
