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
  ADMIN:             { email: 'admin@smartdrone.vn',      userId: '11111111-1111-1111-1111-111111111001', fullName: 'Quản trị viên' },
  DISPATCHER:        { email: 'dispatcher@smartdrone.vn', userId: '11111111-1111-1111-1111-111111111002', fullName: 'Điều phối viên' },
  STATION_OPERATOR:  { email: 'operator@smartdrone.vn',   userId: '11111111-1111-1111-1111-111111111003', fullName: 'Nhân viên trạm' },
  LOGISTICS_MANAGER: { email: 'manager@smartdrone.vn',    userId: '11111111-1111-1111-1111-111111111004', fullName: 'Quản lý logistics' },
  CUSTOMER:          { email: 'customer@smartdrone.vn',   userId: '11111111-1111-1111-1111-111111111005', fullName: 'Khách hàng mẫu' },
};
