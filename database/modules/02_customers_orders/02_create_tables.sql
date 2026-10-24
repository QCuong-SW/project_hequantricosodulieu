-- ==============================================================================
-- MODULE 2: CUSTOMERS, DELIVERY ADDRESSES & ORDERS CORE
-- Thành viên phụ trách: Lê Thanh Nhị (M2) & Cường Quang (M3)
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- ------------------------------------------------------------------------------
-- PHẦN 1: KHÁCH HÀNG & SỔ ĐỊA CHỈ - Phụ trách: Lê Thanh Nhị (M2)
-- Nhánh Git: feat/w1-m2-customers | Commit tuần tự: w1-08 -> w1-10
-- ------------------------------------------------------------------------------

-- TODO (Lê Thanh Nhị - M2): Viết lệnh CREATE TABLE dbo.customer_profiles
-- Gợi ý: FK trỏ sang dbo.users(id), UQ_customer_code, contact_phone, default_address_id


-- TODO (Lê Thanh Nhị - M2): Viết lệnh CREATE TABLE dbo.delivery_addresses
-- Gợi ý: FK trỏ sang dbo.customer_profiles(id), ràng buộc CHECK latitude (-90 đến 90), longitude (-180 đến 180)


-- TODO (Lê Thanh Nhị - M2): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_delivery_addresses_customer ON dbo.delivery_addresses(customer_id);


-- ------------------------------------------------------------------------------
-- PHẦN 2: ĐƠN HÀNG, SNAPSHOT & KIỆN HÀNG - Phụ trách: Cường Quang (M3)
-- Nhánh Git: feat/w1-m3-delivery-orders-and-drones | Commit: w1-11
-- ------------------------------------------------------------------------------

-- 1. Bảng delivery_orders
IF OBJECT_ID(N'dbo.delivery_orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.delivery_orders (
        id                      UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_delivery_orders_id DEFAULT NEWID(),
        tracking_number         VARCHAR(30)         NOT NULL,
        customer_id             UNIQUEIDENTIFIER    NOT NULL,
        status                  VARCHAR(30)         NOT NULL CONSTRAINT DF_delivery_orders_status DEFAULT 'DRAFT',
        total_weight_kg         DECIMAL(6,2)        NOT NULL CONSTRAINT DF_delivery_orders_weight DEFAULT 0.00,
        shipping_fee            DECIMAL(18,2)       NOT NULL CONSTRAINT DF_delivery_orders_fee DEFAULT 0.00,
        payment_status          VARCHAR(20)         NOT NULL CONSTRAINT DF_delivery_orders_payment DEFAULT 'PENDING',
        pickup_method           VARCHAR(30)         NOT NULL CONSTRAINT DF_delivery_orders_pickup DEFAULT 'STATION_DROP',
        delivery_method         VARCHAR(30)         NOT NULL CONSTRAINT DF_delivery_orders_delivery DEFAULT 'STATION_PICKUP',
        requested_delivery_time DATETIME2(7)        NULL,
        estimated_delivery_time DATETIME2(7)        NULL,
        actual_delivery_time    DATETIME2(7)        NULL,
        cancellation_reason     NVARCHAR(500)       NULL,
        concurrency_version     INT                 NOT NULL CONSTRAINT DF_delivery_orders_version DEFAULT 1,
        created_at              DATETIME2(7)        NOT NULL CONSTRAINT DF_delivery_orders_created_at DEFAULT SYSDATETIME(),
        updated_at              DATETIME2(7)        NOT NULL CONSTRAINT DF_delivery_orders_updated_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_delivery_orders PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_delivery_orders_tracking UNIQUE (tracking_number),
        CONSTRAINT CK_delivery_orders_status CHECK (
            status IN (
                'DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'APPROVED',
                'SCHEDULED', 'IN_TRANSIT', 'DELIVERING', 'ARRIVED',
                'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'
            )
        ),
        CONSTRAINT CK_delivery_orders_payment CHECK (payment_status IN ('PENDING', 'PAID', 'REFUNDED')),
        CONSTRAINT CK_delivery_orders_pickup CHECK (pickup_method IN ('STATION_DROP', 'SENDER_ADDRESS')),
        CONSTRAINT CK_delivery_orders_delivery CHECK (delivery_method IN ('STATION_PICKUP', 'CUSTOMER_ADDRESS')),
        CONSTRAINT CK_delivery_orders_weight CHECK (total_weight_kg >= 0.00),
        CONSTRAINT CK_delivery_orders_fee CHECK (shipping_fee >= 0.00)
    );
END;
GO

IF OBJECT_ID(N'dbo.customer_profiles', N'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys 
       WHERE name = N'FK_delivery_orders_customers' 
         AND parent_object_id = OBJECT_ID(N'dbo.delivery_orders')
   )
