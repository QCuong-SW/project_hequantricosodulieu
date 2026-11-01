/* =====================================================================
   TUAN 2 - w2-01: test(db): add sql test scripts for foreign key integrity check
   File : database/tests/01_fk_integrity_tests.sql         (M5: Nguyen Thanh Nhan)
   Chay : SSMS, SAU KHI da chay 00 -> 05 va seed_data_template.sql.
   An toan: moi test chay trong transaction va ROLLBACK, khong de lai du lieu.

   PHAN A: doi chieu 21 khoa ngoai ky vong (ma tran FK trong erd.md) voi CSDL thuc te.
   PHAN B: chay ~40 kich ban vi pham / cascade, in bang PASS/FAIL.
   ===================================================================== */
USE SmartDroneDeliveryDb;
GO

/* ===================== PHAN A: KIEM TRA CAU TRUC ===================== */

-- A1. Du 18 bang?
SELECT t.ten_bang,
       CASE WHEN OBJECT_ID(N'dbo.' + t.ten_bang, N'U') IS NULL THEN 'MISSING' ELSE 'OK' END AS trang_thai
FROM (VALUES ('roles'),('users'),('user_roles'),('refresh_tokens'),('audit_logs'),
             ('customer_profiles'),('delivery_addresses'),('delivery_orders'),
             ('order_address_snapshots'),('packages'),('drones'),('flight_schedules'),
             ('flight_waypoints'),('landing_stations'),('station_slots'),
             ('package_handoffs'),('tracking_events'),('delivery_confirmations')) AS t(ten_bang)
ORDER BY CASE WHEN OBJECT_ID(N'dbo.' + t.ten_bang, N'U') IS NULL THEN 0 ELSE 1 END, t.ten_bang;
GO

-- A2. Du 21 khoa ngoai, dung hanh dong ON DELETE, dang bat va tin cay?
SELECT e.child_table, e.child_column, e.parent_table, e.expected_delete,
       fk.fk_name, fk.actual_delete,
       CASE WHEN fk.fk_name IS NULL                    THEN 'MISSING'
            WHEN fk.is_disabled = 1                    THEN 'DISABLED'
            WHEN fk.is_not_trusted = 1                 THEN 'NOT TRUSTED'
            WHEN fk.actual_delete <> e.expected_delete THEN 'ACTION KHAC'
            ELSE 'OK' END AS trang_thai
FROM (VALUES
    ('user_roles',             'user_id',               'users',             'CASCADE'),
    ('user_roles',             'role_id',               'roles',             'CASCADE'),
    ('refresh_tokens',         'user_id',               'users',             'CASCADE'),
    ('audit_logs',             'user_id',               'users',             'SET_NULL'),
    ('customer_profiles',      'user_id',               'users',             'NO_ACTION'),
    ('delivery_addresses',     'customer_id',           'customer_profiles', 'CASCADE'),
    ('delivery_orders',        'customer_id',           'customer_profiles', 'NO_ACTION'),
    ('order_address_snapshots','order_id',              'delivery_orders',   'CASCADE'),
    ('packages',               'order_id',              'delivery_orders',   'CASCADE'),
    ('station_slots',          'station_id',            'landing_stations',  'CASCADE'),
    ('package_handoffs',       'station_id',            'landing_stations',  'NO_ACTION'),
    ('package_handoffs',       'operator_id',           'users',             'NO_ACTION'),
    ('package_handoffs',       'package_id',            'packages',          'NO_ACTION'),
    ('flight_schedules',       'drone_id',              'drones',            'NO_ACTION'),
    ('flight_schedules',       'order_id',              'delivery_orders',   'SET_NULL'),
    ('flight_schedules',       'origin_station_id',     'landing_stations',  'NO_ACTION'),
    ('flight_schedules',       'destination_station_id','landing_stations',  'NO_ACTION'),
    ('flight_schedules',       'dispatcher_id',         'users',             'SET_NULL'),
    ('flight_waypoints',       'flight_schedule_id',    'flight_schedules',  'CASCADE'),
    ('tracking_events',        'order_id',              'delivery_orders',   'CASCADE'),
    ('delivery_confirmations', 'order_id',              'delivery_orders',   'CASCADE')
) AS e(child_table, child_column, parent_table, expected_delete)
LEFT JOIN (
    SELECT f.name AS fk_name, f.is_disabled, f.is_not_trusted,
           f.delete_referential_action_desc AS actual_delete,
           OBJECT_NAME(f.parent_object_id)               AS child_table,
           COL_NAME(fc.parent_object_id, fc.parent_column_id) AS child_column,
           OBJECT_NAME(f.referenced_object_id)           AS parent_table
    FROM sys.foreign_keys f
    JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
) fk ON fk.child_table = e.child_table
    AND fk.child_column = e.child_column
    AND fk.parent_table = e.parent_table
