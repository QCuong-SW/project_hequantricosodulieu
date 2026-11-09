-- ==============================================================================
-- MODULE 5: ANALYTICS VIEW - TỶ LỆ SỬ DỤNG SLOT THEO TRẠM
-- Thành viên phụ trách: Nguyễn Thành Nhân (M5)
-- Nhánh Git: feat/w3-m5-analytics | Commit: w3-15
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- Chạy SAU: 04_create_tables.sql (landing_stations, station_slots)
-- ==============================================================================
-- Quy ước tính toán:
--   usable_slots        = slot không ở trạng thái MAINTENANCE (slot đang bảo trì không tính vào sức chứa)
--   busy_slots          = slot OCCUPIED hoặc RESERVED (đã có drone hoặc đã được giữ chỗ)
--   utilization_percent = busy_slots / usable_slots * 100  (0.00 nếu trạm không có slot khả dụng)
-- Chỉ tính trạm chưa bị xóa mềm (is_deleted = 0).
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

CREATE OR ALTER VIEW dbo.v_station_slot_utilization
AS
SELECT
    s.id                                                                  AS station_id,
    s.station_code,
    s.name                                                                AS station_name,
    s.status                                                              AS station_status,
    s.total_slots                                                         AS declared_slots,
    COUNT(x.id)                                                           AS actual_slots,
    SUM(CASE WHEN x.status = 'AVAILABLE'   THEN 1 ELSE 0 END)             AS available_slots,
    SUM(CASE WHEN x.status = 'OCCUPIED'    THEN 1 ELSE 0 END)             AS occupied_slots,
    SUM(CASE WHEN x.status = 'RESERVED'    THEN 1 ELSE 0 END)             AS reserved_slots,
    SUM(CASE WHEN x.status = 'MAINTENANCE' THEN 1 ELSE 0 END)             AS maintenance_slots,
    SUM(CASE WHEN x.status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED')
             THEN 1 ELSE 0 END)                                           AS usable_slots,
    SUM(CASE WHEN x.status IN ('OCCUPIED', 'RESERVED')
             THEN 1 ELSE 0 END)                                           AS busy_slots,
    SUM(CASE WHEN x.slot_type = 'LANDING_PAD' THEN 1 ELSE 0 END)          AS landing_pad_slots,
    SUM(CASE WHEN x.slot_type = 'LANDING_PAD'
              AND x.status IN ('OCCUPIED', 'RESERVED')
             THEN 1 ELSE 0 END)                                           AS landing_pad_busy,
    CAST(ISNULL(
            100.0 * SUM(CASE WHEN x.status IN ('OCCUPIED', 'RESERVED') THEN 1 ELSE 0 END)
                  / NULLIF(SUM(CASE WHEN x.status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED') THEN 1 ELSE 0 END), 0),
            0) AS DECIMAL(5,2))                                           AS utilization_percent
FROM dbo.landing_stations s
LEFT JOIN dbo.station_slots x ON x.station_id = s.id
WHERE s.is_deleted = 0
GROUP BY s.id, s.station_code, s.name, s.status, s.total_slots;
GO

-- Kiểm tra nhanh sau seed: mỗi trạm 4 slot, 0 slot bận, utilization_percent = 0.00
-- SELECT * FROM dbo.v_station_slot_utilization ORDER BY station_code;
GO
