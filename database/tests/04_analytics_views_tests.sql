/* =====================================================================
   Test 2 view Analytics (M5) - chay trong SSMS sau seed. Moi test trong transaction, ROLLBACK cuoi.
   Ky vong: cot ket_qua cua ca 2 bang = PASS.
   ===================================================================== */
USE SmartDroneDeliveryDb;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;      -- loi giua chung thi tu ROLLBACK
BEGIN TRAN;

/* ---------- v_station_slot_utilization ---------- */
-- STN-Q1 co 4 slot: 1=LANDING_PAD, 2=LANDING_PAD, 3=CHARGING_DOCK, 4=STORAGE_LOCKER
UPDATE x SET status = 'OCCUPIED'    FROM dbo.station_slots x JOIN dbo.landing_stations s ON s.id = x.station_id WHERE s.station_code = 'STN-Q1' AND x.slot_number = 1;
UPDATE x SET status = 'RESERVED'    FROM dbo.station_slots x JOIN dbo.landing_stations s ON s.id = x.station_id WHERE s.station_code = 'STN-Q1' AND x.slot_number = 2;
UPDATE x SET status = 'MAINTENANCE' FROM dbo.station_slots x JOIN dbo.landing_stations s ON s.id = x.station_id WHERE s.station_code = 'STN-Q1' AND x.slot_number = 3;

-- Tram khong co slot nao: phan tram phai la 0.00, khong loi chia cho 0
INSERT dbo.landing_stations (station_code, name, address_line, latitude, longitude, total_slots)
VALUES ('TEST-EMPTY', N'Tram rong', N'Test', 10.0, 106.0, 0);

SELECT N'STN-Q1: 4 slot thuc te'                      AS kiem_tra, CAST(actual_slots AS NVARCHAR(20))        AS thuc_te, N'4'     AS ky_vong,
       CASE WHEN actual_slots = 4 THEN 'PASS' ELSE 'FAIL' END AS ket_qua FROM dbo.v_station_slot_utilization WHERE station_code = 'STN-Q1'
UNION ALL SELECT N'STN-Q1: 1 slot kha dung (AVAILABLE)', CAST(available_slots AS NVARCHAR(20)),   N'1',
       CASE WHEN available_slots = 1 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_station_slot_utilization WHERE station_code = 'STN-Q1'
UNION ALL SELECT N'STN-Q1: 3 slot kha dung (khong tinh bao tri)', CAST(usable_slots AS NVARCHAR(20)), N'3',
       CASE WHEN usable_slots = 3 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_station_slot_utilization WHERE station_code = 'STN-Q1'
UNION ALL SELECT N'STN-Q1: 2 slot ban (OCCUPIED + RESERVED)', CAST(busy_slots AS NVARCHAR(20)),   N'2',
       CASE WHEN busy_slots = 2 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_station_slot_utilization WHERE station_code = 'STN-Q1'
UNION ALL SELECT N'STN-Q1: 2 bai LANDING_PAD deu ban', CAST(landing_pad_busy AS NVARCHAR(20)),     N'2',
       CASE WHEN landing_pad_slots = 2 AND landing_pad_busy = 2 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_station_slot_utilization WHERE station_code = 'STN-Q1'
UNION ALL SELECT N'STN-Q1: ty le su dung 66.67%', CAST(utilization_percent AS NVARCHAR(20)),      N'66.67',
       CASE WHEN utilization_percent = 66.67 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_station_slot_utilization WHERE station_code = 'STN-Q1'
UNION ALL SELECT N'STN-TD: chua dung, ty le 0.00%', CAST(utilization_percent AS NVARCHAR(20)),    N'0.00',
       CASE WHEN utilization_percent = 0 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_station_slot_utilization WHERE station_code = 'STN-TD'
UNION ALL SELECT N'TEST-EMPTY: tram khong slot, ty le 0.00%', CAST(utilization_percent AS NVARCHAR(20)), N'0.00',
       CASE WHEN utilization_percent = 0 AND actual_slots = 0 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_station_slot_utilization WHERE station_code = 'TEST-EMPTY'
