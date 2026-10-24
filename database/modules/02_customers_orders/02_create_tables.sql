-- ==============================================================================
-- MODULE 2: CUSTOMERS, DELIVERY ADDRESSES & ORDERS CORE
-- Thành viên phụ trách: Lê Thanh Nhị (M2) & Cường Quang (M3)
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- ------------------------------------------------------------------------------
-- PHẦN 1: KHÁCH HÀNG & SỔ ĐỊA CHỈ - Phụ trách: Lê Thanh Nhị (M2)
-- Nhánh Git: feat/w1-m2-customers | Commit tuần tự: w1-08 -> w1-10
-- ------------------------------------------------------------------------------

-- TODO (Lê Thanh Nhị - M2): Viết lệnh CREATE TABLE dbo.customer_profiles
-- Gợi ý: FK trỏ sang dbo.users(id), UQ_customer_code, contact_phone, default_address_id


-- TODO (Lê Thanh Nhị - M2): Viết lệnh CREATE TABLE dbo.delivery_addresses
-- Gợi ý: FK trỏ sang dbo.customer_profiles(id), ràng buộc CHECK latitude (-90 đến 90), longitude (-180 đến 180)


-- TODO (Lê Thanh Nhị - M2): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_delivery_addresses_customer ON dbo.delivery_addresses(customer_id);


-- ------------------------------------------------------------------------------
-- PHẦN 2: ĐƠN HÀNG, SNAPSHOT & KIỆN HÀNG - Phụ trách: Cường Quang (M3)
-- Nhánh Git: feat/w1-m3-orders | Commit tuần tự: w1-11 -> w1-12
-- ------------------------------------------------------------------------------

-- TODO (Cường Quang - M3): Viết lệnh CREATE TABLE dbo.delivery_orders
-- Gợi ý: tracking_number UNIQUE, FK customer_id, sender_address_id, recipient_address_id, CK_orders_status


-- TODO (Cường Quang - M3): Viết lệnh CREATE TABLE dbo.order_address_snapshots
-- Gợi ý: Lưu bản sao bất biến địa chỉ lúc tạo đơn, FK trỏ sang delivery_orders(id) ON DELETE CASCADE


-- TODO (Cường Quang - M3): Viết lệnh CREATE TABLE dbo.packages
-- Gợi ý: package_code UNIQUE, weight_kg <= 5.0, kích thước dài/rộng/cao, FK order_id


-- TODO (Cường Quang - M3): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_delivery_orders_customer ON dbo.delivery_orders(customer_id, created_at DESC);
-- CREATE NONCLUSTERED INDEX IX_delivery_orders_tracking ON dbo.delivery_orders(tracking_number);

GO