ORDER BY CASE WHEN fk.fk_name IS NULL THEN 0 ELSE 1 END, e.child_table, e.child_column;
GO

-- A3. CHECK constraint nao bi tat / khong tin cay? (ky vong: khong co dong nao)
SELECT OBJECT_NAME(parent_object_id) AS bang, name, is_disabled, is_not_trusted
FROM sys.check_constraints
WHERE is_disabled = 1 OR is_not_trusted = 1;
GO

/* ===================== PHAN B: KICH BAN VI PHAM / CASCADE ===================== */
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#tests')   IS NOT NULL DROP TABLE #tests;
IF OBJECT_ID('tempdb..#results') IS NOT NULL DROP TABLE #results;

CREATE TABLE #tests (
    id INT IDENTITY(1,1) PRIMARY KEY,
    grp NVARCHAR(20), name NVARCHAR(200),
    setup TINYINT,        -- 0 khong, 1 chuoi don hang, 2 tram+drone, 3 ca hai
    kind CHAR(3),         -- ERR: mong doi loi chua 'expect' | OUT: batch tra @out = 'OK'
    expect NVARCHAR(200), sqltext NVARCHAR(MAX));
CREATE TABLE #results (
    id INT IDENTITY(1,1), grp NVARCHAR(20), name NVARCHAR(200),
    expected NVARCHAR(200), actual NVARCHAR(400), result VARCHAR(5));

-- Du lieu nen cho cac test: user -> customer -> order -> package (dau ~ se doi thanh dau ')
DECLARE @setup1 NVARCHAR(MAX) = N'
DECLARE @u UNIQUEIDENTIFIER = NEWID(), @c UNIQUEIDENTIFIER = NEWID(),
        @o UNIQUEIDENTIFIER = NEWID(), @p UNIQUEIDENTIFIER = NEWID();
INSERT dbo.users (id, email, password_hash, full_name, phone_number)
    VALUES (@u, ~fk.test@smartdrone.vn~, ~x~, N~FK Test~, ~0988888888~);
INSERT dbo.customer_profiles (id, user_id, customer_code) VALUES (@c, @u, ~CUS-FKTEST~);
INSERT dbo.delivery_orders (id, tracking_number, customer_id) VALUES (@o, ~FKTEST-ORDER~, @c);
INSERT dbo.packages (id, order_id, package_code, description, weight_kg, length_cm, width_cm, height_cm)
    VALUES (@p, @o, ~FKTEST-PKG~, N~x~, 1, 10, 10, 10);
';
-- Du lieu nen: 2 tram + 1 drone lay tu seed
DECLARE @setup2 NVARCHAR(MAX) = N'
DECLARE @s1 UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations ORDER BY station_code),
        @s2 UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations ORDER BY station_code DESC),
        @d  UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.drones ORDER BY drone_code);
';

/* ---- Nhom FK: INSERT con tro toi cha khong ton tai ---- */
INSERT #tests (grp, name, setup, kind, expect, sqltext) VALUES
(N'FK', N'user_roles.user_id -> users', 0, 'ERR', N'FK_user_roles_users',
  N'INSERT dbo.user_roles (user_id, role_id) SELECT NEWID(), MIN(id) FROM dbo.roles;'),
(N'FK', N'user_roles.role_id -> roles', 0, 'ERR', N'FK_user_roles_roles',
  N'INSERT dbo.user_roles (user_id, role_id) SELECT TOP 1 id, -999 FROM dbo.users;'),
(N'FK', N'refresh_tokens.user_id -> users', 0, 'ERR', N'FK_refresh_tokens_users',
  N'INSERT dbo.refresh_tokens (user_id, token, expires_at) VALUES (NEWID(), ~tok-fk-test~, DATEADD(DAY, 1, SYSDATETIME()));'),
