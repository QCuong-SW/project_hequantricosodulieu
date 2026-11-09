/* =====================================================================
   TUAN 2 - w2-02: perf(db): verify execution plans and add missing indexes
   File : database/tests/02_execution_plan_and_indexes.sql   (M5: Nguyen Thanh Nhan)
   Chay : SSMS, sau seed. Bat Actual Execution Plan (Ctrl+M) truoc khi chay PHAN 3.
   ===================================================================== */
USE SmartDroneDeliveryDb;
GO

/* ===================== PHAN 1: FK CHUA CO INDEX ===================== */
-- Cot khoa ngoai khong la cot dau cua index nao -> JOIN / xoa dong cha phai quet ca bang con.
SELECT OBJECT_NAME(fk.parent_object_id) AS bang,
       COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS cot_fk,
       fk.name AS ten_fk
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc
  ON fkc.constraint_object_id = fk.object_id AND fkc.constraint_column_id = 1
WHERE NOT EXISTS (
    SELECT 1 FROM sys.index_columns ic
    WHERE ic.object_id = fkc.parent_object_id
      AND ic.column_id = fkc.parent_column_id
      AND ic.key_ordinal = 1 AND ic.is_included_column = 0)
ORDER BY bang, cot_fk;
GO

/* ===================== PHAN 2: INDEX TRUNG LAP ===================== */
-- Cung bang, cung danh sach cot khoa -> ton bo nho va cham INSERT/UPDATE ma khong co loi ich.
;WITH k AS (
    SELECT i.object_id, i.name,
           (SELECT STRING_AGG(CAST(c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END AS NVARCHAR(200)), ', ')
                   WITHIN GROUP (ORDER BY ic.key_ordinal)
            FROM sys.index_columns ic
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
              AND ic.is_included_column = 0) AS key_cols
    FROM sys.indexes i
    WHERE i.type IN (1, 2) AND i.has_filter = 0
      AND OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
)
SELECT OBJECT_NAME(object_id) AS bang, key_cols, STRING_AGG(name, ' | ') AS cac_index_trung
FROM k
GROUP BY object_id, key_cols
HAVING COUNT(*) > 1;
GO

/* ===================== PHAN 3: DO EXECUTION PLAN ===================== */
-- 1 batch duy nhat: sinh du lieu gia lap -> chay query -> ROLLBACK (khong de lai gi).
-- Seed co qua it dong nen optimizer luon quet bang; can ~20.000 don / 60.000 su kien /
-- 20.000 chuyen bay de plan phan anh thuc te. Xem tab "Messages" (logical reads) va tab Execution plan.
SET NOCOUNT ON;
SET XACT_ABORT ON;      -- loi giua chung thi tu ROLLBACK, khong de transaction treo

DECLARE @d1 UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.drones ORDER BY drone_code),
        @st1 UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations ORDER BY station_code),
        @st2 UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations ORDER BY station_code DESC);
IF @d1 IS NULL OR @st1 IS NULL OR @st2 IS NULL OR @st1 = @st2
    THROW 50010, N'Can chay seed_data_template.sql truoc (can >= 2 tram va >= 1 drone).', 1;

BEGIN TRAN;

IF OBJECT_ID('tempdb..#n') IS NOT NULL DROP TABLE #n;
SELECT TOP (20000) CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS INT) AS i
INTO #n FROM sys.all_objects a CROSS JOIN sys.all_objects b;

DECLARE @userId UNIQUEIDENTIFIER = NEWID(), @custId UNIQUEIDENTIFIER = NEWID();
INSERT dbo.users (id, email, password_hash, full_name, phone_number)
VALUES (@userId, 'perf.test@smartdrone.vn', 'x', N'Perf Test', '0999999999');
INSERT dbo.customer_profiles (id, user_id, customer_code) VALUES (@custId, @userId, 'CUS-PERF');

INSERT dbo.delivery_orders (id, tracking_number, customer_id, status, created_at)
SELECT NEWID(), 'PERF' + RIGHT('00000000' + CAST(i AS VARCHAR(10)), 8), @custId,
       CHOOSE(i % 4 + 1, 'DRAFT', 'APPROVED', 'IN_TRANSIT', 'DELIVERED'),
       DATEADD(MINUTE, i, '2026-01-01')
FROM #n;

INSERT dbo.tracking_events (order_id, status_code, event_title, event_timestamp)
SELECT o.id, s.code, s.code, DATEADD(MINUTE, s.k * 10, o.created_at)
FROM dbo.delivery_orders o
CROSS JOIN (VALUES (1, 'CREATED'), (2, 'APPROVED'), (3, 'IN_TRANSIT')) AS s(k, code)
WHERE o.tracking_number LIKE 'PERF%';

INSERT dbo.flight_schedules (flight_code, drone_id, origin_station_id, destination_station_id,
       scheduled_departure, scheduled_arrival, actual_departure, actual_arrival, flight_distance_km, status)
SELECT 'PERF-F' + RIGHT('00000000' + CAST(i AS VARCHAR(10)), 8), @d1,
       CASE WHEN i % 2 = 0 THEN @st1 ELSE @st2 END,
       CASE WHEN i % 2 = 0 THEN @st2 ELSE @st1 END,
       DATEADD(MINUTE, i, '2026-01-01'), DATEADD(MINUTE, i + 30, '2026-01-01'),
       DATEADD(MINUTE, i + (i % 7), '2026-01-01'), DATEADD(MINUTE, i + 30 + (i % 11), '2026-01-01'),
       CAST(5 + (i % 15) AS DECIMAL(6,2)),
       CASE WHEN i % 10 = 0 THEN 'ABORTED' ELSE 'COMPLETED' END
