# SmartDroneDelivery — Role-Based Access Control (RBAC) Matrix & Security

Tài liệu này xác định chi tiết ma trận phân quyền giữa 5 Actor và các phân hệ chức năng, kèm theo các quy tắc kiểm soát dữ liệu (Data Isolation) nhằm bảo đảm không bao giờ tin cậy dữ liệu do client gửi lên.

---

## 1. Ma trận Quyền hạn (Role-Permission Matrix)

**Ký hiệu**:
- `C` (Create): Tạo mới
- `R` (Read): Xem / Tra cứu
- `U` (Update): Cập nhật / Sửa
- `D` (Delete / Soft Delete): Xóa hoặc hủy kích hoạt
- `*` (Chỉ trên dữ liệu của chính mình / Scope sở hữu)
- `-` (Không có quyền truy cập)

| Phân hệ chức năng | Customer | Dispatcher | Station Operator | Logistics Manager | System Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Quản lý Tài khoản & Phân quyền** |
| Đăng ký / Đăng nhập | C, R* | R* | R* | R* | C, R, U, D |
| Quản lý Users & Gán Roles | - | - | - | - | C, R, U, D |
| Xem Audit Logs hệ thống | - | - | - | R | R |
| **Hồ sơ & Sổ Địa chỉ** |
| Hồ sơ cá nhân (Profile) | C, R*, U* | R* | R* | R* | R, U |
| Sổ địa chỉ nhận/gửi | C, R*, U*, D*| - | - | - | - |
| **Đơn hàng & Kiện hàng** |
| Tạo đơn hàng nháp / Gửi duyệt | C* | - | - | - | - |
| Xem đơn hàng | R* | R (Tất cả) | R (Tại trạm) | R (Tất cả) | R (Tất cả) |
| Duyệt / Từ chối đơn hàng | - | U (Phê duyệt) | - | U | - |
| Hủy đơn hàng | U* (Nếu DRAFT/PENDING) | U (Hủy điều phối)| - | U | - |
| Xem ảnh kiện hàng | R* | R | R | R | R |
| **Trạm tiếp đất & Bãi đáp** |
| Tra cứu danh sách trạm & tọa độ| R | R | R | R | R |
| Quản lý trạm (Thêm/Sửa trạm) | - | - | - | C, R, U, D | C, R, U, D |
| Cập nhật trạng thái Slot trạm | - | - | U (Bãi đỗ) | U | U |
| **Đội bay Drone** |
| Xem danh sách Drone & Pin | - | R | R (Tại bãi) | R | R |
| Thêm mới / Cập nhật Drone | - | - | - | C, R, U, D | C, R, U, D |
| Đưa Drone vào bảo trì | - | U | U | U | U |
| **Lập lịch chuyến bay (Scheduling)**|
| Lên lịch bay & Gán Drone | - | C, R, U | - | R | R |
| Chuyển hướng bay / Hủy bay khẩn | - | U | - | U | - |
| Xem radar lộ trình chuyến bay | R* (Đơn của mình) | R (Toàn bộ) | R (Đến/Đi trạm) | R (Toàn bộ) | R (Toàn bộ) |
| **Giao nhận kiện hàng (Handoff)** |
| Quét QR Inbound / Outbound | - | - | C, R, U | - | - |
| Chụp ảnh kiện hàng tại trạm | - | - | C, U | - | - |
| **Theo dõi & Xác nhận giao hàng**|
| Nhận mã OTP nhận hàng | R* | - | - | - | - |
| Nhập OTP / Quét QR nhận hàng | U* | - | U (Nếu tại trạm) | - | - |
| Tải ảnh bằng chứng Proof of Delivery| - | - | C, U | - | - |
| **Báo cáo, Phân tích & AI** |
| Chatbot AI hỗ trợ giải đáp | C, R* | - | - | - | - |
| Dự đoán ETA bằng AI | R* | R | - | R | - |
| Xem Dashboard KPIs vận hành | - | R (Ca trực) | R (Năng suất trạm)| R (Toàn diện) | R (Hạ tầng) |
| Sinh báo cáo tổng hợp bằng AI | - | - | - | C, R | - |

---

## 2. Quy tắc Cách ly Dữ liệu (Data Isolation Rules)

1. **Khách hàng (Customer Isolation)**:
   - Trong mọi truy vấn đơn hàng, API bắt buộc tự động chèn bộ lọc: `WHERE customer_id = @CurrentCustomerId`.
   - Khách hàng tuyệt đối không được xem số điện thoại, địa chỉ hoặc kiện hàng của khách hàng khác, kể cả khi đoán được `orderId`.
2. **Nhân viên Trạm (Station Scope Isolation)**:
   - Station Operator chỉ được quét nhận các kiện hàng có điểm xuất phát hoặc điểm đích trùng với `assigned_station_id` của tài khoản đó.
3. **Optimistic Locking phòng chống Race Condition**:
   - Khi Dispatcher chọn một Drone để gán cho đơn hàng, hệ thống kiểm tra trạng thái drone `status = 'IDLE'`. Nếu 2 Dispatcher bấm đồng thời, chỉ 1 người thành công, người còn lại nhận mã lỗi `409 Conflict: Drone đã được gán cho chuyến bay khác`.

---

## 3. Chính sách Bảo mật Hệ thống

- **Lưu trữ Mật khẩu**: Băm bằng thư viện `BCrypt.Net-Next` với work factor = 11. Tuyệt đối không lưu plaintext hoặc MD5/SHA-1.
- **Bảo vệ JWT Token**:
  - Web: Lưu Access Token trong bộ nhớ (Memory/Zustand state) hoặc HttpOnly Cookie chống XSS.
  - Mobile: Lưu trong `flutter_secure_storage` (Keychain trên iOS và KeyStore trên Android).
- **CORS Policy**: Chỉ cho phép domain của Web ReactJS (ví dụ: `http://localhost:5173` khi dev).
- **Rate Limiting**: Giới hạn 100 requests/phút đối với public endpoints và 5 requests/phút đối với endpoint đăng nhập / gửi mã OTP để chống brute-force.
