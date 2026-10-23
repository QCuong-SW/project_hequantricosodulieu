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
