# SmartDroneDelivery — Hệ Thống Quản Lý Giao Hàng Bằng Drone (AI-Powered)

Dự án đồ án Hệ Quản Trị Cơ Sở Dữ Liệu: Xây dựng nền tảng điều phối, kiểm soát hành lang bay và vận chuyển bưu kiện bằng máy bay không người lái (Drone Delivery System) tích hợp mô hình dự báo thời gian giao hàng (AI ETA Prediction), giao thức viễn trắc SignalR chu kỳ 2s và cơ chế bảo mật giao nhận OTP SHA-256.

---

## Tài Liệu Cài Đặt & Hướng Dẫn Phát Triển (Dành Cho Thành Viên)

Vui lòng xem hướng dẫn chi tiết từng bước cài đặt IDEs, công cụ và thư viện bằng CMD/PowerShell tại:
👉 **[HƯỚNG DẪN CÀI ĐẶT MÔI TRƯỜNG & THƯ VIỆN (SETUP_GUIDE.md)](./SETUP_GUIDE.md)**

---

## Cấu Trúc Các Phân Hệ Chính

| Phân hệ | Thư mục | Công nghệ & Nền tảng | Cổng mặc định |
| :--- | :--- | :--- | :--- |
| **Backend API** | [`backend/`](./backend/) | .NET 9.0 (C#), ASP.NET Core Web API, Entity Framework Core 9, SignalR | `http://localhost:5028` |
| **Web Portal** | [`web/`](./web/) | React 19, Vite 8, Tailwind CSS v4, Inter font, JetBrains Mono | `http://localhost:5173` |
| **Customer Mobile App** | [`mobile/`](./mobile/) | Flutter SDK 3.50, Dart 3.14 (Android, Windows, Web) | Tùy chọn thiết bị |
| **Cơ Sở Dữ Liệu** | [`docs/database/`](./docs/database/) | Microsoft SQL Server 2022 / Docker Container | `localhost:1433` |
| **Kiến Trúc & Biểu Đồ** | [`docs/architecture/`](./docs/architecture/) | 5 Biểu đồ thiết kế hệ thống (Use Case, Sequence, ERD, Class, State) | Xem tài liệu Markdown |

---

## Khởi Động Nhanh (Quick Start)

### 1. Khởi động Backend API (.NET 9)
```powershell
dotnet restore backend/SmartDroneDelivery.sln
dotnet run --project backend/src/SmartDroneDelivery.Api --urls http://localhost:5028
```

### 2. Khởi động Web Portal (React 19 + Tailwind v4)
```powershell
cd web
npm install
npm run dev
# Mở trình duyệt tại: http://localhost:5173
```

### 3. Khởi động Mobile App (Flutter)
```powershell
cd mobile
flutter pub get
flutter run -d chrome
```

---

## Tài Khoản Đăng Nhập Mặc Định (Mật khẩu chung: `P@ssword123!`)
- **Quản trị viên (ADMIN)**: `admin@smartdrone.vn`
- **Điều phối viên (DISPATCHER)**: `dispatcher@smartdrone.vn`
- **Nhân viên trạm (STATION_OPERATOR)**: `operator@smartdrone.vn`
- **Quản lý vận hành (LOGISTICS_MANAGER)**: `manager@smartdrone.vn`
- **Khách hàng (CUSTOMER)**: `customer@smartdrone.vn`
