# SmartDroneDelivery — Data Dictionary (Khung Thực thể & Mục đích Lưu trữ)

Hệ Quản Trị Cơ Sở Dữ Liệu: **Microsoft SQL Server 2022**

Tài liệu này tóm lược danh mục 18 thực thể cốt lõi trong hệ thống và mục đích nghiệp vụ để định hướng cho các thành viên tự thiết kế chi tiết bảng của mình.

---

## 1. Phân hệ Tài khoản & Bảo mật (Thành viên 1)
- `users`: Lưu tài khoản đăng nhập cho toàn bộ 5 Actor trong hệ thống.
- `roles`: Danh mục các vai trò (`ADMIN`, `DISPATCHER`, `STATION_OPERATOR`, `LOGISTICS_MANAGER`, `CUSTOMER`).
- `user_roles`: Bảng nối quan hệ N-N giữa Người dùng và Vai trò.
- `refresh_tokens`: Lưu trữ refresh token phục vụ cơ chế JWT rotation.
- `audit_logs`: Nhật ký kiểm toán ghi lại các thao tác nhạy cảm trên hệ thống.

---

## 2. Phân hệ Khách hàng & Đơn hàng (Thành viên 2)
- `customer_profiles`: Hồ sơ mở rộng của tài khoản khách hàng.
- `delivery_addresses`: Sổ địa chỉ nhận và gửi hàng của khách hàng.
- `delivery_orders`: Thực thể đơn hàng trung tâm (trạng thái, cước phí, hình thức giao).
- `order_address_snapshots`: Bản sao bất biến thông tin địa chỉ tại thời điểm đặt đơn.
- `packages`: Thông số vật lý của kiện hàng (trọng lượng, kích thước, ảnh MinIO, hàng dễ vỡ/nguy hiểm).

---

## 3. Phân hệ Đội Drone & Lập lịch Bay (Thành viên 3)
- `drones`: Danh mục tài sản drone mô phỏng (tải trọng tối đa, tầm bay, mức pin, trạng thái).
- `flight_schedules`: Kế hoạch và lịch sử chuyến bay điều phối cho từng đơn hàng.
- `flight_waypoints`: Danh sách các mốc tọa độ trên hành trình bay mô phỏng.

---

## 4. Phân hệ Trạm Tiếp đất & Bàn giao (Thành viên 4)
- `landing_stations`: Danh mục các trạm tiếp đất (tọa độ, số bãi đỗ, trạng thái).
- `station_slots`: Chi tiết từng bãi đáp và dock sạc tại trạm.
- `package_handoffs`: Biên bản bàn giao kiện hàng vật lý tại trạm (quét mã QR Inbound/Outbound).

---

## 5. Phân hệ Theo dõi & Xác nhận (Thành viên 5)
- `tracking_events`: Dòng sự kiện hành trình (Bảng bất biến Append-Only).
- `delivery_confirmations`: Bằng chứng giao hàng thành công (Mã OTP, chữ ký số, ảnh Proof of Delivery).
