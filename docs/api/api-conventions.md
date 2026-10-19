# SmartDroneDelivery — API Conventions & Protocols

Tài liệu này quy chuẩn toàn bộ định dạng giao tiếp REST API, SignalR Realtime Events và tích hợp Object Storage cho đội ngũ phát triển Backend, Web (ReactJS) và Mobile (Flutter).

---

## 1. Nguyên tắc thiết kế RESTful

- **Tiền tố phiên bản**: Mọi endpoint đều có tiền tố `/api/v1/`.
- **Quy ước đặt tên tài nguyên**: Dùng danh từ số nhiều, chữ thường dạng kebab-case (VD: `/api/v1/delivery-orders`, `/api/v1/landing-stations`).
- **HTTP Methods chuẩn**:
  - `GET`: Lấy thông tin tài nguyên (Idempotent).
  - `POST`: Tạo tài nguyên mới hoặc thực thi hành động nghiệp vụ (VD: `/api/v1/delivery-orders/{id}/approve`).
  - `PUT`: Cập nhật toàn bộ tài nguyên (Idempotent).
  - `PATCH`: Cập nhật từng phần (VD: đổi trạng thái, cập nhật ghi chú).
  - `DELETE`: Xóa mềm hoặc hủy kích hoạt tài nguyên.
- **Mã phản hồi HTTP tiêu chuẩn**:
  - `200 OK`: Thành công và có trả về dữ liệu.
  - `201 Created`: Tạo mới thành công (kèm header `Location`).
  - `204 No Content`: Thành công nhưng không cần trả body (VD: Delete).
  - `400 Bad Request`: Lỗi dữ liệu đầu vào (Validation Failure).
  - `401 Unauthorized`: Chưa đăng nhập hoặc JWT token hết hạn/không hợp lệ.
  - `403 Forbidden`: Đã đăng nhập nhưng không đủ quyền hạn (RBAC).
  - `404 Not Found`: Không tìm thấy tài nguyên.
  - `409 Conflict`: Xung đột trạng thái / Optimistic Concurrency Conflict.
  - `500 Internal Server Error`: Lỗi hệ thống chưa được kiểm soát.

---

## 2. Chuẩn hóa Khung dữ liệu phản hồi (Response Wrapper)

Tất cả các API response (thành công hoặc lỗi) đều tuân thủ cấu trúc thống nhất:

### Thành công (Single Object):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đơn hàng đã được phê duyệt thành công.",
  "data": {
    "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "trackingNumber": "SDD-20261019-9X82",
    "status": "APPROVED",
    "updatedAt": "2026-10-19T13:54:00Z"
  },
  "errors": null,
  "timestamp": "2026-10-19T13:54:01Z"
}
```

### Thất bại (Validation Error - HTTP 400):
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Dữ liệu yêu cầu không hợp lệ.",
  "data": null,
  "errors": [
    {
      "field": "packageWeightKg",
      "message": "Trọng lượng kiện hàng (6.5kg) vượt quá tải trọng tối đa cho phép của Drone (5.0kg)."
    },
    {
      "field": "recipientPhone",
      "message": "Số điện thoại người nhận không đúng định dạng Việt Nam."
    }
  ],
  "timestamp": "2026-10-19T13:54:01Z"
}
```

---

## 3. Quy ước Phân trang (Pagination) & Tìm kiếm / Lọc

Các API danh sách luôn bắt buộc phân trang để bảo vệ hiệu năng database:
- **Tham số truy vấn (Query Params)**:
  - `pageNumber`: Số thứ tự trang (mặc định: `1`, min: `1`).
  - `pageSize`: Số bản ghi mỗi trang (mặc định: `10`, max: `100`).
  - `sortBy`: Tên trường sắp xếp (mặc định: `createdAt`).
  - `sortOrder`: Thứ tự sắp xếp (`asc` hoặc `desc`, mặc định: `desc`).
  - `status`: Lọc theo trạng thái.
  - `search`: Từ khóa tìm kiếm (mã vận đơn, tên khách, số điện thoại).

