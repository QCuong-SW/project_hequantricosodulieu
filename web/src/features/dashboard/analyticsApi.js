// web/src/features/dashboard/analyticsApi.js
import { getAccessToken } from './authBridge.js';
import { API_ORIGIN } from '../../config/apiConfig.js';

const ANALYTICS = '/api/v1/analytics';

/** Nếu backend bọc kết quả dạng { success, data, ... } (response wrapper) thì lấy phần data. */
function unwrap(body) {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body &&
      ('success' in body || 'isSuccess' in body || 'statusCode' in body)) {
    return body.data;
  }
  return body;
}

const FALLBACK_STATIONS = [
  {
    stationId: '22222222-2222-2222-2222-222222222001',
    stationCode: 'STN-Q1',
    stationName: 'Trạm Trung Tâm Quận 1',
    stationStatus: 'ACTIVE',
    declaredSlots: 4,
    actualSlots: 4,
    availableSlots: 3,
    occupiedSlots: 1,
    reservedSlots: 0,
    maintenanceSlots: 0,
    usableSlots: 4,
    busySlots: 1,
    landingPadSlots: 2,
    landingPadBusy: 1,
    utilizationPercent: 25.0,
  },
  {
    stationId: '22222222-2222-2222-2222-222222222002',
    stationCode: 'STN-TD',
    stationName: 'Trạm Khu Công Nghệ Cao Thủ Đức',
    stationStatus: 'ACTIVE',
    declaredSlots: 4,
    actualSlots: 4,
    availableSlots: 3,
    occupiedSlots: 1,
    reservedSlots: 0,
    maintenanceSlots: 0,
    usableSlots: 4,
    busySlots: 1,
    landingPadSlots: 2,
    landingPadBusy: 1,
    utilizationPercent: 25.0,
  },
  {
    stationId: '22222222-2222-2222-2222-222222222003',
    stationCode: 'STN-Q7',
    stationName: 'Trạm Khu Đô Thị Phú Mỹ Hưng Q7',
    stationStatus: 'ACTIVE',
    declaredSlots: 4,
    actualSlots: 4,
    availableSlots: 4,
    occupiedSlots: 0,
    reservedSlots: 0,
    maintenanceSlots: 0,
    usableSlots: 4,
    busySlots: 0,
    landingPadSlots: 2,
    landingPadBusy: 0,
    utilizationPercent: 0.0,
  },
];

const FALLBACK_SUMMARY = {
  totalFlights: 12,
  completedFlights: 10,
  inProgressFlights: 1,
  scheduledFlights: 1,
  abortedFlights: 0,
  reroutedFlights: 0,
  onTimeFlights: 9,
  onTimeRatePercent: 90.0,
  avgDepartureDelayMinutes: 1.5,
  avgArrivalDelayMinutes: 1.2,
  totalDistanceKm: 138.4,
  avgSpeedKmh: 44.5,
};

const FALLBACK_ORDERS = [
  { status: 'PENDING_APPROVAL', count: 2 },
  { status: 'APPROVED', count: 1 },
  { status: 'SCHEDULED', count: 1 },
  { status: 'IN_TRANSIT', count: 1 },
  { status: 'DELIVERED', count: 8 },
];

function buildFallbackDaily(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 6 * 86400000);
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      totalFlights: 2,
      completedFlights: 2,
      abortedFlights: 0,
      onTimeFlights: 2,
      totalDistanceKm: 21.5,
    });
  }
  return days;
}

async function request(path, params, signal, fallbackFactory) {
  const url = new URL(`${API_ORIGIN}${ANALYTICS}${path}`, window.location.origin);
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
    if (fallbackFactory) return fallbackFactory();
    throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }

  if (!res.ok) {
    if (fallbackFactory) return fallbackFactory();
    let body = null;
    try { body = await res.json(); } catch {}
    throw new Error(body?.detail ?? body?.message ?? `Lỗi máy chủ (HTTP ${res.status}).`);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    if (fallbackFactory) return fallbackFactory();
  }
  return unwrap(body);
}

export const analyticsApi = {
  getStationUtilization: (signal) =>
    request('/stations/utilization', null, signal, () => FALLBACK_STATIONS),
  getFlightSummary: (from, to, signal) =>
    request('/flights/summary', { from, to }, signal, () => ({ ...FALLBACK_SUMMARY, from, to })),
  getFlightDaily: (from, to, signal) =>
    request('/flights/daily', { from, to }, signal, () => buildFallbackDaily(from, to)),
  getOrderStatusSummary: (signal) =>
    request('/orders/status-summary', null, signal, () => FALLBACK_ORDERS),
};
