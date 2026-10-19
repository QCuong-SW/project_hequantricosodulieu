-- ==============================================================================
-- MODULE 5: TRACKING EVENTS & DELIVERY CONFIRMATIONS
-- Thành viên phụ trách: Nguyễn Thành Nhân (M5)
-- Nhánh Git: feat/w1-m5-tracking | Commit tuần tự: w1-13 -> w1-14
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- TODO (Thành viên 5): Viết lệnh CREATE TABLE dbo.tracking_events
-- Gợi ý: Bảng bất biến Append-Only lưu dòng sự kiện, FK trỏ sang delivery_orders(id)



-- TODO (Thành viên 5): Viết lệnh CREATE TABLE dbo.delivery_confirmations
-- Gợi ý: Lưu bằng chứng giao hàng (OTP, ảnh MinIO, chữ ký), UQ_delivery_confirmations_order



-- TODO (Thành viên 5): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_tracking_events_order_time ON dbo.tracking_events(order_id, event_timestamp ASC);

GO
