// web/src/config/apiConfig.js
const rawEnvUrl = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5028').trim().replace(/\/+$/, '');

// Normalize so both "http://localhost:5028" and "http://localhost:5028/api/v1" work cleanly
export const API_ORIGIN = rawEnvUrl.replace(/\/api(\/v1)?$/i, '');
export const API_V1_URL = `${API_ORIGIN}/api/v1`;
export const AUTH_API_URL = `${API_ORIGIN}/api/auth`;

export const DEFAULT_CUSTOMER_ID = '11111111-1111-1111-1111-111111111005';
export const DEFAULT_DISPATCHER_ID = '11111111-1111-1111-1111-111111111002';
export const DEFAULT_OPERATOR_ID = '11111111-1111-1111-1111-111111111003';
export const DEFAULT_STATION_ID = '22222222-2222-2222-2222-222222222001';
export const DEFAULT_DRONE_ID = '33333333-3333-3333-3333-333333333001';

export const ROLE_ACCOUNTS = {
  ADMIN:             { email: 'admin@smartdrone.vn',      userId: '11111111-1111-1111-1111-111111111001', fullName: 'Quản trị viên Hệ Thống', role: 'ADMIN' },
  DISPATCHER:        { email: 'dispatcher@smartdrone.vn', userId: '11111111-1111-1111-1111-111111111002', fullName: 'Điều phối viên Không Phận', role: 'DISPATCHER' },
  STATION_OPERATOR:  { email: 'operator@smartdrone.vn',   userId: '11111111-1111-1111-1111-111111111003', fullName: 'Nhân viên Bãi Đáp Trạm', role: 'STATION_OPERATOR' },
  LOGISTICS_MANAGER: { email: 'manager@smartdrone.vn',    userId: '11111111-1111-1111-1111-111111111004', fullName: 'Quản lý Logistics Vận Hành', role: 'LOGISTICS_MANAGER' },
  CUSTOMER:          { email: 'customer@smartdrone.vn',   userId: '11111111-1111-1111-1111-111111111005', fullName: 'Nguyễn Văn An (Khách hàng A)', role: 'CUSTOMER' },
  CUSTOMER_B:        { email: 'customer2@smartdrone.vn',  userId: '11111111-1111-1111-1111-111111111006', fullName: 'Trần Thị Bích (Khách hàng B)', role: 'CUSTOMER' },
};

export const DEMO_PRESET_USERS = [
  {
    key: 'customer_a',
    label: 'Khách hàng A (Nguyễn Văn An)',
    email: 'customer@smartdrone.vn',
    password: 'Password123!',
    role: 'CUSTOMER',
    desc: 'Đơn hàng & địa chỉ riêng biệt của Khách hàng A',
    badge: 'Khách hàng A',
    color: 'emerald',
  },
  {
    key: 'customer_b',
    label: 'Khách hàng B (Trần Thị Bích)',
    email: 'customer2@smartdrone.vn',
    password: 'Password123!',
    role: 'CUSTOMER',
    desc: 'Đơn hàng & địa chỉ hoàn toàn riêng biệt của Khách hàng B',
    badge: 'Khách hàng B',
    color: 'teal',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối viên bay',
    email: 'dispatcher@smartdrone.vn',
    password: 'Password123!',
    role: 'DISPATCHER',
    desc: 'Phê duyệt đơn hàng, cấp phép bay và điều phối',
    badge: 'Điều phối',
    color: 'cyan',
  },
  {
    key: 'operator',
    label: 'Nhân viên trạm bãi đáp',
    email: 'operator@smartdrone.vn',
    password: 'Password123!',
    role: 'STATION_OPERATOR',
    desc: 'Quản lý hạ tầng trạm, hoán đổi pin và quét kiện',
    badge: 'Nhân viên trạm',
    color: 'amber',
  },
  {
    key: 'admin',
    label: 'Quản trị viên hệ thống',
    email: 'admin@smartdrone.vn',
    password: 'Password123!',
    role: 'ADMIN',
    desc: 'Toàn quyền cấu hình, quản lý tài khoản & giám sát',
    badge: 'Quản trị viên',
    color: 'purple',
  },
];