FROM #n;

UPDATE STATISTICS dbo.delivery_orders;
UPDATE STATISTICS dbo.tracking_events;
UPDATE STATISTICS dbo.flight_schedules;

DECLARE @oid UNIQUEIDENTIFIER = (SELECT id FROM dbo.delivery_orders WHERE tracking_number = 'PERF00010000');

SET STATISTICS IO ON;
SET STATISTICS TIME ON;

-- Q1: Hanh trinh cua 1 don (man hinh tracking).
--     MONG DOI: Index Seek IX_tracking_events_order_id, KHONG co Sort (index da sap theo event_timestamp).
SELECT event_timestamp, status_code, event_title, current_latitude, current_longitude
FROM dbo.tracking_events WHERE order_id = @oid ORDER BY event_timestamp;

-- Q2: 20 don moi nhat cua 1 khach hang.
--     MONG DOI: Index Seek IX_delivery_orders_customer (customer_id, created_at DESC), Top N khong Sort.
SELECT TOP (20) id, tracking_number, status, created_at
FROM dbo.delivery_orders WHERE customer_id = @custId ORDER BY created_at DESC;

-- Q3: Tra cuu theo ma van don.
--     MONG DOI: Index Seek. Luu y optimizer co the chon UQ_ hoac IX_ (hai index trung nhau o PHAN 2).
SELECT id, status FROM dbo.delivery_orders WHERE tracking_number = 'PERF00010000';

-- Q4: Ty le su dung slot theo tram (nguon cho v_station_slot_utilization, Tuan 3). Bang nho -> scan la binh thuong.
SELECT s.station_code, s.total_slots,
       SUM(CASE WHEN x.status = 'OCCUPIED' THEN 1 ELSE 0 END) AS dang_dung,
       CAST(100.0 * SUM(CASE WHEN x.status = 'OCCUPIED' THEN 1 ELSE 0 END) / NULLIF(s.total_slots, 0) AS DECIMAL(5,2)) AS phan_tram
FROM dbo.landing_stations s
LEFT JOIN dbo.station_slots x ON x.station_id = s.id
GROUP BY s.station_code, s.total_slots;

-- Q5: Hieu suat chuyen bay trong 1 ngay (nguon cho v_flight_delivery_performance, Tuan 3).
--     (A) TRUOC khi co index: Clustered Index Scan tren flight_schedules.
SELECT status, COUNT(*) AS so_chuyen,
       AVG(DATEDIFF(MINUTE, scheduled_arrival, actual_arrival)) AS tre_trung_binh_phut,
       SUM(flight_distance_km) AS tong_km
FROM dbo.flight_schedules
WHERE scheduled_departure >= '2026-01-01' AND scheduled_departure < '2026-01-02'
GROUP BY status;

CREATE NONCLUSTERED INDEX IX_flight_schedules_scheduled_departure
    ON dbo.flight_schedules (scheduled_departure)
    INCLUDE (status, scheduled_arrival, actual_arrival, flight_distance_km);

--     (B) SAU khi co index: MONG DOI Index Seek, logical reads giam ro ret so voi (A).
SELECT status, COUNT(*) AS so_chuyen,
       AVG(DATEDIFF(MINUTE, scheduled_arrival, actual_arrival)) AS tre_trung_binh_phut,
       SUM(flight_distance_km) AS tong_km
FROM dbo.flight_schedules
WHERE scheduled_departure >= '2026-01-01' AND scheduled_departure < '2026-01-02'
GROUP BY status;

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
ROLLBACK;     -- xoa toan bo du lieu gia lap va index thu nghiem o tren
GO

/* ===================== PHAN 4: THEM INDEX CON THIEU (chay that) ===================== */
-- Bang flight_schedules / audit_logs la cua Cuong (M3) / Thanh (M1): bao ho truoc khi commit.

-- FK khong co index (ket qua PHAN 1)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_flight_schedules_origin_station_id' AND object_id = OBJECT_ID(N'dbo.flight_schedules'))
    CREATE NONCLUSTERED INDEX IX_flight_schedules_origin_station_id ON dbo.flight_schedules (origin_station_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_flight_schedules_destination_station_id' AND object_id = OBJECT_ID(N'dbo.flight_schedules'))
    CREATE NONCLUSTERED INDEX IX_flight_schedules_destination_station_id ON dbo.flight_schedules (destination_station_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_flight_schedules_dispatcher_id' AND object_id = OBJECT_ID(N'dbo.flight_schedules'))
    CREATE NONCLUSTERED INDEX IX_flight_schedules_dispatcher_id ON dbo.flight_schedules (dispatcher_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_audit_logs_user_id' AND object_id = OBJECT_ID(N'dbo.audit_logs'))
    CREATE NONCLUSTERED INDEX IX_audit_logs_user_id ON dbo.audit_logs (user_id);

-- Phuc vu bao cao hieu suat chuyen bay theo khoang thoi gian (Q5)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_flight_schedules_scheduled_departure' AND object_id = OBJECT_ID(N'dbo.flight_schedules'))
    CREATE NONCLUSTERED INDEX IX_flight_schedules_scheduled_departure
        ON dbo.flight_schedules (scheduled_departure)
        INCLUDE (status, scheduled_arrival, actual_arrival, flight_distance_km);
GO

-- Index trung lap (PHAN 2): UQ_ da tu tao index, IX_ cung cot la thua. DE XUAT xoa, can chu bang dong y.
-- DROP INDEX IX_users_email           ON dbo.users;
-- DROP INDEX IX_delivery_orders_tracking ON dbo.delivery_orders;
-- DROP INDEX IX_packages_package_code ON dbo.packages;
GO