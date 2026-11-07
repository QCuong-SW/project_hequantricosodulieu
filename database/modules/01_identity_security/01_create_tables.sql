-- ==============================================================================
-- MODULE 1: IDENTITY, AUTHENTICATION & RBAC
-- Thành viên phụ trách: Vũ Trí Thành (M1)
-- Nhánh Git: feat/w1-m1-identity | Commit tuần tự: w1-02 -> w1-04
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- ==============================================================================
-- [w1-02] feat(db): create users and roles tables with unique constraints
-- ==============================================================================

-- 1. Bảng roles (Danh mục vai trò)
IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.roles (
        id          INT IDENTITY(1,1) NOT NULL,
        role_name   VARCHAR(50)       NOT NULL,
        description NVARCHAR(255)     NULL,
        created_at  DATETIME2(7)      NOT NULL CONSTRAINT DF_roles_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_roles PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_roles_role_name UNIQUE (role_name)
    );
END;
GO

-- 2. Bảng users (Tài khoản người dùng trung tâm)
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_users_id DEFAULT NEWID(),
        email         VARCHAR(256)     NOT NULL,
        password_hash VARCHAR(500)     NOT NULL,
        full_name     NVARCHAR(100)    NOT NULL,
        phone_number  VARCHAR(20)      NOT NULL,
        status        VARCHAR(20)      NOT NULL CONSTRAINT DF_users_status DEFAULT 'ACTIVE',
        created_at    DATETIME2(7)     NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSDATETIME(),
        updated_at    DATETIME2(7)     NOT NULL CONSTRAINT DF_users_updated_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_users PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_users_email UNIQUE (email),
        CONSTRAINT UQ_users_phone_number UNIQUE (phone_number),
        CONSTRAINT CK_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
        CONSTRAINT CK_users_email CHECK (email LIKE '%_@_%._%')
    );
END;
GO

-- ==============================================================================
-- [w1-03] feat(db): add user_roles mapping and refresh_tokens table
-- ==============================================================================

-- 3. Bảng user_roles (Bảng nối M:N phân quyền tài khoản - vai trò)
IF OBJECT_ID(N'dbo.user_roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_roles (
        user_id     UNIQUEIDENTIFIER NOT NULL,
        role_id     INT              NOT NULL,
        assigned_at DATETIME2(7)     NOT NULL CONSTRAINT DF_user_roles_assigned_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_user_roles PRIMARY KEY CLUSTERED (user_id, role_id),
        CONSTRAINT FK_user_roles_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT FK_user_roles_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_roles_role_id' AND object_id = OBJECT_ID(N'dbo.user_roles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_user_roles_role_id ON dbo.user_roles (role_id);
END;
GO

-- 4. Bảng refresh_tokens (Quản lý phiên đăng nhập JWT)
IF OBJECT_ID(N'dbo.refresh_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.refresh_tokens (
        id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_refresh_tokens_id DEFAULT NEWID(),
        user_id    UNIQUEIDENTIFIER NOT NULL,
        token      VARCHAR(500)     NOT NULL,
        expires_at DATETIME2(7)     NOT NULL,
        is_revoked BIT              NOT NULL CONSTRAINT DF_refresh_tokens_is_revoked DEFAULT 0,
        created_at DATETIME2(7)     NOT NULL CONSTRAINT DF_refresh_tokens_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_refresh_tokens PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_refresh_tokens_token UNIQUE (token),
        CONSTRAINT FK_refresh_tokens_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT CK_refresh_tokens_expiry CHECK (expires_at > created_at)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_refresh_tokens_user_id' AND object_id = OBJECT_ID(N'dbo.refresh_tokens'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_refresh_tokens_user_id ON dbo.refresh_tokens (user_id) INCLUDE (expires_at, is_revoked);
END;
GO

-- ==============================================================================
-- [w1-04] feat(db): add audit_logs table and index for user email
-- ==============================================================================

-- 5. Bảng audit_logs (Nhật ký kiểm toán hệ thống)
IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_logs (
        id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_audit_logs_id DEFAULT NEWID(),
        user_id     UNIQUEIDENTIFIER NULL,
        action      VARCHAR(50)      NOT NULL,
        entity_name VARCHAR(50)      NOT NULL,
        entity_id   VARCHAR(50)      NOT NULL,
        old_values  NVARCHAR(MAX)    NULL,
        new_values  NVARCHAR(MAX)    NULL,
        ip_address  VARCHAR(45)      NULL,
        created_at  DATETIME2(7)     NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_audit_logs PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_audit_logs_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
END;
GO

-- Chỉ mục hiệu năng
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_email' AND object_id = OBJECT_ID(N'dbo.users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_users_email ON dbo.users (email);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_logs_created_at' AND object_id = OBJECT_ID(N'dbo.audit_logs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_audit_logs_created_at ON dbo.audit_logs (created_at DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_logs_entity' AND object_id = OBJECT_ID(N'dbo.audit_logs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_audit_logs_entity ON dbo.audit_logs (entity_name, entity_id);
END;
GO

-- 6. Khởi tạo 5 vai trò hệ thống mặc định (nếu chưa có)
INSERT INTO dbo.roles (role_name, description)
SELECT s.role_name, s.description
FROM (VALUES
    ('ADMIN',             N'Quản trị viên toàn quyền hệ thống'),
    ('DISPATCHER',        N'Điều phối viên duyệt đơn và gán lịch bay'),
    ('STATION_OPERATOR',  N'Nhân viên vận hành trạm tiếp đất và quét mã bàn giao'),
    ('LOGISTICS_MANAGER', N'Quản lý logistics xem báo cáo và dashboard KPI'),
    ('CUSTOMER',          N'Khách hàng tạo đơn và theo dõi hành trình')
) AS s (role_name, description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.roles r WHERE r.role_name = s.role_name);
GO