(N'FK', N'audit_logs.user_id -> users', 0, 'ERR', N'FK_audit_logs_users',
  N'INSERT dbo.audit_logs (user_id, action, entity_name, entity_id) VALUES (NEWID(), ~TEST~, ~x~, ~1~);'),
(N'FK', N'customer_profiles.user_id -> users', 0, 'ERR', N'FK_customer_profiles_users',
  N'INSERT dbo.customer_profiles (user_id, customer_code) VALUES (NEWID(), ~CUS-FKTEST~);'),
(N'FK', N'delivery_addresses.customer_id -> customer_profiles', 0, 'ERR', N'FK_delivery_addresses_customer_profiles_customer_id',
  N'INSERT dbo.delivery_addresses (customer_id, address_line, city) VALUES (NEWID(), N~x~, N~HCM~);'),
(N'FK', N'delivery_orders.customer_id -> customer_profiles', 0, 'ERR', N'FK_delivery_orders_customers',
  N'INSERT dbo.delivery_orders (tracking_number, customer_id) VALUES (~FKTEST-0001~, NEWID());'),
(N'FK', N'order_address_snapshots.order_id -> delivery_orders', 0, 'ERR', N'FK_order_address_snapshots_orders',
  N'INSERT dbo.order_address_snapshots (order_id, sender_name, sender_phone, sender_address_text, sender_latitude, sender_longitude, recipient_name, recipient_phone, recipient_address_text, recipient_latitude, recipient_longitude) VALUES (NEWID(), N~A~, ~0900~, N~x~, 10, 106, N~B~, ~0901~, N~y~, 10, 106);'),
(N'FK', N'packages.order_id -> delivery_orders', 0, 'ERR', N'FK_packages_orders',
  N'INSERT dbo.packages (order_id, package_code, description, weight_kg, length_cm, width_cm, height_cm) VALUES (NEWID(), ~FKTEST-PKG0~, N~x~, 1, 10, 10, 10);'),
(N'FK', N'station_slots.station_id -> landing_stations', 0, 'ERR', N'FK_station_slots_landing_stations_station_id',
  N'INSERT dbo.station_slots (station_id, slot_number, slot_type) VALUES (NEWID(), 99, ~LANDING_PAD~);'),
(N'FK', N'package_handoffs.station_id -> landing_stations', 1, 'ERR', N'FK_package_handoffs_landing_stations_station_id',
  N'INSERT dbo.package_handoffs (package_id, station_id, operator_id, handoff_type) VALUES (@p, NEWID(), @u, ~STATION_RECEIVED~);'),
(N'FK', N'package_handoffs.operator_id -> users', 1, 'ERR', N'FK_package_handoffs_users_operator_id',
  N'INSERT dbo.package_handoffs (package_id, station_id, operator_id, handoff_type) VALUES (@p, (SELECT TOP 1 id FROM dbo.landing_stations), NEWID(), ~STATION_RECEIVED~);'),
(N'FK', N'package_handoffs.package_id -> packages  [de thieu FK]', 1, 'ERR', N'FK_package_handoffs_packages_package_id',
  N'INSERT dbo.package_handoffs (package_id, station_id, operator_id, handoff_type) VALUES (NEWID(), (SELECT TOP 1 id FROM dbo.landing_stations), @u, ~STATION_RECEIVED~);'),
(N'FK', N'flight_schedules.drone_id -> drones', 2, 'ERR', N'FK_flight_schedules_drones',
  N'INSERT dbo.flight_schedules (flight_code, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, NEWID(), @s1, @s2, SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));'),
(N'FK', N'flight_schedules.origin_station_id -> landing_stations', 2, 'ERR', N'FK_flight_schedules_origin',
  N'INSERT dbo.flight_schedules (flight_code, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, @d, NEWID(), @s2, SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));'),
(N'FK', N'flight_schedules.destination_station_id -> landing_stations', 2, 'ERR', N'FK_flight_schedules_dest',
  N'INSERT dbo.flight_schedules (flight_code, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, @d, @s1, NEWID(), SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));'),
(N'FK', N'flight_schedules.order_id -> delivery_orders  [de thieu FK]', 2, 'ERR', N'FK_flight_schedules_orders',
  N'INSERT dbo.flight_schedules (flight_code, order_id, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, NEWID(), @d, @s1, @s2, SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));'),
