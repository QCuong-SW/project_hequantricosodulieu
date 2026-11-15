const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7178/api/v1'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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
  const payload = await request('/addresses')
  return unwrapData(payload) || []
}

export async function createDeliveryOrder(body) {
  const payload = await request('/delivery-orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return unwrapData(payload)
}

export async function getCustomerOrders(customerId) {
  if (!customerId) throw new Error('Chưa cấu hình Customer ID.')
  const payload = await request(`/delivery-orders/customer/${customerId}`)
  return unwrapData(payload) || []
}

export function getConfiguredCustomerId() {
  return import.meta.env.VITE_CUSTOMER_ID || localStorage.getItem('customerId') || ''
}
