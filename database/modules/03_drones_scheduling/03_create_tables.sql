-- ==============================================================================
-- MODULE 3: DRONE FLEET & FLIGHT SCHEDULING
-- Thành viên phụ trách: Cường Quang (M3)
-- Nhánh Git: feat/w1-m3-orders | Commit tuần tự: w1-11 -> w1-12
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- TODO (Thành viên 3): Viết lệnh CREATE TABLE dbo.drones
-- Gợi ý: drone_code UNIQUE, CK_drones_battery, CK_drones_status



-- TODO (Thành viên 3): Viết lệnh CREATE TABLE dbo.flight_schedules
-- Gợi ý: Liên kết drone_id, order_id, origin_station_id, destination_station_id, dispatcher_id



-- TODO (Thành viên 3): Viết lệnh CREATE TABLE dbo.flight_waypoints
-- Gợi ý: Lưu các điểm tọa độ mô phỏng lộ trình bay, FK trỏ sang flight_schedules(id) ON DELETE CASCADE



-- TODO (Thành viên 3): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_flight_schedules_drone ON dbo.flight_schedules(drone_id, status);

GO
