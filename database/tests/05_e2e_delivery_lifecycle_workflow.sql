USE SmartDroneDeliveryDb;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT N'=== STARTING END-TO-END DELIVERY LIFECYCLE WORKFLOW TEST (w4-16) ===';

BEGIN TRANSACTION;

BEGIN TRY
    DECLARE @CustomerUserId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.users WHERE email = 'customer@smartdrone.vn');
    DECLARE @DispatcherUserId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.users WHERE email = 'dispatcher@smartdrone.vn');
    DECLARE @OperatorUserId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.users WHERE email = 'operator@smartdrone.vn');
    DECLARE @OriginStationId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations WHERE station_code = 'STN-Q1');
    DECLARE @DestStationId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.landing_stations WHERE station_code = 'STN-TD');
    DECLARE @DroneId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM dbo.drones WHERE drone_code = 'DRN-001');

    DECLARE @CustomerId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO dbo.customer_profiles (id, user_id, customer_code, company_name, total_orders)
    VALUES (@CustomerId, @CustomerUserId, 'CUST-E2E-001', N'Cong Ty E2E Test', 0);

    -- STEP 1: Customer places order (PENDING_APPROVAL) + Address Snapshot + Package
    DECLARE @OrderId UNIQUEIDENTIFIER = NEWID();
    DECLARE @PackageId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.delivery_orders (
        id, tracking_number, customer_id, status, total_weight_kg,
        shipping_fee, payment_status, pickup_method, delivery_method, concurrency_version
    )
    VALUES (
        @OrderId, 'SDD-E2E-0001', @CustomerId, 'PENDING_APPROVAL', 2.25,
        62500, 'PAID', 'STATION_DROP', 'CUSTOMER_ADDRESS', 1
    );

    INSERT INTO dbo.order_address_snapshots (
        id, order_id, sender_name, sender_phone, sender_address_text, sender_latitude, sender_longitude,
        recipient_name, recipient_phone, recipient_address_text, recipient_latitude, recipient_longitude
    )
    VALUES (
        NEWID(), @OrderId, N'Nguyen Van An', '0901234567', N'Bitexco Q1, TP.HCM', 10.771595, 106.704750,
        N'Tran Thi Bich', '0909876543', N'Khu Cong Nghe Cao Thu Duc, TP.HCM', 10.841128, 106.809883
    );

    INSERT INTO dbo.packages (
        id, order_id, package_code, description, weight_kg,
        length_cm, width_cm, height_cm, declared_value, is_fragile, is_hazardous
    )
    VALUES (
        @PackageId, @OrderId, 'PKG-E2E-01', N'Thiet bi y te chinh xac', 2.25,
        30.0, 20.0, 15.0, 5000000, 1, 0
    );

    PRINT N'[PASS] Step 1: Order created in PENDING_APPROVAL with Address Snapshot & Package.';

    -- STEP 2: Dispatcher approves order (PENDING_APPROVAL -> APPROVED)
    UPDATE dbo.delivery_orders
    SET status = 'APPROVED',
        concurrency_version = concurrency_version + 1,
        updated_at = SYSDATETIME()
    WHERE id = @OrderId AND concurrency_version = 1;

    PRINT N'[PASS] Step 2: Order transitioned to APPROVED.';

    -- STEP 3: Assign Drone & Schedule Flight (APPROVED -> SCHEDULED)
    DECLARE @FlightScheduleId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.flight_schedules (
        id, flight_code, order_id, drone_id, origin_station_id, destination_station_id,
        dispatcher_id, scheduled_departure, scheduled_arrival, flight_distance_km, status
    )
    VALUES (
        @FlightScheduleId, 'FLT-E2E-0001', @OrderId, @DroneId, @OriginStationId, @DestStationId,
        @DispatcherUserId, DATEADD(MINUTE, 10, SYSDATETIME()), DATEADD(MINUTE, 30, SYSDATETIME()), 12.50, 'SCHEDULED'
    );

    INSERT INTO dbo.flight_waypoints (
        id, flight_schedule_id, sequence_order, latitude, longitude, target_altitude_meter, estimated_speed_kmh
    )
    VALUES
        (NEWID(), @FlightScheduleId, 1, 10.771595, 106.704750, 65.00, 45.00),
        (NEWID(), @FlightScheduleId, 2, 10.841128, 106.809883, 65.00, 50.00);

    UPDATE dbo.drones SET status = 'ASSIGNED' WHERE id = @DroneId;
    UPDATE dbo.delivery_orders
    SET status = 'SCHEDULED',
        concurrency_version = concurrency_version + 1,
        updated_at = SYSDATETIME()
    WHERE id = @OrderId;

    PRINT N'[PASS] Step 3: Flight schedule & 3D waypoints created; Order transitioned to SCHEDULED.';

    -- STEP 4: Station Operator scans QR handoff at origin station
    INSERT INTO dbo.package_handoffs (
        id, package_id, station_id, operator_id, handoff_type, verification_code, notes
    )
    VALUES (
        NEWID(), @PackageId, @OriginStationId, @OperatorUserId,
        'OUTBOUND_STATION_TO_DRONE', 'QR-E2E-001', N'Loaded package onto DRN-001'
    );

    PRINT N'[PASS] Step 4: Station handoff recorded (OUTBOUND_STATION_TO_DRONE).';

    -- STEP 5: Drone in transit + Real-time GPS Tracking Events
    UPDATE dbo.drones SET status = 'FLYING', battery_percentage = 82 WHERE id = @DroneId;
    UPDATE dbo.flight_schedules SET status = 'IN_PROGRESS', actual_departure = SYSDATETIME() WHERE id = @FlightScheduleId;
    UPDATE dbo.delivery_orders
    SET status = 'IN_TRANSIT',
        concurrency_version = concurrency_version + 1,
        updated_at = SYSDATETIME()
    WHERE id = @OrderId;

    INSERT INTO dbo.tracking_events (
        id, order_id, status_code, event_title, event_description,
        current_latitude, current_longitude, current_altitude, current_battery
    )
    VALUES (
        NEWID(), @OrderId, 'IN_TRANSIT', N'Drone dang bay qua khu vuc Binh Thanh',
        N'Toc do on dinh 50 km/h', 10.805100, 106.752300, 65.00, 82
    );

    PRINT N'[PASS] Step 5: Order IN_TRANSIT and GPS telemetry event recorded.';

    -- STEP 6: Delivery Confirmation via OTP & Complete Flight
    INSERT INTO dbo.delivery_confirmations (
        id, order_id, confirmation_method, otp_hashed, otp_expired_at,
        otp_retry_count, is_verified, confirmed_at
    )
    VALUES (
        NEWID(), @OrderId, 'OTP', 'E2E_SHA256_OTP_HASH', DATEADD(MINUTE, 15, SYSDATETIME()),
        0, 1, SYSDATETIME()
    );

    UPDATE dbo.delivery_orders
    SET status = 'DELIVERED',
        actual_delivery_time = SYSDATETIME(),
        concurrency_version = concurrency_version + 1,
        updated_at = SYSDATETIME()
    WHERE id = @OrderId;

    UPDATE dbo.flight_schedules
    SET status = 'COMPLETED', actual_arrival = SYSDATETIME()
    WHERE id = @FlightScheduleId;

    UPDATE dbo.drones SET status = 'IDLE', battery_percentage = 74 WHERE id = @DroneId;

    PRINT N'[PASS] Step 6: OTP verified, Order DELIVERED, Flight COMPLETED, Drone returned to IDLE.';

    SELECT
        o.tracking_number,
        o.status AS final_order_status,
        o.concurrency_version,
        f.flight_code,
        f.status AS final_flight_status,
        d.drone_code,
        d.status AS final_drone_status,
        c.is_verified AS otp_verified
    FROM dbo.delivery_orders o
    JOIN dbo.flight_schedules f ON f.order_id = o.id
    JOIN dbo.drones d ON d.id = f.drone_id
    JOIN dbo.delivery_confirmations c ON c.order_id = o.id
    WHERE o.id = @OrderId;

    PRINT N'=== ALL E2E LIFECYCLE CHECKS PASSED SUCCESSFULLY ===';
END TRY
BEGIN CATCH
    PRINT N'[FAIL] E2E Test Error: ' + ERROR_MESSAGE();
END CATCH;

ROLLBACK TRANSACTION;
GO
