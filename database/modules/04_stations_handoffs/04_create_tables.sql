-- ==============================================================================
-- MODULE 4: LANDING STATIONS & PACKAGE HANDOFFS
-- Thành viên phụ trách: Tấn Tài (M4)
-- Nhánh Git: feat/w1-m4-stations | Commit tuần tự: w1-05 -> w1-07
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- TODO (Thành viên 4): Viết lệnh CREATE TABLE dbo.landing_stations
-- Gợi ý: station_code UNIQUE, CK_landing_stations_status



-- TODO (Thành viên 4): Viết lệnh CREATE TABLE dbo.station_slots
-- Gợi ý: Khóa duy nhất UNIQUE (station_id, slot_number), FK landing_stations(id) ON DELETE CASCADE



-- TODO (Thành viên 4): Viết lệnh CREATE TABLE dbo.package_handoffs
-- Gợi ý: Ghi nhận biên bản bàn giao, liên kết package_id, station_id, operator_id



-- TODO (Thành viên 4): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_station_slots_status ON dbo.station_slots(station_id, status);

GO
