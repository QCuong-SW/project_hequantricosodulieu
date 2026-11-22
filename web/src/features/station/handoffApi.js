import { API_V1_URL } from "../../config/apiConfig";
import { getAccessToken } from "../dashboard/authBridge";

function authHeaders() {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function scanPackageHandoff(payload) {
  const response = await fetch(`${API_V1_URL}/handoffs/scan`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.Message || "Không thể xác nhận quét mã bàn giao.");
  }

  return data;
}

export async function fetchStationHandoffs(stationId) {
  try {
    const response = await fetch(`${API_V1_URL}/handoffs/station/${stationId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function fetchStationsWithSlots() {
  try {
    const response = await fetch(`${API_V1_URL}/landing-stations`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload?.data || [];
  } catch {
    return [];
  }
}

export async function fetchActiveDrones() {
  try {
    const response = await fetch(`${API_V1_URL}/flight-schedules/drones/available`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload?.data || [];
  } catch {
    return [];
  }
}

export async function fetchPendingOrdersForHandoff() {
  try {
    const response = await fetch(`${API_V1_URL}/delivery-orders`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload?.data || [];
  } catch {
    return [];
  }
}

export async function updateStationSlotStatus(stationId, slotId, status) {
  const response = await fetch(`${API_V1_URL}/landing-stations/${stationId}/slots/${slotId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.Message || "Cập nhật slot trạm thất bại.");
  }
  return data;
}
