-- ==============================================================================
-- SMARTDRONEDELIVERY — KHỞI TẠO CƠ SỞ DỮ LIỆU CHUNG (SHARED DATABASE INIT)
-- HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU: MICROSOFT SQL SERVER
-- ==============================================================================

USE master;
GO

-- 1. Tạo cơ sở dữ liệu nếu chưa tồn tại
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SmartDroneDeliveryDb')
BEGIN
    CREATE DATABASE SmartDroneDeliveryDb
    COLLATE Latin1_General_100_CI_AS_SC_UTF8; -- Hỗ trợ UTF-8 cho chuỗi Unicode tiếng Việt
    PRINT N'>> Đã tạo thành công cơ sở dữ liệu SmartDroneDeliveryDb trên SQL Server.';
END
ELSE
BEGIN
    PRINT N'>> Cơ sở dữ liệu SmartDroneDeliveryDb đã tồn tại.';
END
GO

USE SmartDroneDeliveryDb;
GO

PRINT N'>> Đang sử dụng database SmartDroneDeliveryDb. Sẵn sàng cho các module của từng thành viên chạy migration.';
GO
