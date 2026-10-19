# SmartDroneDelivery — Architecture Decision Records (ADRs)

Tài liệu này ghi lại các quyết định kiến trúc quan trọng, bối cảnh, lý do lựa chọn và hệ quả đánh đổi (trade-offs) để đảm bảo toàn đội ngũ 5 thành viên có sự đồng thuận tuyệt đối.

---

## ADR-001: Kiến trúc Modular Monolith thay vì Microservices
- **Bối cảnh**: Hệ thống phục vụ bài toán demo quản lý giao hàng bằng drone trong thời hạn 5 tuần với 5 thành viên.
- **Quyết định**: Chọn **Modular Monolith** phân tầng theo Clean Architecture trong một Solution duy nhất của ASP.NET Core Web API.
- **Lý do**:
  - Tránh chi phí quản lý hạ tầng mạng phân tán, service discovery, distributed tracing và bảo mật liên service.
  - Tránh bài toán phân tán dữ liệu phức tạp (Saga Pattern / Two-Phase Commit) khi gán lịch trình giữa Đơn hàng - Drone - Trạm.
  - Triển khai cực kỳ đơn giản: 1 Docker container duy nhất cho Backend API.
- **Hệ quả**: Các module phải tuân thủ nghiêm ngặt ranh giới (interface, dependency inversion) để tránh biến thành "Big Ball of Mud".

---

## ADR-002: Lựa chọn Hệ Quản Trị Cơ Sở Dữ Liệu (SQL Server vs PostgreSQL)
- **Bối cảnh**: 
  - Mục 3 của đề bài quy định: `Database: SQL SERVER`.
  - Mục 6 của đề bài ghi: `PostgreSQL là nguồn dữ liệu chính thức`.
  - Tên thư mục dự án là `project_hequantricosodulieu` (Môn học Hệ quản trị cơ sở dữ liệu).
- **Quyết định**:
  - **Phương án chuẩn bị**: Thiết kế ERD và Data Dictionary theo chuẩn **ANSI SQL**, tương thích 100% với cả **Microsoft SQL Server (2022)** và **PostgreSQL (16)**.
  - Sử dụng **Entity Framework Core (EF Core 9 / 8 LTS)** làm ORM chính. Cấu hình DbContext tách biệt để chỉ cần thay đổi Connection String và đổi Provider (`UseSqlServer()` hoặc `UseNpgsql()`) trong `Program.cs` mà không phải sửa logic nghiệp vụ hay Entity nào.
  - Cung cấp sẵn cả 2 file script DDL: `schema-sqlserver.sql` và `schema-postgres.sql`.
- **Khuyến nghị cho nhóm**:
  - Nếu môn học yêu cầu nộp bài thực hành trên SQL Server (T-SQL, Management Studio): Chọn **SQL Server 2022 Developer Edition** chạy qua Docker.
  - Nếu môn học cho phép tự chọn hệ quản trị CSDL mã nguồn mở: Chọn **PostgreSQL 16 Alpine** vì nhẹ, tiết kiệm RAM cho máy tính sinh viên.

---

## ADR-003: Quản lý Phiên & Phân quyền (JWT Access Token + Refresh Token + RBAC)
- **Bối cảnh**: Có 5 Actor với các quyền hạn nghiệp vụ khác nhau truy cập từ Web và Mobile.
- **Quyết định**:
  - Cơ chế Stateless JWT Authentication.
  - Access Token có thời hạn ngắn (15 - 30 phút), chứa `sub` (UserId), `email`, `roles` và `permissions`.
  - Refresh Token được lưu trong bảng `RefreshTokens` trong cơ sở dữ liệu, có thời hạn dài (7 ngày), hỗ trợ cơ chế Token Rotation và Revocation (thu hồi quyền khi logout hoặc phát hiện gian lận).
  - RBAC được kiểm tra ở cấp Controller và Service thông qua `[Authorize(Roles = "...")]` và Custom Authorization Policies. Không bao giờ tin cậy Role do Client tự gửi lên trong body/param.

---

## ADR-004: Lưu trữ Tập tin Đa phương tiện qua MinIO (S3-Compatible)
- **Bối cảnh**: Hệ thống cần lưu trữ ảnh chụp kiện hàng lúc gửi và ảnh xác nhận giao hàng (Proof of Delivery), chữ ký điện tử.
- **Quyết định**: Sử dụng **MinIO** chạy trong Docker container, tương thích giao thức AWS S3.
- **Lý do**:
  - Không lưu tệp nhị phân trực tiếp trong CSDL (tránh làm phình database và giảm hiệu năng truy vấn I/O).
  - Không lưu tệp cục bộ trên ổ cứng máy chủ (local disk) vì không thể mở rộng và vi phạm nguyên tắc containerization (mất file khi rebuild container).
  - Trả về Pre-signed URL hoặc Public Asset URL cho Web và Mobile hiển thị.

