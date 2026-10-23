-- ==============================================================================
-- MODULE 5: TRACKING EVENTS & DELIVERY CONFIRMATIONS
-- Thành viên phụ trách: Nguyễn Thành Nhân (M5)
-- Nhánh Git: feat/w1-m5-tracking | Commit tuần tự: w1-13 -> w1-14
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

/* ---------- w1-13: tracking_events ---------- */
IF OBJECT_ID('dbo.tracking_events', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tracking_events (
        id                  UNIQUEIDENTIFIER NOT NULL
                            CONSTRAINT DF_tracking_events_id DEFAULT NEWID(),
        order_id            UNIQUEIDENTIFIER NOT NULL,
        status_code         VARCHAR(30)      NOT NULL,   -- khop gia tri status cua delivery_orders
        event_title         NVARCHAR(200)    NOT NULL,
        event_description   NVARCHAR(500)    NULL,
        current_latitude    DECIMAL(9,6)     NULL,
        current_longitude   DECIMAL(9,6)     NULL,
        current_altitude    DECIMAL(6,2)     NULL,
        current_battery     INT              NULL,
        event_timestamp     DATETIME2(7)     NOT NULL
                            CONSTRAINT DF_tracking_events_event_timestamp DEFAULT SYSDATETIME(),

        CONSTRAINT PK_tracking_events PRIMARY KEY (id),
        CONSTRAINT FK_tracking_events_delivery_orders_order_id
            FOREIGN KEY (order_id) REFERENCES dbo.delivery_orders(id)
            ON DELETE CASCADE ON UPDATE CASCADE,                      -- FK matrix #20
        CONSTRAINT CK_tracking_events_current_latitude
            CHECK (current_latitude  IS NULL OR current_latitude  BETWEEN -90.0  AND 90.0),
        CONSTRAINT CK_tracking_events_current_longitude
            CHECK (current_longitude IS NULL OR current_longitude BETWEEN -180.0 AND 180.0),
        CONSTRAINT CK_tracking_events_current_battery
            CHECK (current_battery   IS NULL OR current_battery   BETWEEN 0 AND 100)
    );

    -- Truy van chinh: lich su cua 1 don theo thoi gian
    CREATE NONCLUSTERED INDEX IX_tracking_events_order_id
        ON dbo.tracking_events (order_id, event_timestamp)
        INCLUDE (status_code, event_title, current_latitude, current_longitude);
END
GO

-- Append-only: cam UPDATE. Dung AFTER trigger (INSTEAD OF trigger khong di cung
-- FK ON DELETE/UPDATE CASCADE). DELETE chi xay ra qua cascade khi xoa don hang;
-- ung dung nen bi REVOKE UPDATE, DELETE tren bang nay.
CREATE OR ALTER TRIGGER dbo.trg_tracking_events_no_update
ON dbo.tracking_events
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW 50001, N'tracking_events la bang append-only: khong cho phep UPDATE.', 1;
END
GO

/* ---------- w1-14: delivery_confirmations ---------- */
IF OBJECT_ID('dbo.delivery_confirmations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.delivery_confirmations (
        id                      UNIQUEIDENTIFIER NOT NULL
                                CONSTRAINT DF_delivery_confirmations_id DEFAULT NEWID(),
        order_id                UNIQUEIDENTIFIER NOT NULL,
        confirmation_method     VARCHAR(30)      NOT NULL,
        otp_hashed              VARCHAR(64)      NULL,    -- chi luu hash, KHONG luu OTP goc
        otp_expired_at          DATETIME2(7)     NULL,
        otp_retry_count         INT              NOT NULL
                                CONSTRAINT DF_delivery_confirmations_otp_retry_count DEFAULT 0,
        is_verified             BIT              NOT NULL
                                CONSTRAINT DF_delivery_confirmations_is_verified DEFAULT 0,
        recipient_signature_url VARCHAR(500)     NULL,
        delivery_photo_url      VARCHAR(500)     NULL,
        confirmed_at            DATETIME2(7)     NULL,

        CONSTRAINT PK_delivery_confirmations PRIMARY KEY (id),
        CONSTRAINT UQ_delivery_confirmations_order_id UNIQUE (order_id),   -- 1 don = 1 xac nhan
        CONSTRAINT FK_delivery_confirmations_delivery_orders_order_id
            FOREIGN KEY (order_id) REFERENCES dbo.delivery_orders(id)
            ON DELETE CASCADE ON UPDATE CASCADE,                           -- FK matrix #21
        CONSTRAINT CK_delivery_confirmations_confirmation_method
            CHECK (confirmation_method IN ('OTP','DYNAMIC_QR','DIGITAL_SIGNATURE')),
        CONSTRAINT CK_delivery_confirmations_otp_retry_count
            CHECK (otp_retry_count >= 0),
        CONSTRAINT CK_delivery_confirmations_otp_required
            CHECK (confirmation_method <> 'OTP'
                   OR (otp_hashed IS NOT NULL AND otp_expired_at IS NOT NULL)),
        CONSTRAINT CK_delivery_confirmations_verified_confirmed_at
            CHECK ((is_verified = 1 AND confirmed_at IS NOT NULL)
                OR (is_verified = 0 AND confirmed_at IS NULL))
    );
END
GO
