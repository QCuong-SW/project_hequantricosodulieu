-- ==============================================================================
-- MODULE 1: IDENTITY, AUTHENTICATION & RBAC
-- Thành viên phụ trách: Vũ Trí Thành (M1)
-- Nhánh Git: feat/w1-m1-identity | Commit tuần tự: w1-02 -> w1-04
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- Lưu ý: mỗi lệnh là một câu lệnh đơn, không dùng dấu chấm phẩy bên trong khối
--        để tương thích với trình chạy SQL của VS Code (Database Client).
-- ==============================================================================

USE SmartDroneDeliveryDb
GO

-- ==============================================================================
-- [w1-02] feat(db): create users and roles tables with unique constraints
-- ==============================================================================

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
    user_id       INT IDENTITY(1,1) NOT NULL,
    email         NVARCHAR(256) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    full_name     NVARCHAR(100) NOT NULL,
    phone         NVARCHAR(20)  NULL,
    status        NVARCHAR(20)  NOT NULL CONSTRAINT DF_users_status     DEFAULT 'Active',
    created_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2(3)  NULL,
    CONSTRAINT PK_users        PRIMARY KEY (user_id),
    CONSTRAINT UQ_users_email  UNIQUE (email),
    CONSTRAINT CK_users_status CHECK (status IN ('Active', 'Inactive', 'Locked')),
    CONSTRAINT CK_users_email  CHECK (email LIKE '%_@_%._%')
)
GO

IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
CREATE TABLE dbo.roles (
    role_id     INT IDENTITY(1,1) NOT NULL,
    role_name   NVARCHAR(50)  NOT NULL,
    description NVARCHAR(200) NULL,
    CONSTRAINT PK_roles           PRIMARY KEY (role_id),
    CONSTRAINT UQ_roles_role_name UNIQUE (role_name)
)
GO

-- ==============================================================================
-- [w1-03] feat(db): add user_roles mapping and refresh_tokens table
-- ==============================================================================

IF OBJECT_ID(N'dbo.user_roles', N'U') IS NULL
CREATE TABLE dbo.user_roles (
    user_id     INT          NOT NULL,
    role_id     INT          NOT NULL,
    assigned_at DATETIME2(3) NOT NULL CONSTRAINT DF_user_roles_assigned_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_user_roles       PRIMARY KEY (user_id, role_id),
    CONSTRAINT FK_user_roles_users FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_user_roles_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_roles_role_id' AND object_id = OBJECT_ID(N'dbo.user_roles'))
CREATE NONCLUSTERED INDEX IX_user_roles_role_id ON dbo.user_roles (role_id)
GO

-- Chỉ lưu HASH của refresh token, không lưu token gốc
IF OBJECT_ID(N'dbo.refresh_tokens', N'U') IS NULL
CREATE TABLE dbo.refresh_tokens (
    refresh_token_id       INT IDENTITY(1,1) NOT NULL,
    user_id                INT           NOT NULL,
    token_hash             NVARCHAR(128) NOT NULL,
    expires_at             DATETIME2(3)  NOT NULL,
    created_at             DATETIME2(3)  NOT NULL CONSTRAINT DF_refresh_tokens_created_at DEFAULT SYSUTCDATETIME(),
    created_by_ip          NVARCHAR(45)  NULL,
    revoked_at             DATETIME2(3)  NULL,
    replaced_by_token_hash NVARCHAR(128) NULL,
    CONSTRAINT PK_refresh_tokens            PRIMARY KEY (refresh_token_id),
    CONSTRAINT UQ_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT FK_refresh_tokens_users      FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_refresh_tokens_expiry     CHECK (expires_at > created_at)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_refresh_tokens_user_id' AND object_id = OBJECT_ID(N'dbo.refresh_tokens'))
CREATE NONCLUSTERED INDEX IX_refresh_tokens_user_id ON dbo.refresh_tokens (user_id) INCLUDE (expires_at, revoked_at)
GO

-- ==============================================================================
-- [w1-04] feat(db): add audit_logs table and index for user email
-- ==============================================================================

IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NULL
CREATE TABLE dbo.audit_logs (
    audit_log_id BIGINT IDENTITY(1,1) NOT NULL,
    user_id      INT           NULL,
    user_email   NVARCHAR(256) NULL,
    action       NVARCHAR(100) NOT NULL,
    entity_name  NVARCHAR(100) NOT NULL,
    entity_id    NVARCHAR(50)  NULL,
    detail       NVARCHAR(MAX) NULL,
    ip_address   NVARCHAR(45)  NULL,
    created_at   DATETIME2(3)  NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_audit_logs        PRIMARY KEY (audit_log_id),
    CONSTRAINT FK_audit_logs_users  FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL,
    CONSTRAINT CK_audit_logs_detail CHECK (detail IS NULL OR ISJSON(detail) = 1)
)
GO

-- Chỉ mục hiệu năng (Indexes)
-- Lưu ý: users.email đã có index tự động từ UQ_users_email nên không tạo thêm IX_users_email.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_logs_user_email' AND object_id = OBJECT_ID(N'dbo.audit_logs'))
CREATE NONCLUSTERED INDEX IX_audit_logs_user_email ON dbo.audit_logs (user_email, created_at DESC)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_logs_created_at' AND object_id = OBJECT_ID(N'dbo.audit_logs'))
CREATE NONCLUSTERED INDEX IX_audit_logs_created_at ON dbo.audit_logs (created_at DESC)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_logs_entity' AND object_id = OBJECT_ID(N'dbo.audit_logs'))
CREATE NONCLUSTERED INDEX IX_audit_logs_entity ON dbo.audit_logs (entity_name, entity_id)
GO

-- ==============================================================================
-- Dữ liệu role cố định của hệ thống (chạy lại nhiều lần vẫn an toàn)
-- ==============================================================================
INSERT INTO dbo.roles (role_name, description)
SELECT s.role_name, s.description
FROM (VALUES
    (N'Customer',         N'Khách hàng tạo và theo dõi đơn giao'),
    (N'Dispatcher',       N'Duyệt đơn, lên lịch giao hàng'),
    (N'StationOperator',  N'Vận hành trạm hạ cánh, xác nhận lấy hàng'),
    (N'LogisticsManager', N'Xem thống kê và báo cáo'),
    (N'SystemAdmin',      N'Quản trị người dùng và hệ thống')
) AS s (role_name, description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.roles r WHERE r.role_name = s.role_name)
GO