UNION ALL SELECT N'Tram bi xoa mem khong xuat hien', CAST(COUNT(*) AS NVARCHAR(20)), N'0',
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
       FROM dbo.v_station_slot_utilization v JOIN dbo.landing_stations s ON s.id = v.station_id WHERE s.is_deleted = 1;

/* ---------- v_flight_delivery_performance ---------- */
DECLARE @d  UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.drones ORDER BY drone_code),
        @s1 UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations WHERE station_code = 'STN-Q1'),
        @s2 UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations WHERE station_code = 'STN-TD');

INSERT dbo.flight_schedules (flight_code, drone_id, origin_station_id, destination_station_id,
        scheduled_departure, actual_departure, scheduled_arrival, actual_arrival, flight_distance_km, status)
VALUES ('TEST-OK',   @d, @s1, @s2, '2026-01-01T08:00:00', '2026-01-01T08:02:00', '2026-01-01T08:30:00', '2026-01-01T08:33:00', 10.00, 'COMPLETED'),  -- tre den 3 phut: dung gio
       ('TEST-LATE', @d, @s1, @s2, '2026-01-01T09:00:00', '2026-01-01T09:00:00', '2026-01-01T09:30:00', '2026-01-01T09:40:00', 10.00, 'COMPLETED'),  -- tre 10 phut
       ('TEST-WAIT', @d, @s1, @s2, '2026-01-01T10:00:00', NULL,                  '2026-01-01T10:30:00', NULL,                  10.00, 'SCHEDULED'),  -- chua bay
       ('TEST-FAST', @d, @s1, @s2, '2026-01-01T11:00:00', '2026-01-01T11:00:00', '2026-01-01T11:30:00', '2026-01-01T11:00:30', 10.00, 'COMPLETED'); -- bay 30 giay

SELECT N'TEST-OK: tre khoi hanh 2 phut' AS kiem_tra, CAST(departure_delay_minutes AS NVARCHAR(20)) AS thuc_te, N'2' AS ky_vong,
       CASE WHEN departure_delay_minutes = 2 THEN 'PASS' ELSE 'FAIL' END AS ket_qua FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-OK'
UNION ALL SELECT N'TEST-OK: tre den 3 phut', CAST(arrival_delay_minutes AS NVARCHAR(20)), N'3',
       CASE WHEN arrival_delay_minutes = 3 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-OK'
UNION ALL SELECT N'TEST-OK: bay thuc te 31 phut', CAST(actual_duration_minutes AS NVARCHAR(20)), N'31',
       CASE WHEN actual_duration_minutes = 31 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-OK'
UNION ALL SELECT N'TEST-OK: dung gio (dung sai 5 phut)', CAST(is_on_time AS NVARCHAR(20)), N'1',
       CASE WHEN is_on_time = 1 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-OK'
UNION ALL SELECT N'TEST-OK: toc do trung binh 19.35 km/h', CAST(average_speed_kmh AS NVARCHAR(20)), N'19.35',
       CASE WHEN average_speed_kmh = 19.35 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-OK'
UNION ALL SELECT N'TEST-LATE: tre 10 phut -> khong dung gio', CAST(is_on_time AS NVARCHAR(20)), N'0',
       CASE WHEN is_on_time = 0 AND arrival_delay_minutes = 10 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-LATE'
UNION ALL SELECT N'TEST-WAIT: chua bay -> is_on_time va do tre la NULL', N'NULL', N'NULL',
       CASE WHEN is_on_time IS NULL AND arrival_delay_minutes IS NULL AND departure_delay_minutes IS NULL AND average_speed_kmh IS NULL THEN 'PASS' ELSE 'FAIL' END
       FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-WAIT'
UNION ALL SELECT N'TEST-FAST: bay < 60 giay -> toc do NULL (tranh tran so)', ISNULL(CAST(average_speed_kmh AS NVARCHAR(20)), N'NULL'), N'NULL',
       CASE WHEN average_speed_kmh IS NULL THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_flight_delivery_performance WHERE flight_code = 'TEST-FAST'
UNION ALL SELECT N'Du 4 chuyen test trong view', CAST(COUNT(*) AS NVARCHAR(20)), N'4',
       CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END FROM dbo.v_flight_delivery_performance WHERE flight_code LIKE 'TEST-%';

ROLLBACK;     -- khong de lai du lieu test
GO
