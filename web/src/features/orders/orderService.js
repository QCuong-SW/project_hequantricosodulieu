import { API_V1_URL, DEFAULT_CUSTOMER_ID } from '../../config/apiConfig'
import { getAccessToken } from '../dashboard/authBridge'

const FALLBACK_ADDRESSES = [
  {
    id: '44444444-4444-4444-4444-444444444001',
    addressLine: 'Lô E2a-7, Đường D1, Khu Công Nghệ Cao',
    ward: 'Long Thạnh Mỹ',
    district: 'TP. Thủ Đức',
    city: 'TP. Hồ Chí Minh',
    latitude: 10.841128,
    longitude: 106.809883,
    isDefault: true,
    createdAt: '2026-11-15T08:00:00Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444002',
    addressLine: 'Số 2 Hải Triều, Tòa Bitexco Financial Tower',
    ward: 'Bến Nghé',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    latitude: 10.771595,
    longitude: 106.70475,
    isDefault: false,
    createdAt: '2026-11-16T09:00:00Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444003',
    addressLine: '101 Tôn Dật Tiên, Khu đô thị Phú Mỹ Hưng',
    ward: 'Tân Phú',
    district: 'Quận 7',
    city: 'TP. Hồ Chí Minh',
    latitude: 10.72956,
    longitude: 106.72175,
    isDefault: false,
    createdAt: '2026-11-17T10:00:00Z',
  },
]

async function request(path, options = {}) {
  const token = getAccessToken()
  const response = await fetch(`${API_V1_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.title ||
      (Array.isArray(payload?.errors) ? payload.errors.join(', ') : null) ||
      `API request failed (${response.status})`
    throw new Error(message)
  }

  return payload
}

function unwrapData(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return payload?.data ?? payload
}

export async function getMyAddresses() {
  try {
    const payload = await request('/addresses')
    const items = unwrapData(payload)
    return Array.isArray(items) && items.length > 0 ? items : FALLBACK_ADDRESSES
  } catch {
    return FALLBACK_ADDRESSES
  }
}

export async function createMyAddress(body) {
  const payload = await request('/addresses', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return unwrapData(payload)
}

export async function updateMyAddress(addressId, body) {
  const payload = await request(`/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return unwrapData(payload)
}

export async function deleteMyAddress(addressId) {
  const payload = await request(`/addresses/${addressId}`, {
    method: 'DELETE',
  })
  return unwrapData(payload)
}

export async function payDeliveryOrder(orderId) {
  const payload = await request(`/delivery-orders/${orderId}/pay`, {
    method: 'POST',
  })
  return unwrapData(payload)
}

export async function createDeliveryOrder(body) {
  const payload = await request('/delivery-orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return unwrapData(payload)
}

export async function getLandingStations() {
  try {
    const payload = await request('/landing-stations')
    const items = unwrapData(payload)
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

export async function getCustomerOrders(customerId) {
  const targetCustomerId = customerId || getConfiguredCustomerId()
  const payload = await request(`/delivery-orders/customer/${targetCustomerId}`)
  return unwrapData(payload) || []
}

export async function cancelDeliveryOrder(orderId, expectedConcurrencyVersion = 0, reason = 'Khách hàng yêu cầu hủy đơn trước khi bay.') {
  const payload = await request(`/delivery-orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      requestedByUserId: getConfiguredCustomerId(),
      requestedByRole: 'CUSTOMER',
      cancellationReason: reason,
      expectedConcurrencyVersion: expectedConcurrencyVersion || 0,
    }),
  })
  return unwrapData(payload)
}

export function getConfiguredCustomerId() {
  return localStorage.getItem('customerId') || import.meta.env.VITE_CUSTOMER_ID || DEFAULT_CUSTOMER_ID
}
