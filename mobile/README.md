# SmartDroneDelivery — Mobile App (Flutter)

**Phụ trách**: Thành viên 5 (Mobile & Customer Experience)

---

## 1. Mục tiêu
Ứng dụng di động dành cho **Customer**:
- Đăng nhập / Đăng ký.
- Tạo đơn hàng mới & Sổ địa chỉ nhận/gửi.
- Theo dõi đơn hàng thời gian thực (vị trí Drone, timeline sự kiện).
- Nhận mã OTP và xác nhận nhận hàng.
- Chat hỗ trợ khách hàng với AI Assistant.

## 2. Cấu trúc thư mục
- `lib/core/`: Network client, Token storage, Base models.
- `lib/features/auth/`: Đăng nhập, lưu session token.
- `lib/features/orders/`: Tạo đơn, xem danh sách đơn hàng.
- `lib/features/tracking/`: Bản đồ vị trí Drone, nhận sự kiện qua SignalR, xác nhận OTP.
