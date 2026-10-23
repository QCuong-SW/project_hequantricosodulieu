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