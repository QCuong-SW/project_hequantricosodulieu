-- ==============================================================================
-- MODULE 2: CUSTOMERS, DELIVERY ADDRESSES & ORDERS CORE
-- Thành viên phụ trách: Lê Thanh Nhị (M2) 
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- w1-08: Create customer_profiles
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

-- w1-09: Create delivery_addresses
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

-- w1-10: Add index for customer addresses
CREATE INDEX IX_delivery_addresses_customer_id
ON dbo.delivery_addresses(customer_id);
GO
