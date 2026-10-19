# Module 1: Identity, Authentication & RBAC

- **Phụ trách**: Vũ Trí Thành (M1)
- **Nhánh Git**: `feat/w1-m1-identity` | **Commit form**: `w1-01: feat(db): ...`
- **Mục tiêu**: Quản lý tài khoản người dùng, phân quyền 5 vai trò (Admin, Dispatcher, Station Operator, Logistics Manager, Customer), phiên làm việc và nhật ký kiểm toán.
- **Các thực thể chính cần thiết kế**:
  - `users` (Tài khoản)
  - `roles` (Danh mục vai trò)
  - `user_roles` (Liên kết vai trò)
  - `refresh_tokens` (Phiên làm việc)
  - `audit_logs` (Nhật ký hệ thống)
- **Yêu cầu kỹ thuật**: Viết bằng T-SQL cho **Microsoft SQL Server**.