BEGIN
    ALTER TABLE dbo.delivery_orders
    ADD CONSTRAINT FK_delivery_orders_customers
        FOREIGN KEY (customer_id) REFERENCES dbo.customer_profiles(id)
        ON DELETE NO ACTION
        ON UPDATE CASCADE;
END;
GO

-- 2. Bảng order_address_snapshots
IF OBJECT_ID(N'dbo.order_address_snapshots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.order_address_snapshots (
        id                      UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_snapshots_id DEFAULT NEWID(),
        order_id                UNIQUEIDENTIFIER    NOT NULL,
        sender_name             NVARCHAR(100)       NOT NULL,
        sender_phone            VARCHAR(20)         NOT NULL,
        sender_address_text     NVARCHAR(300)       NOT NULL,
        sender_latitude         DECIMAL(9,6)        NOT NULL,
        sender_longitude        DECIMAL(9,6)        NOT NULL,
        recipient_name          NVARCHAR(100)       NOT NULL,
        recipient_phone         VARCHAR(20)         NOT NULL,
        recipient_address_text  NVARCHAR(300)       NOT NULL,
        recipient_latitude      DECIMAL(9,6)        NOT NULL,
        recipient_longitude     DECIMAL(9,6)        NOT NULL,
        created_at              DATETIME2(7)        NOT NULL CONSTRAINT DF_snapshots_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_order_address_snapshots PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_order_address_snapshots_order UNIQUE (order_id),
        CONSTRAINT FK_order_address_snapshots_orders FOREIGN KEY (order_id)
            REFERENCES dbo.delivery_orders(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
        CONSTRAINT CK_snapshots_sender_lat CHECK (sender_latitude BETWEEN -90.000000 AND 90.000000),
        CONSTRAINT CK_snapshots_sender_lng CHECK (sender_longitude BETWEEN -180.000000 AND 180.000000),
        CONSTRAINT CK_snapshots_recipient_lat CHECK (recipient_latitude BETWEEN -90.000000 AND 90.000000),
        CONSTRAINT CK_snapshots_recipient_lng CHECK (recipient_longitude BETWEEN -180.000000 AND 180.000000)
    );
END;
GO

-- 3. Bảng packages
IF OBJECT_ID(N'dbo.packages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.packages (
        id                  UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_packages_id DEFAULT NEWID(),
        order_id            UNIQUEIDENTIFIER    NOT NULL,
        package_code        VARCHAR(30)         NOT NULL,
        description         NVARCHAR(255)       NOT NULL,
        weight_kg           DECIMAL(5,2)        NOT NULL,
        length_cm           DECIMAL(5,2)        NOT NULL,
        width_cm            DECIMAL(5,2)        NOT NULL,
        height_cm           DECIMAL(5,2)        NOT NULL,
        declared_value      DECIMAL(18,2)       NOT NULL CONSTRAINT DF_packages_declared_value DEFAULT 0.00,
        is_fragile          BIT                 NOT NULL CONSTRAINT DF_packages_is_fragile DEFAULT 0,
        is_hazardous        BIT                 NOT NULL CONSTRAINT DF_packages_is_hazardous DEFAULT 0,
        package_photo_url   VARCHAR(500)        NULL,
        created_at          DATETIME2(7)        NOT NULL CONSTRAINT DF_packages_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_packages PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_packages_code UNIQUE (package_code),
        CONSTRAINT FK_packages_orders FOREIGN KEY (order_id)
            REFERENCES dbo.delivery_orders(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
        CONSTRAINT CK_packages_weight CHECK (weight_kg BETWEEN 0.01 AND 5.00),
        CONSTRAINT CK_packages_dimensions CHECK (length_cm > 0.00 AND width_cm > 0.00 AND height_cm > 0.00),
        CONSTRAINT CK_packages_declared_value CHECK (declared_value >= 0.00)
    );
END;
GO

-- 4. Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_delivery_orders_customer' AND object_id = OBJECT_ID(N'dbo.delivery_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_delivery_orders_customer
        ON dbo.delivery_orders(customer_id, created_at DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_delivery_orders_tracking' AND object_id = OBJECT_ID(N'dbo.delivery_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_delivery_orders_tracking
        ON dbo.delivery_orders(tracking_number);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_delivery_orders_status' AND object_id = OBJECT_ID(N'dbo.delivery_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_delivery_orders_status
        ON dbo.delivery_orders(status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_packages_order_id' AND object_id = OBJECT_ID(N'dbo.packages'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_packages_order_id
        ON dbo.packages(order_id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_packages_package_code' AND object_id = OBJECT_ID(N'dbo.packages'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_packages_package_code
        ON dbo.packages(package_code);
END;
GO