---

## ADR-005: Xử lý Thời gian thực & Mô phỏng Drone (SignalR Hub)
- **Bối cảnh**: Khách hàng và Điều phối viên cần nhìn thấy vị trí Drone di chuyển trên bản đồ và trạng thái đơn đổi từ `SCHEDULED` sang `DELIVERING` rồi `DELIVERED`. Vì không có Drone thật, hệ thống phải mô phỏng.
- **Quyết định**:
  - Sử dụng **ASP.NET Core SignalR** với WebSocket làm kênh truyền dẫn chính (tự động fallback sang Server-Sent Events / Long Polling).
  - Tạo `BackgroundService` (`DroneFlightSimulatorWorker`) trong Backend: Mỗi khi đơn hàng chuyển sang `DELIVERING`, worker nội suy tọa độ giữa Trạm cất cánh và Trạm đích theo vận tốc định trước (ví dụ: 40 km/h) và phát sự kiện `ReceiveDronePosition(orderId, lat, lng, battery, remainingMinutes)` mỗi 2 giây vào Hub `/hubs/tracking`.
  - Nhóm client chỉ cần subscribe vào group theo `orderId`.

---

## ADR-006: Tích hợp AI Service & Fallback Deterministic Engine
- **Bối cảnh**: Dự án có tính năng AI: Dự đoán ETA, tóm tắt sự cố ca trực, Chatbot trợ lý. Tuy nhiên, thời gian demo có thể gặp rủi ro: API Key hết hạn, lỗi mạng, rate-limit từ nhà cung cấp (OpenAI / Gemini).
- **Quyết định**:
  - Triển khai **Strategy Pattern** với interface `IAIService`:
    - `ExternalLlmApiService`: Gọi LLM API qua HTTP Client với Timeout tối đa 3.5 giây.
    - `FallbackRuleBasedService`: Tính toán ETA dựa trên công thức Haversine (khoảng cách đường bay chim bay / vận tốc drone chuẩn 40 km/h + thời gian cất cánh/hạ cánh 3 phút).
  - Mọi hàm gọi AI bắt buộc được bọc trong khối `try/catch` hoặc `Polly Resilience Pipeline`. Nếu gọi AI thất bại, tự động chuyển sang Fallback và gắn cờ `IsFallback = true` trong response mà không làm gián đoạn luồng nghiệp vụ chính.

---

## ADR-007: Quản lý Toàn vẹn Dữ liệu, Transaction & Concurrency
- **Bối cảnh**: Nhiều điều phối viên có thể cùng chọn một drone hoặc một bãi đáp trạm trong cùng thời điểm.
- **Quyết định**:
  - Sử dụng Database Transaction (`IDbContextTransaction`) khi thực hiện gán lịch trình (`FlightSchedule`):
    - Đổi trạng thái Đơn hàng sang `SCHEDULED`.
    - Đổi trạng thái Drone sang `ASSIGNED`.
    - Đổi trạng thái Slot bãi đáp sang `RESERVED`.
  - Áp dụng **Optimistic Concurrency Control** thông qua cột `RowVersion` (SQL Server) hoặc `xmin` (PostgreSQL) để ngăn chặn Lost Updates khi hai người cùng sửa đổi đơn hàng.
  - Sử dụng bảng bất biến **Append-Only** (`TrackingEvents`) cho mọi sự kiện thay đổi trạng thái, cấm chỉnh sửa (`UPDATE`) hoặc xóa (`DELETE`).

---

## ADR-008: Chiến lược Xóa dữ liệu (Soft Delete vs Hard Delete)
- **Quyết định**:
  - Áp dụng **Soft Delete** (`IsDeleted`, `DeletedAt`) đối với các thực thể danh mục cấu hình: `CustomerProfile`, `DeliveryAddress`, `LandingStation`, `Drone`.
  - **Tuyệt đối cấm Soft Delete / Hard Delete** đối với `DeliveryOrder`, `FlightSchedule`, `PackageHandoff`, `TrackingEvent`, `AuditLog`. Nếu khách hủy đơn, đơn chuyển trạng thái sang `CANCELLED`. Nếu trạm đóng cửa, chuyển `Status = INACTIVE`. Điều này bảo đảm tính toàn vẹn lịch sử kiểm toán của môn Hệ quản trị CSDL.
