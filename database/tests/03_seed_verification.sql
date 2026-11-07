/* =====================================================================
   TUAN 2 - w2-03: test(seed): verify seed data integrity and role permissions
   File : database/tests/03_seed_verification.sql           (M5: Nguyen Thanh Nhan)
   Chay : SSMS, SAU seed_data_template.sql. Chi doc (SELECT), khong sua du lieu.
   Ky vong: tat ca dong ket_qua = PASS.
   ===================================================================== */
USE SmartDroneDeliveryDb;
GO
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#v') IS NOT NULL DROP TABLE #v;
CREATE TABLE #v (
    id INT IDENTITY(1,1), nhom NVARCHAR(30), kiem_tra NVARCHAR(200),
    thuc_te NVARCHAR(100), ky_vong NVARCHAR(100),
    ket_qua AS (CASE WHEN thuc_te = ky_vong THEN 'PASS' ELSE 'FAIL' END));

/* ---- Vai tro ---- */
INSERT #v (nhom, kiem_tra, thuc_te, ky_vong)
SELECT N'Vai tro', N'Tong so vai tro', CAST(COUNT(*) AS NVARCHAR(100)), N'5' FROM dbo.roles
UNION ALL SELECT N'Vai tro', N'Du 5 ten vai tro chuan', CAST(COUNT(*) AS NVARCHAR(100)), N'5'
    FROM dbo.roles WHERE role_name IN ('ADMIN','DISPATCHER','STATION_OPERATOR','LOGISTICS_MANAGER','CUSTOMER');

/* ---- Tram & slot ---- */
INSERT #v (nhom, kiem_tra, thuc_te, ky_vong)
SELECT N'Tram', N'So tram mau (STN-Q1, STN-TD, STN-Q7)', CAST(COUNT(*) AS NVARCHAR(100)), N'3'
    FROM dbo.landing_stations WHERE station_code IN ('STN-Q1','STN-TD','STN-Q7')
UNION ALL SELECT N'Tram', N'Tram mau dang ACTIVE va chua bi xoa mem', CAST(COUNT(*) AS NVARCHAR(100)), N'3'
    FROM dbo.landing_stations WHERE station_code IN ('STN-Q1','STN-TD','STN-Q7') AND status = 'ACTIVE' AND is_deleted = 0
UNION ALL SELECT N'Tram', N'Tong slot cua 3 tram mau', CAST(COUNT(*) AS NVARCHAR(100)), N'12'
    FROM dbo.station_slots x JOIN dbo.landing_stations s ON s.id = x.station_id
    WHERE s.station_code IN ('STN-Q1','STN-TD','STN-Q7')
UNION ALL SELECT N'Tram', N'Tram co so slot thuc te <> total_slots', CAST(COUNT(*) AS NVARCHAR(100)), N'0'
    FROM dbo.landing_stations s
    WHERE s.total_slots <> (SELECT COUNT(*) FROM dbo.station_slots x WHERE x.station_id = s.id)
UNION ALL SELECT N'Tram', N'Slot LANDING_PAD (3 tram x 2)', CAST(COUNT(*) AS NVARCHAR(100)), N'6'
    FROM dbo.station_slots x JOIN dbo.landing_stations s ON s.id = x.station_id
    WHERE s.station_code IN ('STN-Q1','STN-TD','STN-Q7') AND x.slot_type = 'LANDING_PAD'
UNION ALL SELECT N'Tram', N'Slot CHARGING_DOCK (3 tram x 1)', CAST(COUNT(*) AS NVARCHAR(100)), N'3'
    FROM dbo.station_slots x JOIN dbo.landing_stations s ON s.id = x.station_id
    WHERE s.station_code IN ('STN-Q1','STN-TD','STN-Q7') AND x.slot_type = 'CHARGING_DOCK'
UNION ALL SELECT N'Tram', N'Slot STORAGE_LOCKER (3 tram x 1)', CAST(COUNT(*) AS NVARCHAR(100)), N'3'
    FROM dbo.station_slots x JOIN dbo.landing_stations s ON s.id = x.station_id
    WHERE s.station_code IN ('STN-Q1','STN-TD','STN-Q7') AND x.slot_type = 'STORAGE_LOCKER';

/* ---- Drone ---- */
INSERT #v (nhom, kiem_tra, thuc_te, ky_vong)
SELECT N'Drone', N'So drone mau (DRN-001..003)', CAST(COUNT(*) AS NVARCHAR(100)), N'3'
    FROM dbo.drones WHERE drone_code IN ('DRN-001','DRN-002','DRN-003')
UNION ALL SELECT N'Drone', N'Drone mau co tai trong > 5kg (vuot gioi han goi hang)', CAST(COUNT(*) AS NVARCHAR(100)), N'0'
    FROM dbo.drones WHERE drone_code IN ('DRN-001','DRN-002','DRN-003') AND max_payload_kg > 5.00