(N'FK', N'flight_schedules.dispatcher_id -> users', 2, 'ERR', N'FK_flight_schedules_dispatcher',
  N'INSERT dbo.flight_schedules (flight_code, dispatcher_id, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, NEWID(), @d, @s1, @s2, SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));'),
(N'FK', N'flight_waypoints.flight_schedule_id -> flight_schedules', 0, 'ERR', N'FK_flight_waypoints_schedules',
  N'INSERT dbo.flight_waypoints (flight_schedule_id, sequence_order, latitude, longitude, target_altitude_meter, estimated_speed_kmh) VALUES (NEWID(), 1, 10, 106, 50, 40);'),
(N'FK', N'tracking_events.order_id -> delivery_orders', 0, 'ERR', N'FK_tracking_events_delivery_orders_order_id',
  N'INSERT dbo.tracking_events (order_id, status_code, event_title) VALUES (NEWID(), ~CREATED~, N~x~);'),
(N'FK', N'delivery_confirmations.order_id -> delivery_orders', 0, 'ERR', N'FK_delivery_confirmations_delivery_orders_order_id',
  N'INSERT dbo.delivery_confirmations (order_id, confirmation_method, otp_hashed, otp_expired_at) VALUES (NEWID(), ~OTP~, ~h~, DATEADD(MINUTE, 5, SYSDATETIME()));');

/* ---- Nhom CK/UQ/Trigger: rang buoc cua Module 5 va vai bang chinh ---- */
INSERT #tests (grp, name, setup, kind, expect, sqltext) VALUES
(N'CK/UQ', N'tracking_events: pin 150% bi chan', 1, 'ERR', N'CK_tracking_events_current_battery',
  N'INSERT dbo.tracking_events (order_id, status_code, event_title, current_battery) VALUES (@o, ~IN_TRANSIT~, N~x~, 150);'),
(N'CK/UQ', N'tracking_events: vi do 95 bi chan', 1, 'ERR', N'CK_tracking_events_current_latitude',
  N'INSERT dbo.tracking_events (order_id, status_code, event_title, current_latitude) VALUES (@o, ~IN_TRANSIT~, N~x~, 95);'),
(N'CK/UQ', N'delivery_confirmations: OTP thieu hash bi chan', 1, 'ERR', N'CK_delivery_confirmations_otp_required',
  N'INSERT dbo.delivery_confirmations (order_id, confirmation_method) VALUES (@o, ~OTP~);'),
(N'CK/UQ', N'delivery_confirmations: is_verified=1 thieu confirmed_at bi chan', 1, 'ERR', N'CK_delivery_confirmations_verified_confirmed_at',
  N'INSERT dbo.delivery_confirmations (order_id, confirmation_method, is_verified) VALUES (@o, ~DYNAMIC_QR~, 1);'),
(N'CK/UQ', N'delivery_confirmations: phuong thuc la SMS bi chan', 1, 'ERR', N'CK_delivery_confirmations_confirmation_method',
  N'INSERT dbo.delivery_confirmations (order_id, confirmation_method) VALUES (@o, ~SMS~);'),
(N'CK/UQ', N'delivery_confirmations: 1 don chi co 1 xac nhan', 1, 'ERR', N'UQ_delivery_confirmations_order_id',
  N'INSERT dbo.delivery_confirmations (order_id, confirmation_method) VALUES (@o, ~DYNAMIC_QR~); INSERT dbo.delivery_confirmations (order_id, confirmation_method) VALUES (@o, ~DYNAMIC_QR~);'),
(N'CK/UQ', N'tracking_events: UPDATE bi trigger chan (append-only)', 1, 'ERR', N'append-only',
  N'INSERT dbo.tracking_events (order_id, status_code, event_title) VALUES (@o, ~CREATED~, N~x~); UPDATE dbo.tracking_events SET event_title = N~sua~ WHERE order_id = @o;'),
(N'CK/UQ', N'delivery_orders: status XYZ bi chan', 1, 'ERR', N'CK_delivery_orders_status',
  N'INSERT dbo.delivery_orders (tracking_number, customer_id, status) VALUES (~FKTEST-BAD~, @c, ~XYZ~);'),
