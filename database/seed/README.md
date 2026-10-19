# Hướng dẫn Nạp Dữ liệu Mẫu (Seed Data)

**Hệ Quản Trị CSDL**: Microsoft SQL Server (T-SQL)

Sau khi cả 5 thành viên đã hoàn thành và thực thi xong các script bảng của module mình theo thứ tự:
1. `00_init_database.sql`
2. `modules/01_identity_security/01_create_tables.sql`
3. `modules/04_stations_handoffs/04_create_tables.sql` (Trạm tiếp đất)
4. `modules/03_drones_scheduling/03_create_tables.sql` (Đội Drone)
5. `modules/02_customers_orders/02_create_tables.sql` (Khách hàng & Đơn hàng)
6. `modules/05_tracking_confirmations/05_create_tables.sql` (Tracking & Xác nhận)

Cả nhóm sẽ chạy `seed_data_template.sql` để nạp dữ liệu mẫu cho 5 Actor, 3 trạm và 3 drone phục vụ demo.