UNION ALL SELECT N'Drone', N'Drone mau o trang thai IDLE', CAST(COUNT(*) AS NVARCHAR(100)), N'3'
    FROM dbo.drones WHERE drone_code IN ('DRN-001','DRN-002','DRN-003') AND status = 'IDLE';

/* ---- Tai khoan & phan quyen theo vai tro ---- */
INSERT #v (nhom, kiem_tra, thuc_te, ky_vong)
SELECT N'RBAC', N'So tai khoan mau @smartdrone.vn', CAST(COUNT(*) AS NVARCHAR(100)), N'5'
    FROM dbo.users WHERE email IN ('admin@smartdrone.vn','dispatcher@smartdrone.vn','operator@smartdrone.vn','manager@smartdrone.vn','customer@smartdrone.vn')
UNION ALL SELECT N'RBAC', N'Tai khoan mau o trang thai ACTIVE', CAST(COUNT(*) AS NVARCHAR(100)), N'5'
    FROM dbo.users WHERE email LIKE '%@smartdrone.vn' AND status = 'ACTIVE'
UNION ALL SELECT N'RBAC', N'Tai khoan mau khong co dung 1 vai tro', CAST(COUNT(*) AS NVARCHAR(100)), N'0'
    FROM dbo.users u WHERE u.email LIKE '%@smartdrone.vn'
      AND (SELECT COUNT(*) FROM dbo.user_roles ur WHERE ur.user_id = u.id) <> 1
UNION ALL SELECT N'RBAC', N'Cap (email -> vai tro) dung theo thiet ke', CAST(COUNT(*) AS NVARCHAR(100)), N'5'
    FROM dbo.user_roles ur
    JOIN dbo.users u ON u.id = ur.user_id
    JOIN dbo.roles r ON r.id = ur.role_id
    WHERE (u.email = 'admin@smartdrone.vn'      AND r.role_name = 'ADMIN')
       OR (u.email = 'dispatcher@smartdrone.vn' AND r.role_name = 'DISPATCHER')
       OR (u.email = 'operator@smartdrone.vn'   AND r.role_name = 'STATION_OPERATOR')
       OR (u.email = 'manager@smartdrone.vn'    AND r.role_name = 'LOGISTICS_MANAGER')
       OR (u.email = 'customer@smartdrone.vn'   AND r.role_name = 'CUSTOMER')
UNION ALL SELECT N'RBAC', N'Vai tro khong co tai khoan nao', CAST(COUNT(*) AS NVARCHAR(100)), N'0'
    FROM dbo.roles r WHERE NOT EXISTS (SELECT 1 FROM dbo.user_roles ur WHERE ur.role_id = r.id)
UNION ALL SELECT N'RBAC', N'password_hash dung dinh dang BCrypt ($2a$11$, dai 60 ky tu)', CAST(COUNT(*) AS NVARCHAR(100)), N'5'
    FROM dbo.users WHERE email LIKE '%@smartdrone.vn' AND LEN(password_hash) = 60 AND LEFT(password_hash, 7) = '$2a$11$';

/* ---- Toan ven schema ---- */
INSERT #v (nhom, kiem_tra, thuc_te, ky_vong)
SELECT N'Toan ven', N'Tong so khoa ngoai (ma tran FK = 21)', CAST(COUNT(*) AS NVARCHAR(100)), N'21' FROM sys.foreign_keys
UNION ALL SELECT N'Toan ven', N'FK bi tat hoac khong tin cay', CAST(COUNT(*) AS NVARCHAR(100)), N'0'
    FROM sys.foreign_keys WHERE is_disabled = 1 OR is_not_trusted = 1
UNION ALL SELECT N'Toan ven', N'CHECK bi tat hoac khong tin cay', CAST(COUNT(*) AS NVARCHAR(100)), N'0'
    FROM sys.check_constraints WHERE is_disabled = 1 OR is_not_trusted = 1;

SELECT id, nhom, kiem_tra, thuc_te, ky_vong, ket_qua FROM #v ORDER BY CASE ket_qua WHEN 'FAIL' THEN 0 ELSE 1 END, id;
SELECT ket_qua, COUNT(*) AS so_kiem_tra FROM #v GROUP BY ket_qua;

-- Xem truc tiep: tai khoan -> vai tro
SELECT u.email, u.full_name, r.role_name, u.status
FROM dbo.users u
JOIN dbo.user_roles ur ON ur.user_id = u.id
JOIN dbo.roles r ON r.id = ur.role_id
ORDER BY r.id;

/* Kiem tra tinh idempotent (lam tay): chay lai seed_data_template.sql roi chay lai file nay,
   cac con so phai y het lan truoc (khong tang them dong nao). */
GO