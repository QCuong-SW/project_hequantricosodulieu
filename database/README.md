# Quy trình Xây dựng Cơ sở Dữ liệu (Database-First)

> [!IMPORTANT]
> **HỆ QUẢN TRỊ CSDL BẮT BUỘC**: **MICROSOFT SQL SERVER**  
> (Chỉ làm việc với SQL Server. Chỉ làm việc với SQL Server. Chỉ làm việc với SQL Server.)

---

## 1. Nguyên tắc Phân công
Không để một người làm toàn bộ CSDL. Mỗi thành viên chịu trách nhiệm độc lập từ schema, migration, backend đến frontend của module mình.

| Thứ tự | Thư mục Module | Bảng phụ trách | Thành viên | Nhánh Git | Dải Commit Tuần 1 |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **Bước 1** | `database/` (Khởi tạo) | CSDL `SmartDroneDeliveryDb` | Cường Quang (M3) | `feat/w1-m3-orders` | `w1-01` |
| **Bước 2** | `modules/01_identity_security/` | `users`, `roles`, `user_roles`, `refresh_tokens`, `audit_logs` | Vũ Trí Thành (M1) | `feat/w1-m1-identity` | `w1-02` -> `w1-04` |
| **Bước 3** | `modules/04_stations_handoffs/` | `landing_stations`, `station_slots`, `package_handoffs` | Tấn Tài (M4) | `feat/w1-m4-stations` | `w1-05` -> `w1-07` |
| **Bước 4** | `modules/02_customers_orders/` | `customer_profiles`, `delivery_addresses` | Lê Thanh Nhị (M2) | `feat/w1-m2-customers` | `w1-08` -> `w1-10` |
| **Bước 5** | `modules/02_customers_orders/` & `03_drones_scheduling/` | `delivery_orders`, `packages`, `order_address_snapshots`, `drones`, `flight_schedules` | Cường Quang (M3) | `feat/w1-m3-orders` | `w1-11` -> `w1-12` |
| **Bước 6** | `modules/05_tracking_confirmations/` & `seed/` | `tracking_events`, `delivery_confirmations`, `seed_data_template.sql` | Nguyễn Thành Nhân (M5) | `feat/w1-m5-tracking` | `w1-13` -> `w1-15` |

> [!NOTE]
> **Quy chuẩn Commit tuần tự**: Toàn bộ dự án tuân theo chuỗi số thứ tự tăng dần từ `w1-01` đến `w1-15` theo đúng pipeline phụ thuộc khóa ngoại.
> Xem toàn bộ 79 mẫu commit chi tiết trong file [`timeline_project_.html`](../timeline_project_.html).

---

## 2. Thứ tự Thực thi Script trong SQL Server Management Studio (SSMS) / Azure Data Studio

1. Chạy file khởi tạo chung:
   ```sql
   00_init_database.sql
   ```
2. Từng thành viên thực thi file module của mình theo thứ tự khóa ngoại:
   - Bước 2.1: `modules/01_identity_security/01_create_tables.sql`
   - Bước 2.2: `modules/04_stations_handoffs/04_create_tables.sql`
   - Bước 2.3: `modules/03_drones_scheduling/03_create_tables.sql`
   - Bước 2.4: `modules/02_customers_orders/02_create_tables.sql`
   - Bước 2.5: `modules/05_tracking_confirmations/05_create_tables.sql`
3. Chạy script dữ liệu mẫu:
   ```sql
   seed/seed_data_template.sql
   ```
