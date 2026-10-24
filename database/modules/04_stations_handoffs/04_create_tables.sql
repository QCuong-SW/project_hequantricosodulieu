-- MODULE 4: LANDING STATIONS & PACKAGE HANDOFFS

USE SmartDroneDeliveryDb;
GO

-- 1. BẢNG LANDING_STATIONS (Commit w1-05)
IF OBJECT_ID('dbo.landing_stations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.landing_stations (
        id              UNIQUEIDENTIFIER NOT NULL 
                        CONSTRAINT DF_landing_stations_id DEFAULT NEWID(),
        station_code    VARCHAR(30)      NOT NULL,
        name            NVARCHAR(100)    NOT NULL,
        address_line    NVARCHAR(255)    NOT NULL,
        latitude        DECIMAL(9,6)     NOT NULL,
        longitude       DECIMAL(9,6)     NOT NULL,
        altitude_meter  DECIMAL(6,2)     NOT NULL 
                        CONSTRAINT DF_landing_stations_altitude_meter DEFAULT 0.00,
        total_slots     INT              NOT NULL 
                        CONSTRAINT DF_landing_stations_total_slots DEFAULT 0,
        status          VARCHAR(30)      NOT NULL 
                        CONSTRAINT DF_landing_stations_status DEFAULT 'ACTIVE',
        is_deleted      BIT              NOT NULL 
                        CONSTRAINT DF_landing_stations_is_deleted DEFAULT 0,
        created_at      DATETIME2(7)     NOT NULL 
                        CONSTRAINT DF_landing_stations_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_landing_stations PRIMARY KEY (id),
        CONSTRAINT UQ_landing_stations_station_code UNIQUE (station_code),
        CONSTRAINT CK_landing_stations_latitude 
            CHECK (latitude >= -90.000000 AND latitude <= 90.000000),
        CONSTRAINT CK_landing_stations_longitude 
            CHECK (longitude >= -180.000000 AND longitude <= 180.000000),
        CONSTRAINT CK_landing_stations_altitude_meter 
            CHECK (altitude_meter >= 0.00),
        CONSTRAINT CK_landing_stations_total_slots 
            CHECK (total_slots >= 0),
        CONSTRAINT CK_landing_stations_status 
            CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'OFFLINE'))
    );

    CREATE NONCLUSTERED INDEX IX_landing_stations_status 
        ON dbo.landing_stations(status) 
        INCLUDE (station_code, name, latitude, longitude, total_slots)
        WHERE is_deleted = 0;
END
GO

-- 2. BẢNG STATION_SLOTS (Commit w1-06)
IF OBJECT_ID('dbo.station_slots', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.station_slots (
        id              UNIQUEIDENTIFIER NOT NULL 
                        CONSTRAINT DF_station_slots_id DEFAULT NEWID(),
        station_id      UNIQUEIDENTIFIER NOT NULL,
        slot_number     INT              NOT NULL,
        slot_type       VARCHAR(30)      NOT NULL,
        status          VARCHAR(30)      NOT NULL 
                        CONSTRAINT DF_station_slots_status DEFAULT 'AVAILABLE',
        updated_at      DATETIME2(7)     NOT NULL 
                        CONSTRAINT DF_station_slots_updated_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_station_slots PRIMARY KEY (id),
        CONSTRAINT UQ_station_slots_station_id_slot_number 
            UNIQUE (station_id, slot_number),
        CONSTRAINT FK_station_slots_landing_stations_station_id 
            FOREIGN KEY (station_id) 
            REFERENCES dbo.landing_stations(id) 
            ON DELETE CASCADE 
            ON UPDATE CASCADE,
        CONSTRAINT CK_station_slots_slot_number 
            CHECK (slot_number > 0),
        CONSTRAINT CK_station_slots_slot_type 
            CHECK (slot_type IN ('LANDING_PAD', 'CHARGING_DOCK', 'STORAGE_LOCKER')),
        CONSTRAINT CK_station_slots_status 
            CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'))
    );

    CREATE NONCLUSTERED INDEX IX_station_slots_station_id 
        ON dbo.station_slots(station_id, status);
END
GO

-- 3. BẢNG PACKAGE_HANDOFFS (Commit w1-07)
IF OBJECT_ID('dbo.package_handoffs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.package_handoffs (
        id                  UNIQUEIDENTIFIER NOT NULL 
                            CONSTRAINT DF_package_handoffs_id DEFAULT NEWID(),
        package_id          UNIQUEIDENTIFIER NOT NULL,
        station_id          UNIQUEIDENTIFIER NOT NULL,
        operator_id         UNIQUEIDENTIFIER NOT NULL,
        handoff_type        VARCHAR(50)      NOT NULL,
        verification_code   VARCHAR(100)     NULL,
        proof_photo_url     VARCHAR(500)     NULL,
        notes               NVARCHAR(500)    NULL,
        handoff_time        DATETIME2(7)     NOT NULL 
                            CONSTRAINT DF_package_handoffs_handoff_time DEFAULT SYSDATETIME(),

        CONSTRAINT PK_package_handoffs PRIMARY KEY (id),
        CONSTRAINT FK_package_handoffs_landing_stations_station_id 
            FOREIGN KEY (station_id) 
            REFERENCES dbo.landing_stations(id) 
            ON DELETE NO ACTION 
            ON UPDATE CASCADE,
        CONSTRAINT CK_package_handoffs_handoff_type 
            CHECK (handoff_type IN (
                'INBOUND_CUSTOMER_TO_STATION',
                'OUTBOUND_STATION_TO_DRONE',
                'INBOUND_DRONE_TO_STATION',
                'OUTBOUND_STATION_TO_CUSTOMER',
                'STATION_RECEIVED',
                'LOADED_ON_DRONE'
            ))
    );

    CREATE NONCLUSTERED INDEX IX_package_handoffs_package_id 
        ON dbo.package_handoffs(package_id, handoff_time DESC);

    CREATE NONCLUSTERED INDEX IX_package_handoffs_station_id 
        ON dbo.package_handoffs(station_id, handoff_time DESC);

    CREATE NONCLUSTERED INDEX IX_package_handoffs_operator_id 
        ON dbo.package_handoffs(operator_id);
END
GO

-- Khóa ngoại liên kết sang bảng users của Module 1
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL 
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_package_handoffs_users_operator_id')
BEGIN
    ALTER TABLE dbo.package_handoffs
    ADD CONSTRAINT FK_package_handoffs_users_operator_id 
        FOREIGN KEY (operator_id) 
        REFERENCES dbo.users(id) 
        ON DELETE NO ACTION 
        ON UPDATE CASCADE;
END
GO

-- Khóa ngoại liên kết sang bảng packages của Module 3
IF OBJECT_ID('dbo.packages', 'U') IS NOT NULL 
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_package_handoffs_packages_package_id')
BEGIN
    ALTER TABLE dbo.package_handoffs
    ADD CONSTRAINT FK_package_handoffs_packages_package_id 
        FOREIGN KEY (package_id) 
        REFERENCES dbo.packages(id) 
        ON DELETE NO ACTION 
        ON UPDATE CASCADE;
END
GO