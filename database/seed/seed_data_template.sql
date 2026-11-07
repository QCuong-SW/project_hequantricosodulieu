-- ==============================================================================
-- SEED DATA TEMPLATE FOR MICROSOFT SQL SERVER
-- Thành viên phụ trách: Nguyễn Thành Nhân (M5) | Commit tuần tự: w1-15
-- Password mặc định cho toàn bộ tài khoản seed: P@ssword123!
-- (BCrypt work factor 11: $2a$11$wE5U6xYVq5zUqBqG1h7aCO7X2C9NfXo2u4kS4wS6.3r6vM7ZkUvWC)
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

SET NOCOUNT ON;
GO

/* ---------- 1) 5 vai tro mac dinh ---------- */
INSERT INTO dbo.roles (role_name, description, created_at)
SELECT v.role_name, v.description, SYSDATETIME()
FROM (VALUES
    ('ADMIN',             N'Quản trị hệ thống'),
    ('DISPATCHER',        N'Điều phối viên chuyến bay'),
    ('STATION_OPERATOR',  N'Nhân viên vận hành trạm tiếp đất'),
    ('LOGISTICS_MANAGER', N'Quản lý logistics, xem báo cáo KPI'),
    ('CUSTOMER',          N'Khách hàng đặt đơn giao hàng')
) AS v(role_name, description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.roles r WHERE r.role_name = v.role_name);
GO

/* ---------- 2) 3 tram tiep dat (khu vuc TP.HCM) ---------- */
INSERT INTO dbo.landing_stations
    (id, station_code, name, address_line, latitude, longitude,
     altitude_meter, total_slots, status, is_deleted, created_at)
SELECT v.id, v.station_code, v.name, v.address_line, v.latitude, v.longitude,
       v.altitude_meter, v.total_slots, 'ACTIVE', 0, SYSDATETIME()
FROM (VALUES
    ('A1111111-0000-0000-0000-000000000001', 'STN-Q1',
        N'Trạm Quận 1',   N'Khu vực Bến Thành, Quận 1, TP.HCM',
        10.772500, 106.698000, 5.00, 4),
    ('A1111111-0000-0000-0000-000000000002', 'STN-TD',
        N'Trạm Thủ Đức',  N'Khu vực Thủ Đức, TP.HCM',
        10.850000, 106.771000, 8.00, 4),
    ('A1111111-0000-0000-0000-000000000003', 'STN-Q7',
        N'Trạm Quận 7',   N'Khu vực Phú Mỹ Hưng, Quận 7, TP.HCM',
        10.729500, 106.721800, 4.00, 4)
) AS v(id, station_code, name, address_line, latitude, longitude, altitude_meter, total_slots)
WHERE NOT EXISTS (SELECT 1 FROM dbo.landing_stations s WHERE s.station_code = v.station_code);
GO

/* ---------- 3) Slot cho moi tram (khop total_slots = 4) ---------- */
INSERT INTO dbo.station_slots (id, station_id, slot_number, slot_type, status, updated_at)
SELECT NEWID(), s.id, n.slot_number, n.slot_type, 'AVAILABLE', SYSDATETIME()
FROM dbo.landing_stations s
CROSS JOIN (VALUES
    (1, 'LANDING_PAD'),
    (2, 'LANDING_PAD'),
    (3, 'CHARGING_DOCK'),
    (4, 'STORAGE_LOCKER')
) AS n(slot_number, slot_type)
WHERE s.station_code IN ('STN-Q1', 'STN-TD', 'STN-Q7')
  AND NOT EXISTS (SELECT 1 FROM dbo.station_slots x
                  WHERE x.station_id = s.id AND x.slot_number = n.slot_number);
GO

/* ---------- 4) 3 drone ---------- */
INSERT INTO dbo.drones
    (id, drone_code, model, max_payload_kg, max_flight_range_km,
     max_speed_kmh, battery_percentage, status, is_deleted, created_at)
