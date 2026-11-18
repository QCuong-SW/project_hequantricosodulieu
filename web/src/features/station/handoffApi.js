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