### Cấu trúc dữ liệu phân trang:
```json
{
  "success": true,
  "statusCode": 200,
  "message": null,
  "data": {
    "items": [ ... ],
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 42,
    "totalPages": 5,
    "hasPreviousPage": false,
    "hasNextPage": true
  },
  "errors": null,
  "timestamp": "2026-10-19T13:54:01Z"
}
```

---

## 4. Giao thức Realtime (SignalR Hubs)

### Endpoint Hub: `/hubs/tracking`
Kết nối WebSocket phục vụ theo dõi trực tiếp lộ trình bay và biến động trạng thái đơn hàng.

#### Client gửi lên Server:
1. `JoinOrderGroup(string orderId)`: Đăng ký theo dõi tiến trình đơn hàng cụ thể.
2. `LeaveOrderGroup(string orderId)`: Hủy theo dõi.
3. `JoinStationGroup(string stationId)`: Station Operator đăng ký nhận thông báo chuyến bay sắp đến trạm.

#### Server phát xuống Client:
1. `ReceiveDroneTelemetry`:
```json
{
  "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "droneCode": "DRONE-AG-001",
  "currentLatitude": 21.028511,
  "currentLongitude": 105.854444,
  "currentAltitude": 65.2,
  "currentSpeedKmh": 42.5,
  "batteryPercentage": 82,
  "estimatedRemainingMinutes": 4.5,
  "timestamp": "2026-10-19T13:55:00Z"
}
```
2. `ReceiveOrderStatusChanged`:
```json
{
  "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "oldStatus": "LOADED_ON_DRONE",
  "newStatus": "DELIVERING",
  "eventTitle": "Drone đã cất cánh",
  "timestamp": "2026-10-19T13:55:00Z"
}
```

---

## 5. Quy trình tải tệp lên MinIO (File Storage Flow)

Để tránh tải nặng cho Backend API khi truyền tải ảnh chất lượng cao:
1. Client gửi yêu cầu: `POST /api/v1/files/presigned-upload-url` kèm `fileName`, `contentType`, `fileCategory` (`PACKAGE_PHOTO` hoặc `PROOF_OF_DELIVERY`).
2. Backend kiểm tra quyền và sinh URL bảo mật MinIO Pre-signed URL (có hạn dùng 5 phút).
3. Client tải trực tiếp tệp từ Web/Mobile lên MinIO thông qua URL này bằng phương thức `PUT`.
4. Sau khi tải xong, Client gửi `fileKey` hoặc `publicUrl` lên Backend để liên kết vào kiện hàng hoặc biên bản bàn giao.
*(Có hỗ trợ phương án Direct Upload qua Backend Multipart Form-data nếu phía Client gặp vấn đề CORS).*

---

## 6. Giao tiếp Dịch vụ AI & Fallback Contract

### Endpoint: `POST /api/v1/ai/predict-eta`
- **Request Body**:
```json
{
  "originLatitude": 21.003117,
  "originLongitude": 105.842135,
  "destinationLatitude": 21.028511,
  "destinationLongitude": 105.854444,
  "packageWeightKg": 2.5,
  "droneModel": "Matrice-600-Cargo"
}
```
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "estimatedFlightMinutes": 8.5,
    "distanceKm": 3.82,
    "weatherFactor": "MILD_WIND",
    "recommendedDepartureTime": "2026-10-19T14:15:00Z",
    "isAiGenerated": true,
    "notes": "Dự báo thời tiết quang đãng, tốc độ gió 2.1 m/s lý tưởng cho bay tầm thấp."
  }
}
```
*Ghi chú*: Nếu API AI ngoài bị lỗi/timeout, trường `isAiGenerated` sẽ trả về `false`, và trường `estimatedFlightMinutes` được tính bởi thuật toán vật lý nội bộ `FallbackRuleBasedService`.
