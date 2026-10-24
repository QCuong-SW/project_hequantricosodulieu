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
CREATE TABLE dbo.customer_profiles (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_customer_profiles
        PRIMARY KEY DEFAULT NEWID(),

    user_id UNIQUEIDENTIFIER NOT NULL,

    customer_code VARCHAR(50) NOT NULL,

    company_name NVARCHAR(150) NULL,

    total_orders INT NOT NULL
        CONSTRAINT DF_customer_profiles_total_orders
        DEFAULT 0,

    is_deleted BIT NOT NULL
        CONSTRAINT DF_customer_profiles_is_deleted
        DEFAULT 0,

    created_at DATETIME2(7) NOT NULL
        CONSTRAINT DF_customer_profiles_created_at
        DEFAULT SYSDATETIME(),

    updated_at DATETIME2(7) NULL,

    CONSTRAINT UQ_customer_profiles_user_id
        UNIQUE (user_id),

    CONSTRAINT UQ_customer_profiles_customer_code
        UNIQUE (customer_code)
);
GO

    
-- TODO (Lê Thanh Nhị - M2): Viết lệnh CREATE TABLE dbo.delivery_addresses
-- Gợi ý: FK trỏ sang dbo.customer_profiles(id), ràng buộc CHECK latitude (-90 đến 90), longitude 
CREATE TABLE dbo.delivery_addresses (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_delivery_addresses
        PRIMARY KEY DEFAULT NEWID(),

    customer_id UNIQUEIDENTIFIER NOT NULL,

    address_line NVARCHAR(255) NOT NULL,
    ward NVARCHAR(100) NULL,
    district NVARCHAR(100) NULL,
    city NVARCHAR(100) NOT NULL,

    latitude DECIMAL(9,6) NULL,
    longitude DECIMAL(9,6) NULL,

    is_default BIT NOT NULL
        CONSTRAINT DF_delivery_addresses_is_default
        DEFAULT 0,

    is_deleted BIT NOT NULL
        CONSTRAINT DF_delivery_addresses_is_deleted
        DEFAULT 0,

    created_at DATETIME2(7) NOT NULL
        CONSTRAINT DF_delivery_addresses_created_at
        DEFAULT SYSDATETIME(),

    CONSTRAINT CK_delivery_addresses_latitude
        CHECK (
            latitude IS NULL
            OR latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT CK_delivery_addresses_longitude
        CHECK (
            longitude IS NULL
            OR longitude BETWEEN -180 AND 180
        ),

    CONSTRAINT FK_delivery_addresses_customer_profiles_customer_id
        FOREIGN KEY (customer_id)
        REFERENCES dbo.customer_profiles(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
GO

-- TODO (Lê Thanh Nhị - M2): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_delivery_addresses_customer ON dbo.delivery_addresses(customer_id)
CREATE INDEX IX_delivery_addresses_customer_id
ON dbo.delivery_addresses(customer_id);
GO

-- ------------------------------------------------------------------------------
-- PHẦN 2: ĐƠN HÀNG, SNAPSHOT & KIỆN HÀNG - Phụ trách: Cường Quang (M3)
-- Nhánh Git: feat/w1-m3-orders | Commit tuần tự: w1-11 -> w1-12
-- ------------------------------------------------------------------------------

-- TODO (Cường Quang - M3): Viết lệnh CREATE TABLE dbo.delivery_orders
-- Gợi ý: tracking_number UNIQUE, FK customer_id, sender_address_id, recipient_address_id, CK_orders_status


-- TODO (Cường Quang - M3): Viết lệnh CREATE TABLE dbo.order_address_snapshots
-- Gợi ý: Lưu bản sao bất biến địa chỉ lúc tạo đơn, FK trỏ sang delivery_orders(id) ON DELETE CASCADE


-- TODO (Cường Quang - M3): Viết lệnh CREATE TABLE dbo.packages
-- Gợi ý: package_code UNIQUE, weight_kg <= 5.0, kích thước dài/rộng/cao, FK order_id


-- TODO (Cường Quang - M3): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_delivery_orders_customer ON dbo.delivery_orders(customer_id, created_at DESC);
-- CREATE NONCLUSTERED INDEX IX_delivery_orders_tracking ON dbo.delivery_orders(tracking_number);
GO


