-- ==============================================================================
-- MODULE 5: ANALYTICS VIEW - HIỆU SUẤT CHUYẾN BAY GIAO HÀNG
-- Thành viên phụ trách: Nguyễn Thành Nhân (M5)
-- Nhánh Git: feat/w3-m5-analytics | Commit: w3-16
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- Chạy SAU: 02, 03, 04 (delivery_orders, flight_schedules, drones, landing_stations)
-- ==============================================================================
-- Mỗi dòng = 1 chuyến bay. API Analytics gom nhóm theo khoảng ngày / trạng thái.
-- Quy ước tính toán:
--   *_delay_minutes     = thực tế - kế hoạch (phút, dương = trễ, âm = sớm); NULL nếu chưa có giờ thực tế
--   actual_duration_*   = actual_arrival - actual_departure (phút)
--   is_on_time          = 1 nếu chuyến COMPLETED và đến trễ không quá 5 phút (dung sai); 0 nếu trễ hơn;
--                         NULL nếu chưa hoàn thành
--   average_speed_kmh   = flight_distance_km / thời gian bay thực tế (NULL nếu thời gian bay < 60 giây)
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

CREATE OR ALTER VIEW dbo.v_flight_delivery_performance
AS
SELECT
    f.id                    AS flight_id,
    f.flight_code,
    f.status                AS flight_status,
    f.order_id,
    o.tracking_number,
    o.status                AS order_status,
    f.drone_id,
    d.drone_code,
    so.station_code         AS origin_station_code,
    sd.station_code         AS destination_station_code,
    f.flight_distance_km,
    f.scheduled_departure,
    f.actual_departure,
    f.scheduled_arrival,
    f.actual_arrival,
    CASE WHEN f.actual_departure IS NOT NULL
         THEN DATEDIFF(MINUTE, f.scheduled_departure, f.actual_departure) END   AS departure_delay_minutes,
    CASE WHEN f.actual_arrival IS NOT NULL
         THEN DATEDIFF(MINUTE, f.scheduled_arrival, f.actual_arrival) END       AS arrival_delay_minutes,
    DATEDIFF(MINUTE, f.scheduled_departure, f.scheduled_arrival)                AS scheduled_duration_minutes,
    CASE WHEN f.actual_departure IS NOT NULL AND f.actual_arrival IS NOT NULL
         THEN DATEDIFF(MINUTE, f.actual_departure, f.actual_arrival) END        AS actual_duration_minutes,
    CAST(CASE WHEN f.status = 'COMPLETED' AND f.actual_arrival IS NOT NULL
              THEN CASE WHEN DATEDIFF(MINUTE, f.scheduled_arrival, f.actual_arrival) <= 5
                        THEN 1 ELSE 0 END
         END AS BIT)                                                            AS is_on_time,
    CAST(CASE WHEN f.actual_departure IS NOT NULL AND f.actual_arrival IS NOT NULL
               AND DATEDIFF(SECOND, f.actual_departure, f.actual_arrival) >= 60
              THEN f.flight_distance_km * 3600.0
                   / DATEDIFF(SECOND, f.actual_departure, f.actual_arrival)
         END AS DECIMAL(6,2))                                                   AS average_speed_kmh
FROM dbo.flight_schedules f
JOIN dbo.drones           d  ON d.id  = f.drone_id
JOIN dbo.landing_stations so ON so.id = f.origin_station_id
JOIN dbo.landing_stations sd ON sd.id = f.destination_station_id
LEFT JOIN dbo.delivery_orders o ON o.id = f.order_id;
GO

-- Kiểm tra nhanh: SELECT TOP 20 * FROM dbo.v_flight_delivery_performance ORDER BY scheduled_departure DESC;
GO
