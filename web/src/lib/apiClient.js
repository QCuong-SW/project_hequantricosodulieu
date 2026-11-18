import { getAccessToken } from "../features/dashboard/authBridge.js";

export async function apiClient(path, { body, headers, ...options } = {}) {
  const token = getAccessToken();
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.detail ||
      data?.message ||
      data?.Message ||
      data?.title ||
      `HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
