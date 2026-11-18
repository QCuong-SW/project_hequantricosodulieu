# Bộ 5 Biểu Đồ Thiết Kế Hệ Thống — SmartDroneDelivery

Tài liệu này tổng hợp **5 biểu đồ thiết kế cốt lõi** phục vụ báo cáo và bảo vệ đồ án **Hệ Quản Trị Cơ Sở Dữ Liệu (SmartDroneDelivery)**.

---

## 1. Biểu đồ Phân rã Chức năng & Tác nhân (Use Case / Functional Architecture)

```mermaid
flowchart LR
    subgraph Actors["5 Tác nhân hệ thống (5 Roles)"]
        A1["👤 Admin\n(Quản trị hệ thống)"]
        A2["👤 Customer\n(Khách hàng Web/Mobile)"]
        A3["👤 Dispatcher\n(Điều phối viên)"]
        A4["👤 Station Operator\n(Nhân viên trạm)"]
        A5["👤 Logistics Manager\n(Quản lý hậu cần)"]
    end

    subgraph M1["Module 1: Identity & RBAC"]
        UC1["Đăng nhập JWT & Refresh Token"]
        UC2["Quản lý Users & Phân quyền 5 Roles"]
        UC3["Giám sát Nhật ký Kiểm toán (Audit Logs)"]
    end

    subgraph M2["Module 2: Khách hàng & Đơn hàng"]
        UC4["Quản lý Sổ địa chỉ & Tọa độ GPS"]
        UC5["Tạo đơn giao hàng & Kiện hàng"]
        UC6["Đóng băng địa chỉ (Address Snapshot)"]
        UC7["Hủy đơn trước khi bay (Optimistic Lock)"]
    end

    subgraph M3["Module 3: Điều phối & Lập lịch Drone"]
        UC8["Thẩm định & Phê duyệt / Từ chối đơn"]
        UC9["Kiểm tra tải trọng (<= 5kg) & Pin (>= 30%)"]
        UC10["Gán Drone & Lập lịch bay (Flight Schedule)"]
    end

    subgraph M4["Module 4: Trạm tiếp đất & Realtime"]
        UC11["Quản lý Trạm & Slot (Landing/Charging)"]
        UC12["Quét QR Bàn giao (Idempotent Handoff)"]
        UC13["Phát tọa độ GPS Realtime (SignalR 2s)"]
        UC14["Xác thực OTP 6 số (Băm SHA-256)"]
    end

    subgraph M5["Module 5: AI & Analytics Dashboard"]
        UC15["Dự đoán thời gian bay (AI ETA + Fallback)"]
        UC16["Thống kê hiệu suất bay (SQL Views)"]
        UC17["Thống kê tỷ lệ lấp đầy Slot trạm"]
    end

    A1 --> UC1
    A1 --> UC2
    A1 --> UC3

    A2 --> UC1
    A2 --> UC4
    A2 --> UC5
    UC5 --> UC6
    A2 --> UC7
    A2 --> UC13
    A2 --> UC14

    A3 --> UC1
    A3 --> UC8
    A3 --> UC9
    A3 --> UC10
    A3 --> UC15

    A4 --> UC1
    A4 --> UC11
    A4 --> UC12

    A5 --> UC1
    A5 --> UC16
    A5 --> UC17
```

---

## 2. Biểu đồ Kiến trúc Tổng thể Hệ thống (C4 Container & Modular Monolith)