SELECT v.id, v.drone_code, v.model, v.max_payload_kg, v.max_flight_range_km,
       v.max_speed_kmh, v.battery_percentage, 'IDLE', 0, SYSDATETIME()
FROM (VALUES
    ('D2222222-0000-0000-0000-000000000001', 'DRN-001', N'SD-Falcon X1', 5.00, 20.00, 60.00, 100),
    ('D2222222-0000-0000-0000-000000000002', 'DRN-002', N'SD-Falcon X1', 5.00, 20.00, 60.00,  90),
    ('D2222222-0000-0000-0000-000000000003', 'DRN-003', N'SD-Hawk H2',   3.00, 15.00, 50.00,  85)
) AS v(id, drone_code, model, max_payload_kg, max_flight_range_km, max_speed_kmh, battery_percentage)
WHERE NOT EXISTS (SELECT 1 FROM dbo.drones d WHERE d.drone_code = v.drone_code);
GO

/* ---------- 5) 5 tai khoan mac dinh (mat khau: P@ssword123!) ---------- */
DECLARE @pwd VARCHAR(100) = '$2a$11$wE5U6xYVq5zUqBqG1h7aCO7X2C9NfXo2u4kS4wS6.3r6vM7ZkUvWC';

INSERT INTO dbo.users (email, password_hash, full_name, phone_number, status, created_at, updated_at)
SELECT v.email, @pwd, v.full_name, v.phone_number, 'ACTIVE', SYSDATETIME(), SYSDATETIME()
FROM (VALUES
    ('admin@smartdrone.vn',      N'Quản trị viên',        '0900000001'),
    ('dispatcher@smartdrone.vn', N'Điều phối viên',       '0900000002'),
    ('operator@smartdrone.vn',   N'Nhân viên trạm',       '0900000003'),
    ('manager@smartdrone.vn',    N'Quản lý logistics',    '0900000004'),
    ('customer@smartdrone.vn',   N'Khách hàng mẫu',       '0900000005')
) AS v(email, full_name, phone_number)
WHERE NOT EXISTS (SELECT 1 FROM dbo.users u WHERE u.email = v.email);
GO

INSERT INTO dbo.user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, SYSDATETIME()
FROM (VALUES
    ('admin@smartdrone.vn',      'ADMIN'),
    ('dispatcher@smartdrone.vn', 'DISPATCHER'),
    ('operator@smartdrone.vn',   'STATION_OPERATOR'),
    ('manager@smartdrone.vn',    'LOGISTICS_MANAGER'),
    ('customer@smartdrone.vn',   'CUSTOMER')
) AS m(email, role_name)
JOIN dbo.users u ON u.email     = m.email
JOIN dbo.roles r ON r.role_name = m.role_name
WHERE NOT EXISTS (SELECT 1 FROM dbo.user_roles ur
                  WHERE ur.user_id = u.id AND ur.role_id = r.id);
GO

/* ---------- Kiem tra nhanh (w2-03) ---------- */
SELECT 'roles'            AS bang, COUNT(*) AS so_dong FROM dbo.roles             -- ky vong 5
UNION ALL SELECT 'landing_stations', COUNT(*) FROM dbo.landing_stations          -- >= 3
UNION ALL SELECT 'station_slots',    COUNT(*) FROM dbo.station_slots             -- >= 12
UNION ALL SELECT 'drones',           COUNT(*) FROM dbo.drones                    -- >= 3
UNION ALL SELECT 'users',            COUNT(*) FROM dbo.users                     -- >= 5
UNION ALL SELECT 'user_roles',       COUNT(*) FROM dbo.user_roles;               -- >= 5

-- Moi tram phai co dung total_slots slot (ky vong: khong co dong nao)
SELECT s.station_code, s.total_slots, COUNT(x.id) AS slot_thuc_te
FROM dbo.landing_stations s
LEFT JOIN dbo.station_slots x ON x.station_id = s.id
GROUP BY s.station_code, s.total_slots
HAVING s.total_slots <> COUNT(x.id);
GO