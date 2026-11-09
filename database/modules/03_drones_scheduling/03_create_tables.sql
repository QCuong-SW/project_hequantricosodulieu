USE SmartDroneDeliveryDb;
GO

-- 1. Bảng drones
IF OBJECT_ID(N'dbo.drones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.drones (
        id                  UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_drones_id DEFAULT NEWID(),
        drone_code          VARCHAR(20)         NOT NULL,
        model               NVARCHAR(50)        NOT NULL,
        max_payload_kg      DECIMAL(5,2)        NOT NULL CONSTRAINT DF_drones_max_payload DEFAULT 5.00,
        max_flight_range_km DECIMAL(6,2)        NOT NULL CONSTRAINT DF_drones_max_range DEFAULT 20.00,
        max_speed_kmh       DECIMAL(5,2)        NOT NULL CONSTRAINT DF_drones_max_speed DEFAULT 60.00,
        battery_percentage  INT                 NOT NULL CONSTRAINT DF_drones_battery DEFAULT 100,
        status              VARCHAR(20)         NOT NULL CONSTRAINT DF_drones_status DEFAULT 'IDLE',
        is_deleted          BIT                 NOT NULL CONSTRAINT DF_drones_is_deleted DEFAULT 0,
        created_at          DATETIME2(7)        NOT NULL CONSTRAINT DF_drones_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_drones PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_drones_drone_code UNIQUE (drone_code),
        CONSTRAINT CK_drones_battery CHECK (battery_percentage BETWEEN 0 AND 100),
        CONSTRAINT CK_drones_status CHECK (status IN ('IDLE', 'ASSIGNED', 'FLYING', 'CHARGING', 'MAINTENANCE')),
        CONSTRAINT CK_drones_specs CHECK (max_payload_kg > 0 AND max_flight_range_km > 0 AND max_speed_kmh > 0)
    );
END;
GO

-- 2. Bảng flight_schedules
IF OBJECT_ID(N'dbo.flight_schedules', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.flight_schedules (
        id                      UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_flight_schedules_id DEFAULT NEWID(),
        flight_code             VARCHAR(30)         NOT NULL,
        order_id                UNIQUEIDENTIFIER    NULL,
        drone_id                UNIQUEIDENTIFIER    NOT NULL,
        origin_station_id       UNIQUEIDENTIFIER    NOT NULL,
        destination_station_id  UNIQUEIDENTIFIER    NOT NULL,
        dispatcher_id           UNIQUEIDENTIFIER    NULL,
        scheduled_departure     DATETIME2(7)        NOT NULL,
        actual_departure        DATETIME2(7)        NULL,
        scheduled_arrival       DATETIME2(7)        NOT NULL,
        actual_arrival          DATETIME2(7)        NULL,
        flight_distance_km      DECIMAL(6,2)        NOT NULL CONSTRAINT DF_flight_schedules_dist DEFAULT 0.00,
        status                  VARCHAR(20)         NOT NULL CONSTRAINT DF_flight_schedules_status DEFAULT 'SCHEDULED',
        abort_reason            NVARCHAR(500)       NULL,
        created_at              DATETIME2(7)        NOT NULL CONSTRAINT DF_flight_schedules_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_flight_schedules PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_flight_schedules_code UNIQUE (flight_code),
        CONSTRAINT CK_flight_schedules_status CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED', 'REROUTED')),
        CONSTRAINT CK_flight_schedules_distance CHECK (flight_distance_km >= 0.00),
        CONSTRAINT CK_flight_schedules_stations CHECK (origin_station_id <> destination_station_id),
        CONSTRAINT FK_flight_schedules_drones FOREIGN KEY (drone_id) REFERENCES dbo.drones(id) ON DELETE NO ACTION ON UPDATE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.delivery_orders', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_flight_schedules_orders' AND parent_object_id = OBJECT_ID(N'dbo.flight_schedules'))
BEGIN
    ALTER TABLE dbo.flight_schedules
    ADD CONSTRAINT FK_flight_schedules_orders
        FOREIGN KEY (order_id) REFERENCES dbo.delivery_orders(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
END;
GO

IF OBJECT_ID(N'dbo.landing_stations', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_flight_schedules_origin' AND parent_object_id = OBJECT_ID(N'dbo.flight_schedules'))
    BEGIN
        ALTER TABLE dbo.flight_schedules
        ADD CONSTRAINT FK_flight_schedules_origin
            FOREIGN KEY (origin_station_id) REFERENCES dbo.landing_stations(id)
            ON DELETE NO ACTION;
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_flight_schedules_dest' AND parent_object_id = OBJECT_ID(N'dbo.flight_schedules'))
    BEGIN
        ALTER TABLE dbo.flight_schedules
        ADD CONSTRAINT FK_flight_schedules_dest
            FOREIGN KEY (destination_station_id) REFERENCES dbo.landing_stations(id)
            ON DELETE NO ACTION;
    END;
END;
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_flight_schedules_dispatcher' AND parent_object_id = OBJECT_ID(N'dbo.flight_schedules'))
BEGIN
    ALTER TABLE dbo.flight_schedules
    ADD CONSTRAINT FK_flight_schedules_dispatcher
        FOREIGN KEY (dispatcher_id) REFERENCES dbo.users(id)
        ON DELETE SET NULL;
END;
GO

-- 3. Bảng flight_waypoints
IF OBJECT_ID(N'dbo.flight_waypoints', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.flight_waypoints (
        id                      UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_flight_waypoints_id DEFAULT NEWID(),
        flight_schedule_id      UNIQUEIDENTIFIER    NOT NULL,
        sequence_order          INT                 NOT NULL,
        latitude                DECIMAL(9,6)        NOT NULL,
        longitude               DECIMAL(9,6)        NOT NULL,
        target_altitude_meter   DECIMAL(6,2)        NOT NULL,
        estimated_speed_kmh     DECIMAL(5,2)        NOT NULL,

        CONSTRAINT PK_flight_waypoints PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_flight_waypoints_sequence UNIQUE (flight_schedule_id, sequence_order),
        CONSTRAINT FK_flight_waypoints_schedules FOREIGN KEY (flight_schedule_id) REFERENCES dbo.flight_schedules(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT CK_flight_waypoints_lat CHECK (latitude BETWEEN -90.000000 AND 90.000000),
        CONSTRAINT CK_flight_waypoints_lng CHECK (longitude BETWEEN -180.000000 AND 180.000000),
        CONSTRAINT CK_flight_waypoints_altitude CHECK (target_altitude_meter >= 0.00),
        CONSTRAINT CK_flight_waypoints_speed CHECK (estimated_speed_kmh >= 0.00)
    );
END;
GO

-- 4. Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_drones_status' AND object_id = OBJECT_ID(N'dbo.drones'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_drones_status
        ON dbo.drones(status)
        WHERE is_deleted = 0;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_flight_schedules_drone' AND object_id = OBJECT_ID(N'dbo.flight_schedules'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_flight_schedules_drone
        ON dbo.flight_schedules(drone_id, status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_flight_schedules_order' AND object_id = OBJECT_ID(N'dbo.flight_schedules'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_flight_schedules_order
        ON dbo.flight_schedules(order_id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_flight_waypoints_schedule' AND object_id = OBJECT_ID(N'dbo.flight_waypoints'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_flight_waypoints_schedule
        ON dbo.flight_waypoints(flight_schedule_id, sequence_order);
END;
GO
