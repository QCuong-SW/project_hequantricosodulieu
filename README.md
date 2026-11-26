# SmartDroneDelivery - AI-powered Drone Delivery Management Platform

**Tên tiếng Việt:** Nền tảng quản lý giao hàng bằng drone tích hợp AI

---

## 1. Tổng Quan Dự Án

**SmartDroneDelivery** là nền tảng quản lý quy trình giao nhận hàng hóa bằng máy bay không người lái (Drone) từ lúc khách hàng đặt đơn đến khi xác nhận giao hàng thành công. Hệ thống tập trung vào nghiệp vụ điều phối, quản lý đơn hàng, theo dõi lộ trình GPS thời gian thực đồng bộ giữa điện thoại và máy tính, quản lý trạm tiếp đất và tích hợp các dịch vụ AI hỗ trợ ra quyết định (dự báo thời gian đến nơi, tóm tắt giao hàng, trợ lý hỏi đáp).

### Các thành phần trong hệ thống

| Phân hệ | Thư mục | Công nghệ chính | Cổng mặc định |
| :--- | :--- | :--- | :--- |
| Backend API | `backend/` | ASP.NET Core .NET 9, EF Core 9, SignalR, JWT | `http://localhost:5028` |
| Web Portal (Quản trị & Điều phối) | `web/` | React 19, Vite, Tailwind CSS v4 | `http://localhost:5173` |
| Mobile App (Khách hàng) | `mobile/` | Flutter SDK, Dart | `http://localhost:5174` |
| Hạ tầng dữ liệu | `infrastructure/docker/` | SQL Server 2022, MinIO (Object Storage) | `14333`, `9000`, `9001` |
| Kịch bản CSDL & Tài liệu | `database/`, `docs/` | T-SQL Scripts, SQL Views, ERD, System Diagrams | - |

---

## 2. Các Tính Năng Chính

### Ứng dụng Mobile (Dành cho Khách hàng)
- Đăng nhập và đăng ký tài khoản khách hàng mới (JWT Authentication, cô lập dữ liệu giữa các tài khoản).
- Tìm kiếm, lọc theo danh mục (đồ ăn, y tế, công nghệ, văn phòng, hàng tiêu dùng) và sắp xếp sản phẩm.
- Giỏ hàng tự động kiểm soát giới hạn tải trọng Drone (`<= 5.0 kg`), chọn điểm hạ cánh nội đô TP.HCM và phương thức thanh toán.
- Theo dõi trạng thái đơn hàng theo từng chặng và xem vị trí Drone di chuyển mượt thời gian thực trên bản đồ Google Maps thật (đồng bộ 1:1 với Web).
- Chỉ mở khóa xác nhận nhận hàng (OTP 6 số mã hóa SHA-256) khi Drone đã giao đến nơi (`100%`), kèm gửi đánh giá/phản hồi về cho Quản trị viên.
- Trợ lý AI Khách hàng hỗ trợ tra cứu đơn đang bay, gợi ý món ăn và quy định vận chuyển.

### Ứng dụng Web (Dành cho Quản trị & Vận hành)
- **Tổng quan hệ thống (Dashboard):** Thống kê KPI, biểu đồ chuyến bay theo ngày, mức sử dụng slot tại các trạm từ SQL Views và xuất báo cáo CSV.
- **Quản lý sản phẩm:** Thêm, sửa, xóa, bật/tắt trạng thái bán sản phẩm đồng bộ trực tiếp sang Mobile App.
- **Quản lý đơn hàng & Drone:** Duyệt/từ chối đơn, gán Drone và xếp lịch bay, hủy chuyến khẩn cấp, tự động cập nhật hoàn thành đơn và giải phóng Drone về trạng thái `IDLE` ngay khi khách bấm nhận hàng trên Mobile (kèm thông báo cộng dồn theo số lượng đơn hoàn tất).
- **Theo dõi giao hàng Drone:** Chỉ hiển thị và ưu tiên các chuyến bay đang diễn ra hoặc khách vừa đặt mới trên bản đồ Google Maps thật; tự động gỡ các đơn đã giao khỏi bản đồ trực tuyến.
- **Trung tâm Trợ lý AI:** Trợ lý hỏi đáp AI (Gemini LLM + Fallback nội bộ), tóm tắt báo cáo giao hàng tự động, dự báo thời gian dự kiến đến nơi theo khoảng cách Haversine và tốc độ gió ngược.
- **Quản lý tài khoản & Feedback:** Quản lý người dùng theo phân quyền RBAC, giám sát trạng thái CSDL, nhật ký kiểm toán (Audit Logs) và phản hồi đánh giá từ khách hàng.

---

## 3. Kiến Trúc Code Backend

Backend được tổ chức theo mô hình **Clean Architecture** gồm 4 lớp tách biệt, đảm bảo dễ bảo trì, dễ mở rộng và tách bạch logic nghiệp vụ với hạ tầng:

