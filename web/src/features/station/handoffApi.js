import { apiClient } from "../../lib/apiClient.js";

export function scanPackageHandoff(payload) {
  return apiClient("/api/v1/handoffs/scan", {
    method: "POST",
    body: payload,
  });
}

export function fetchStationHandoffs(stationId) {
  return apiClient(
    `/api/v1/handoffs/station/${encodeURIComponent(stationId)}`
  );
}