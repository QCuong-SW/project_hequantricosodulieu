# SmartDroneDelivery — Lộ trình Mục tiêu 5 Tuần (Milestones)

Tài liệu ghi nhận các mốc nghiệm thu tổng quát theo tuần để nhóm theo dõi tiến độ tổng thể.

---

## Các Cột mốc Chính (High-Level Milestones)

- **Tuần 1 (Khởi tạo Hạ tầng & CSDL)**:
  - Chốt kiến trúc và thiết kế ERD.
  - Khởi chạy Docker (SQL Server 2022, MinIO).
  - Từng thành viên tạo bảng module của mình trên SQL Server.

- **Tuần 2 (Core Logistics & Đơn hàng)**:
  - Hoàn thiện nghiệp vụ tài khoản, sổ địa chỉ và tạo đơn hàng.
  - Tích hợp lưu trữ ảnh kiện hàng trên MinIO.

- **Tuần 3 (Điều phối & Trạm tiếp đất)**:
  - Nghiệp vụ phê duyệt, gán drone và lập lịch bay.
  - Nghiệp vụ bàn giao kiện hàng tại trạm qua mã QR.

- **Tuần 4 (Realtime Tracking & AI)**:
  - Mô phỏng hành trình bay và cập nhật vị trí realtime qua SignalR.
  - Xác nhận nhận hàng bằng OTP.
  - Tích hợp AI (Dự đoán ETA, Chatbot) kèm cơ chế Fallback.

- **Tuần 5 (Tích hợp & Báo cáo Demo)**:
  - Kiểm thử tích hợp luồng nghiệp vụ end-to-end.
  - Đóng gói Docker hoàn chỉnh và chuẩn bị slide bảo vệ đồ án.