```text
backend/src/
|-- SmartDroneDelivery.Domain/          # Entities, Value Objects, trang thai nghiep vu cot loi
|-- SmartDroneDelivery.Application/     # DTOs, Interfaces, Business Services (Orders, Scheduling, AI, Identity)
|-- SmartDroneDelivery.Infrastructure/  # EF Core DbContext, AuditInterceptor, JWT/BCrypt, SignalR, LLM Client
`-- SmartDroneDelivery.Api/             # RESTful Controllers, Program.cs, Middleware, Dependency Injection
```

### Luồng xử lý chính trong Backend
- **Controllers (`SmartDroneDelivery.Api/Controllers/`):**
  - `AuthController`: Đăng nhập, đăng ký, làm mới Refresh Token, quản trị user & Audit Logs.
  - `OrdersController`: Tạo đơn, thanh toán, hủy đơn, cập nhật trạng thái, đồng bộ tọa độ Telemetry thời gian thực (`/api/v1/delivery-orders/telemetry/{key}`).
  - `FlightSchedulesController`: Quản lý đội bay Drone, duyệt đơn, gán lịch bay, tự động điều phối và giải phóng Drone.
  - `DeliveryConfirmationController`: Phát hành và xác thực OTP 6 số (SHA-256), hoàn tất đơn, giải phóng Drone và phát sự kiện hoàn thành về Web.
  - `StationsController` & `HandoffController`: Quản lý trạm tiếp đất, kiểm tra slot trống và bàn giao kiện hàng có chống trùng lặp (Idempotency).
  - `StoreController`: Danh mục sản phẩm cửa hàng và phản hồi khách hàng.
  - `AnalyticsController`: Truy vấn thống kê vận hành từ SQL Views và kiểm tra sức khỏe CSDL.
  - `EtaController` & `AiAssistantController`: Dự báo thời gian đến nơi, trợ lý hỏi đáp AI và tóm tắt giao hàng (ưu tiên gọi LLM qua API tương thích OpenAI, tự động chuyển sang Rule-Based Fallback nếu lỗi mạng hoặc chưa có API Key).
- **Thời gian thực & Bảo mật:**
  - `TrackingHub` (`/hubs/tracking`) và `DroneSimulatorWorker` phát tọa độ GPS định kỳ.
  - `AuditSaveChangesInterceptor` tự động ghi nhật ký thao tác dữ liệu.
  - Xác thực JWT Bearer kết hợp phân quyền theo 5 vai trò RBAC (`ADMIN`, `LOGISTICS_MANAGER`, `DISPATCHER`, `STATION_OPERATOR`, `CUSTOMER`).

---

## 4. Kiến Trúc Cơ Sở Dữ Liệu

Cơ sở dữ liệu sử dụng **Microsoft SQL Server 2022** (triển khai qua Docker) kết hợp **MinIO** cho lưu trữ tệp tin/hình ảnh (`smartdrone-packages`, `smartdrone-proofs`). Lược đồ CSDL trong thư mục `database/` được chia thành 5 phân hệ nghiệp vụ gồm **18 bảng** và **2 SQL Views**:

| Phân hệ | Thư mục script | Các bảng / Views chính | Vai trò |
| :--- | :--- | :--- | :--- |
| 1. Identity & Security | `database/modules/01_identity_security/` | `roles`, `users`, `user_roles`, `refresh_tokens`, `audit_logs` | Tài khoản, phân quyền RBAC, phiên JWT và nhật ký kiểm toán |
| 2. Customers & Orders | `database/modules/02_customers_orders/` | `customer_profiles`, `delivery_addresses`, `delivery_orders`, `order_address_snapshots`, `packages` | Hồ sơ khách, sổ địa chỉ GPS, đơn hàng, bản chụp địa chỉ bất biến và kiện hàng |
| 3. Drones & Scheduling | `database/modules/03_drones_scheduling/` | `drones`, `flight_schedules`, `flight_waypoints` | Đội bay Drone, tải trọng/pin, lịch trình bay và các điểm trung gian |
| 4. Landing Stations | `database/modules/04_stations_handoffs/` | `landing_stations`, `station_slots`, `package_handoffs` | Trạm hạ cánh, bãi đáp/slot và lịch sử bàn giao kiện hàng (Idempotency) |
| 5. Tracking & Analytics | `database/modules/05_tracking_confirmations/` | `tracking_events`, `delivery_confirmations`, `v_flight_delivery_performance`, `v_station_slot_utilization` | Chuỗi sự kiện GPS, xác thực OTP SHA-256 và 2 Views phân tích hiệu suất |

### Đặc điểm thiết kế CSDL
- **Toàn vẹn dữ liệu:** Ràng buộc khóa ngoại (Foreign Keys), ràng buộc kiểm tra (Check Constraints cho trọng lượng, trạng thái, tọa độ) và bộ script kiểm thử SQL tại `database/tests/`.
- **Bất biến dữ liệu giao hàng:** Sử dụng `order_address_snapshots` lưu cố định tọa độ người gửi/người nhận tại thời điểm đặt đơn để không bị sai lệch nếu khách hàng sửa sổ địa chỉ sau đó.
- **Hỗ trợ vận hành thực tế:** Cơ chế `ConcurrencyVersion` chống ghi đè đồng thời, `AuditLogs` lưu vết hành động, và tự động fallback dữ liệu mẫu khi SQL Server chưa bật trong môi trường phát triển.

---

## 5. Hướng Dẫn Chạy Dự Án

### Yêu cầu môi trường
- Docker Desktop (để chạy SQL Server 2022 và MinIO)
- .NET 9.0 SDK
- Node.js >= 18 (npm)
- Flutter SDK >= 3.24 (hỗ trợ Chrome / Android)

### Bước 1: Khởi chạy Cơ sở dữ liệu và MinIO bằng Docker
```powershell
docker compose -f infrastructure/docker/docker-compose.yml up -d
```
- SQL Server chạy tại: `localhost,14333` (User: `sa`, Password: `YourStrong@Password2026!`)
- MinIO S3 API: `http://localhost:9000` | MinIO Console: `http://localhost:9001` (`minioadmin` / `minioadminsecret`)
- Nếu chạy lần đầu, thực thi các script trong `database/` theo thứ tự `00_init_database.sql` -> `modules/01..05` -> `seed/seed_data_template.sql`.

