-- ==============================================================================
-- MODULE 1: IDENTITY, AUTHENTICATION & RBAC
-- Thành viên phụ trách: Vũ Trí Thành (M1)
-- Nhánh Git: feat/w1-m1-identity | Commit tuần tự: w1-02 -> w1-04
-- Hệ Quản Trị CSDL: Microsoft SQL Server 2022
-- ==============================================================================

USE SmartDroneDeliveryDb;
GO

-- TODO (Thành viên 1): Viết lệnh CREATE TABLE dbo.users
-- Gợi ý: Có ràng buộc UQ_users_email, CK_users_status



-- TODO (Thành viên 1): Viết lệnh CREATE TABLE dbo.roles
-- Gợi ý: role_name UNIQUE



-- TODO (Thành viên 1): Viết lệnh CREATE TABLE dbo.user_roles
-- Gợi ý: Khóa chính kép (user_id, role_id) và Foreign Keys



-- TODO (Thành viên 1): Viết lệnh CREATE TABLE dbo.refresh_tokens
-- Gợi ý: Liên kết user_id với ON DELETE CASCADE



-- TODO (Thành viên 1): Viết lệnh CREATE TABLE dbo.audit_logs
-- Gợi ý: Ghi nhận vết kiểm toán của hệ thống



-- TODO (Thành viên 1): Viết chỉ mục hiệu năng (Indexes)
-- CREATE NONCLUSTERED INDEX IX_users_email ON dbo.users (email);

GO
