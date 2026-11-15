// web/src/features/dashboard/analyticsApi.js
import { getAccessToken } from './authBridge.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const ANALYTICS = '/api/v1/analytics';

/** Nếu backend bọc kết quả dạng { success, data, ... } (response wrapper) thì lấy phần data. */
function unwrap(body) {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body &&
      ('success' in body || 'isSuccess' in body || 'statusCode' in body)) {
    return body.data;
  }
  return body;
}

async function request(path, params, signal) {
  const url = new URL(`${API_BASE}${ANALYTICS}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  const headers = { Accept: 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { headers, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }

  if (res.status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  if (res.status === 403) throw new Error('Bạn không có quyền xem Dashboard (cần vai trò Logistics Manager hoặc Admin).');

  let body = null;
  try {
    body = await res.json();
  } catch {
    /* phản hồi không có JSON */
  }
  if (!res.ok) {
    throw new Error(body?.detail ?? body?.message ?? `Lỗi máy chủ (HTTP ${res.status}).`);
  }
  return unwrap(body);
}

export const analyticsApi = {
  getStationUtilization: (signal) => request('/stations/utilization', null, signal),
  getFlightSummary: (from, to, signal) => request('/flights/summary', { from, to }, signal),
  getFlightDaily: (from, to, signal) => request('/flights/daily', { from, to }, signal),
  getOrderStatusSummary: (signal) => request('/orders/status-summary', null, signal),
};
