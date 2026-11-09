const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5028";

export async function scanPackageHandoff(payload) {
  const response = await fetch(`${API_BASE_URL}/api/v1/handoffs/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    const response = await fetch(`${API_BASE_URL}/api/v1/handoffs/station/${stationId}`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}