```mermaid
flowchart TB
    subgraph Clients["Tầng Giao Diện (Presentation Tier)"]
        WebApp["🌐 Web Portal (React 19 + Vite + Tailwind CSS)\nRole: Admin, Dispatcher, Operator, Manager, Customer"]
        MobileApp["📱 Mobile App (Flutter 3.50 / Dart 3.14)\nRole: Customer (Login, Tracking, OTP)"]
    end

    subgraph Backend["Tầng Ứng Dụng (ASP.NET Core 9 Modular Monolith — Port 5028)"]
        AuthMid["🛡️ JWT Bearer Authentication & RBAC Policy Middleware"]
        Controllers["⚙️ REST API Controllers (/api/v1/*)\nAuth • Addresses • Orders • FlightSchedules • Stations • Handoffs • OTP • Eta • Analytics"]
        AppServices["🧩 Application & Domain Layer\nOrderStatusStateMachine • FlightScheduleService • ScanPackageHandoffService • EtaPredictionService"]
        SignalRHub["📡 SignalR TrackingHub (/hubs/tracking)\nJoinOrderTrackingGroup • ReceiveDronePosition"]
        SimWorker["⏱️ DroneSimulatorWorker (BackgroundService)\nPhát tọa độ bay GPS chu kỳ 2 giây/lần"]
        AuditInter["📝 AuditSaveChangesInterceptor (EF Core)\nTự động ghi vết Create / Update / Delete"]
    end

    subgraph Storage["Tầng Cơ Sở Dữ Liệu & Lưu Trữ (Docker Infrastructure)"]
        SQLServer[("🗄️ Microsoft SQL Server 2022 (Port 1433)\n13 Bảng chuẩn 3NF + 2 Views + Triggers + ACID")]
        MinIO[("🪣 MinIO Object Storage (Port 9000)\nsmartdrone-packages • smartdrone-proofs")]
    end

    subgraph ExternalAI["Tầng Dịch Vụ AI Ngoài & Cơ Chế Chịu Lỗi"]
        LLM["🤖 External LLM API\n(OpenAI / Gemini Chat Completions)"]
        Fallback["📐 FallbackRuleBasedService\n(Công thức Haversine + Vận tốc gió nội bộ)"]
    end

    WebApp -->|"REST JSON + Bearer JWT"| AuthMid
    MobileApp -->|"REST JSON + Bearer JWT"| AuthMid
    WebApp <-->|"WebSocket (2s GPS)"| SignalRHub

    AuthMid --> Controllers
    Controllers --> AppServices
    SimWorker --> SignalRHub
    AppServices --> AuditInter
    AuditInter --> SQLServer
    AppServices --> MinIO
    AppServices -->|"Timeout 5s"| LLM
    AppServices -->|"Tự động chuyển khi LLM lỗi"| Fallback
```

---

## 3. Sơ đồ Thực thể Liên kết — ERD Cơ Sở Dữ Liệu (13 Bảng + 2 Views)

```mermaid
erDiagram
    ROLES ||--o{ USER_ROLES : "role_id"
    USERS ||--o{ USER_ROLES : "user_id"
    USERS ||--o{ REFRESH_TOKENS : "user_id"
    USERS ||--o{ AUDIT_LOGS : "user_id"
    USERS ||--o| CUSTOMER_PROFILES : "user_id"

    CUSTOMER_PROFILES ||--o{ DELIVERY_ADDRESSES : "customer_id"
    CUSTOMER_PROFILES ||--o{ DELIVERY_ORDERS : "customer_id"

    DELIVERY_ORDERS ||--|| ORDER_ADDRESS_SNAPSHOTS : "order_id"
    DELIVERY_ORDERS ||--|{ PACKAGES : "order_id"
    DELIVERY_ORDERS ||--o{ FLIGHT_SCHEDULES : "order_id"
    DELIVERY_ORDERS ||--o{ TRACKING_EVENTS : "order_id"
    DELIVERY_ORDERS ||--o| DELIVERY_CONFIRMATIONS : "order_id"

    DRONES ||--o{ FLIGHT_SCHEDULES : "drone_id"
    LANDING_STATIONS ||--o{ FLIGHT_SCHEDULES : "origin / destination"
    FLIGHT_SCHEDULES ||--o{ FLIGHT_WAYPOINTS : "flight_schedule_id"

    LANDING_STATIONS ||--|{ STATION_SLOTS : "station_id"
    LANDING_STATIONS ||--o{ PACKAGE_HANDOFFS : "station_id"
    PACKAGES ||--o{ PACKAGE_HANDOFFS : "package_id"
    USERS ||--o{ PACKAGE_HANDOFFS : "operator_id"
```

---