(N'CK/UQ', N'packages: nang 6kg (> 5kg) bi chan', 1, 'ERR', N'CK_packages_weight',
  N'INSERT dbo.packages (order_id, package_code, description, weight_kg, length_cm, width_cm, height_cm) VALUES (@o, ~FKTEST-PKG2~, N~x~, 6, 10, 10, 10);'),
(N'CK/UQ', N'drones: pin 101% bi chan', 0, 'ERR', N'CK_drones_battery',
  N'INSERT dbo.drones (drone_code, model, battery_percentage) VALUES (~FKTEST-D~, N~x~, 101);'),
(N'CK/UQ', N'users: trung email bi chan', 0, 'ERR', N'UQ_users_email',
  N'INSERT dbo.users (email, password_hash, full_name, phone_number) SELECT TOP 1 email, ~x~, N~dup~, ~0966666666~ FROM dbo.users;');

/* ---- Nhom DELETE / CASCADE ---- */
INSERT #tests (grp, name, setup, kind, expect, sqltext) VALUES
(N'CASCADE', N'Xoa don hang -> xoa tracking, xac nhan, snapshot, kien hang', 1, 'OUT', N'OK',
  N'INSERT dbo.tracking_events (order_id, status_code, event_title) VALUES (@o, ~CREATED~, N~x~);
    INSERT dbo.delivery_confirmations (order_id, confirmation_method) VALUES (@o, ~DYNAMIC_QR~);
    INSERT dbo.order_address_snapshots (order_id, sender_name, sender_phone, sender_address_text, sender_latitude, sender_longitude, recipient_name, recipient_phone, recipient_address_text, recipient_latitude, recipient_longitude) VALUES (@o, N~A~, ~0900~, N~x~, 10, 106, N~B~, ~0901~, N~y~, 10, 106);
    DELETE dbo.delivery_orders WHERE id = @o;
    SET @out = CASE WHEN EXISTS (SELECT 1 FROM dbo.tracking_events WHERE order_id = @o)
                      OR EXISTS (SELECT 1 FROM dbo.delivery_confirmations WHERE order_id = @o)
                      OR EXISTS (SELECT 1 FROM dbo.order_address_snapshots WHERE order_id = @o)
                      OR EXISTS (SELECT 1 FROM dbo.packages WHERE order_id = @o)
                    THEN N~Con du lieu con sau khi xoa don~ ELSE N~OK~ END;'),
(N'CASCADE', N'Xoa user -> xoa user_roles', 0, 'OUT', N'OK',
  N'DECLARE @u2 UNIQUEIDENTIFIER = NEWID();
    INSERT dbo.users (id, email, password_hash, full_name, phone_number) VALUES (@u2, ~fk.test2@smartdrone.vn~, ~x~, N~FK Test 2~, ~0977777777~);
    INSERT dbo.user_roles (user_id, role_id) SELECT @u2, MIN(id) FROM dbo.roles;
    DELETE dbo.users WHERE id = @u2;
    SET @out = CASE WHEN EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = @u2) THEN N~user_roles van con~ ELSE N~OK~ END;'),
(N'CASCADE', N'Xoa user dang co customer_profile bi chan (NO ACTION)', 1, 'ERR', N'FK_customer_profiles_users',
  N'DELETE dbo.users WHERE id = @u;'),
(N'CASCADE', N'Xoa tram -> xoa slot cua tram', 0, 'OUT', N'OK',
  N'DECLARE @s UNIQUEIDENTIFIER = (SELECT id FROM dbo.landing_stations WHERE station_code = ~STN-Q7~);
    IF @s IS NULL SET @out = N~Chua co seed tram STN-Q7~;
    ELSE BEGIN
        DELETE dbo.landing_stations WHERE id = @s;
        SET @out = CASE WHEN EXISTS (SELECT 1 FROM dbo.station_slots WHERE station_id = @s) THEN N~slot van con~ ELSE N~OK~ END;
    END'),
(N'CASCADE', N'Xoa tram dang la tram di cua chuyen bay bi chan', 2, 'ERR', N'FK_flight_schedules_origin',
  N'INSERT dbo.flight_schedules (flight_code, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, @d, @s1, @s2, SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));
    DELETE dbo.landing_stations WHERE id = @s1;'),
(N'CASCADE', N'Xoa drone dang co chuyen bay bi chan', 2, 'ERR', N'FK_flight_schedules_drones',
  N'INSERT dbo.flight_schedules (flight_code, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, @d, @s1, @s2, SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));
    DELETE dbo.drones WHERE id = @d;'),
(N'CASCADE', N'Xoa don hang -> flight_schedules.order_id = NULL  [de thieu FK]', 3, 'OUT', N'OK',
  N'INSERT dbo.flight_schedules (flight_code, order_id, drone_id, origin_station_id, destination_station_id, scheduled_departure, scheduled_arrival) VALUES (~FKTEST-F~, @o, @d, @s1, @s2, SYSDATETIME(), DATEADD(HOUR, 1, SYSDATETIME()));
    DELETE dbo.delivery_orders WHERE id = @o;
    SET @out = CASE WHEN (SELECT order_id FROM dbo.flight_schedules WHERE flight_code = ~FKTEST-F~) IS NULL
                    THEN N~OK~ ELSE N~order_id van tro toi don da xoa (thieu FK_flight_schedules_orders)~ END;'),
(N'CASCADE', N'Xoa kien hang da co bien ban ban giao bi chan  [de thieu FK]', 1, 'ERR', N'FK_package_handoffs_packages_package_id',
  N'INSERT dbo.package_handoffs (package_id, station_id, operator_id, handoff_type) VALUES (@p, (SELECT TOP 1 id FROM dbo.landing_stations), @u, ~STATION_RECEIVED~);
    DELETE dbo.packages WHERE id = @p;');

-- Doi ~ thanh dau nhay don '
UPDATE #tests SET sqltext = REPLACE(sqltext, N'~', N'''');
SET @setup1 = REPLACE(@setup1, N'~', N'''');
SET @setup2 = REPLACE(@setup2, N'~', N'''');

/* ---- Chay tung test trong transaction roi ROLLBACK ---- */
DECLARE @i INT = 1, @n INT = (SELECT COUNT(*) FROM #tests);
DECLARE @grp NVARCHAR(20), @name NVARCHAR(200), @setup TINYINT, @kind CHAR(3),
        @expect NVARCHAR(200), @sql NVARCHAR(MAX), @out NVARCHAR(400), @msg NVARCHAR(400);

WHILE @i <= @n
BEGIN
    SELECT @grp = grp, @name = name, @setup = setup, @kind = kind, @expect = expect, @sql = sqltext
    FROM #tests WHERE id = @i;

    SET @sql = CASE WHEN @setup IN (1, 3) THEN @setup1 ELSE N'' END
             + CASE WHEN @setup IN (2, 3) THEN @setup2 ELSE N'' END + @sql;
    SET @out = NULL;  SET @msg = NULL;

    BEGIN TRY
        BEGIN TRAN;
        EXEC sp_executesql @sql, N'@out NVARCHAR(400) OUTPUT', @out = @out OUTPUT;
        IF @@TRANCOUNT > 0 ROLLBACK;

        IF @kind = 'OUT'
            INSERT #results (grp, name, expected, actual, result)
            VALUES (@grp, @name, N'OK', ISNULL(@out, N'(khong co ket qua)'),
                    CASE WHEN @out = N'OK' THEN 'PASS' ELSE 'FAIL' END);
        ELSE
            INSERT #results (grp, name, expected, actual, result)
            VALUES (@grp, @name, N'Loi: ' + @expect,
                    N'KHONG co loi (rang buoc thieu hoac khong hoat dong)', 'FAIL');
    END TRY
    BEGIN CATCH
        SET @msg = LEFT(ERROR_MESSAGE(), 400);
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT #results (grp, name, expected, actual, result)
        VALUES (@grp, @name, CASE WHEN @kind = 'ERR' THEN N'Loi: ' + @expect ELSE N'OK' END, @msg,
                CASE WHEN @kind = 'ERR' AND CHARINDEX(@expect, @msg) > 0 THEN 'PASS' ELSE 'FAIL' END);
    END CATCH;

    SET @i += 1;
END;

SELECT id, grp, name, result, expected, actual FROM #results ORDER BY CASE result WHEN 'FAIL' THEN 0 ELSE 1 END, id;
SELECT result, COUNT(*) AS so_test FROM #results GROUP BY result;
GO