### Bước 2: Cấu hình API Key AI (tùy chọn)
Sao chép file `.env.example` thành `.env` ở thư mục gốc dự án và điền API Key (hỗ trợ Google Gemini, OpenAI hoặc Groq):
```env
Ai__Llm__BaseUrl=https://generativelanguage.googleapis.com/v1beta/openai
Ai__Llm__Model=gemini-flash-lite-latest
Ai__Llm__ApiKey=YOUR_API_KEY_HERE
Ai__Llm__TimeoutSeconds=15
```
*Lưu ý: File `.env` đã nằm trong `.gitignore`. Nếu bỏ trống `Ai__Llm__ApiKey`, hệ thống vẫn chạy bình thường bằng chế độ dự phòng nội bộ.*

### Bước 3: Khởi chạy Backend API (.NET 9)
```powershell
dotnet restore backend/SmartDroneDelivery.sln
dotnet run --project backend/src/SmartDroneDelivery.Api --urls http://localhost:5028
```

### Bước 4: Khởi chạy Web Portal (React + Vite)
```powershell
cd web
npm install
npm run dev -- --port 5173 --host localhost
```
Truy cập Web tại: `http://localhost:5173`

### Bước 5: Khởi chạy Mobile App (Flutter)
```powershell
cd mobile
flutter pub get
flutter run -d chrome --web-port 5174 --web-hostname localhost
```
Truy cập Mobile UI tại: `http://localhost:5174` (hoặc chọn thiết bị Android emulator qua `flutter run`).

Xem hướng dẫn cài đặt chi tiết hơn tại [SETUP_GUIDE.md](./SETUP_GUIDE.md).

---

## 6. Tài Khoản Demo

Mật khẩu mặc định chung cho tất cả tài khoản demo: `P@ssword123!` (hệ thống cũng chấp nhận `Demo@123`).

### Web Portal (`http://localhost:5173`)
| Vai trò | Email đăng nhập | Quyền hạn chính |
| :--- | :--- | :--- |
| Quản trị viên (ADMIN) | `admin@smartdrone.vn` | Toàn quyền: Dashboard, Sản phẩm, Đơn hàng & Drone, Bản đồ, Trợ lý AI, Tài khoản, Feedback |
| Quản lý vận hành (LOGISTICS_MANAGER) | `manager@smartdrone.vn` | Xem Dashboard thống kê, Đơn hàng & Drone, Bản đồ, Trợ lý AI |
| Điều phối viên (DISPATCHER) | `dispatcher@smartdrone.vn` | Duyệt đơn, gán Drone, theo dõi bản đồ và Trợ lý AI |
| Nhân viên trạm (STATION_OPERATOR) | `operator@smartdrone.vn` | Theo dõi giao hàng và bàn giao kiện hàng tại trạm |

### Mobile App (`http://localhost:5174`)
| Vai trò | Email đăng nhập | Ghi chú |
| :--- | :--- | :--- |
| Khách hàng A (CUSTOMER) | `customer@smartdrone.vn` | Nguyễn Văn An - Đặt hàng, xem bản đồ Drone, nhận OTP và gửi đánh giá |
| Khách hàng B (CUSTOMER) | `customer2@smartdrone.vn` | Trần Thị Bích - Dùng để kiểm tra tính năng cô lập dữ liệu đơn hàng giữa các khách hàng |

*Khách hàng cũng có thể tự tạo tài khoản mới trực tiếp trên màn hình Đăng ký của Mobile App hoặc Web Portal.*