## 4. Biểu đồ Tuần tự Luồng Giao hàng Toàn trình (End-to-End Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Cust as Customer (Web/Mobile)
    actor Disp as Dispatcher (Web)
    actor Oper as Station Operator (Web)
    participant API as ASP.NET Core 9 API
    participant AI as AI ETA / Fallback
    participant Hub as SignalR TrackingHub
    participant DB as SQL Server / Repository

    Cust->>API: POST /api/v1/delivery-orders (Packages, Sender, Recipient)
    API->>DB: Lưu DeliveryOrder (PENDING_APPROVAL) + OrderAddressSnapshot
    DB-->>API: Trả về TrackingNumber (SDD-...)
    API-->>Cust: 201 Created (Status = PENDING_APPROVAL)

    Disp->>API: GET /api/v1/delivery-orders
    API-->>Disp: Danh sách đơn chờ duyệt
    Disp->>API: POST /api/v1/flight-schedules/orders/review (IsApproved = true)
    API->>DB: Cập nhật Order Status = APPROVED (ConcurrencyVersion++)
    API-->>Disp: 200 OK (Status = APPROVED)

    Disp->>API: GET /api/v1/ai/eta/{orderId}?windSpeedKmh=10
    API->>AI: Tính ETA từ tọa độ Snapshot (LLM -> Fallback Haversine)
    AI-->>API: EstimatedMinutes + DistanceKm + Source
    API-->>Disp: 200 OK (OrderEtaResponse)

    Disp->>API: POST /api/v1/flight-schedules/assign (DroneId, Origin, Dest)
    API->>DB: Tạo FlightSchedule + Đổi Drone = ASSIGNED + Order = SCHEDULED
    API-->>Disp: 201 Created (FlightCode = FLT-...)

    Oper->>API: POST /api/v1/handoffs/scan (STATION_RECEIVED -> LOADED_ON_DRONE)
    API->>DB: Kiểm tra Idempotency + Ghi PackageHandoff + Order = IN_TRANSIT
    API-->>Oper: 200 OK (HandoffStatus = LOADED_ON_DRONE)

    loop Chu kỳ 2 giây/lần (DroneSimulatorWorker)
        API->>Hub: Broadcast ReceiveDronePosition (Lat, Lng, Alt, Speed, Battery)
        Hub-->>Cust: Cập nhật vị trí Drone trực tiếp trên bản đồ
    end

    Cust->>API: POST /api/v1/delivery-confirmations/generate-otp
    API->>DB: Sinh OTP 6 số + Lưu băm SHA-256 (otp_hashed)
    API-->>Cust: Trả mã OTP 6 số

    Cust->>API: POST /api/v1/delivery-confirmations/verify-otp (OrderId, OtpCode)
    API->>DB: Đối chiếu băm SHA-256 -> Cập nhật Order = DELIVERED, Payment = PAID
    API-->>Cust: 200 OK (Giao hàng thành công!)
```

---

## 5. Biểu đồ Máy Trạng thái Vòng đời Đơn hàng (Order Status State Machine)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Khởi tạo nháp
    [*] --> PENDING_APPROVAL: Khách tạo đơn mới

    DRAFT --> PENDING_APPROVAL: Gửi duyệt đơn
    DRAFT --> CANCELLED: Khách hủy đơn

    PENDING_APPROVAL --> APPROVED: Dispatcher phê duyệt (Payload <= 5kg)
    PENDING_APPROVAL --> REJECTED: Dispatcher từ chối (Quá tải / Sai vùng bay)
    PENDING_APPROVAL --> CANCELLED: Khách hủy đơn

    APPROVED --> SCHEDULED: Gán Drone & Trạm (Khóa Drone = ASSIGNED)
    APPROVED --> CANCELLED: Hủy đơn trước khi gán lịch

    SCHEDULED --> IN_TRANSIT: Operator quét QR LOADED_ON_DRONE
    SCHEDULED --> CANCELLED: Hủy đơn & Giải phóng Drone về IDLE

    IN_TRANSIT --> DELIVERING: Drone tiếp cận điểm giao
    IN_TRANSIT --> ARRIVED: Drone hạ cánh tại điểm đích
    IN_TRANSIT --> DELIVERY_FAILED: Sự cố thời tiết / Pin yếu

    DELIVERING --> ARRIVED: Hạ cánh xuống bãi đáp
    DELIVERING --> DELIVERED: Xác thực OTP 6 số (SHA-256)
    DELIVERING --> DELIVERY_FAILED: Giao hàng thất bại

    ARRIVED --> DELIVERED: Xác thực OTP 6 số thành công (Payment = PAID)
    ARRIVED --> DELIVERY_FAILED: Quá hạn OTP / Khách không nhận

    DELIVERY_FAILED --> SCHEDULED: Điều phối lịch bay lại
    DELIVERY_FAILED --> CANCELLED: Hủy đơn & Hoàn tiền (REFUNDED)

    REJECTED --> [*]
    CANCELLED --> [*]
    DELIVERED --> [*]
```
