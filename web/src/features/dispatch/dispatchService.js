import { API_V1_URL } from '../../config/apiConfig'
import { getAccessToken } from '../dashboard/authBridge'

function authHeaders() {
  const token = getAccessToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const INITIAL_PENDING_ORDERS = [
  {
    id: 'a1111111-1111-1111-1111-111111111001',
    trackingNumber: 'SDD-20261108-482910',
    customerName: 'Nguyen Van An',
    senderAddress: 'Bitexco Financial Tower, Quan 1, TP.HCM',
    recipientName: 'Tran Thi Bich',
    recipientAddress: 'Khu Cong Nghe Cao, TP. Thu Duc, TP.HCM',
    totalWeightKg: 1.85,
    shippingFee: 43500,
    pickupMethod: 'STATION_DROP',
    deliveryMethod: 'STATION_PICKUP',
    isFragile: true,
    status: 'PENDING_APPROVAL',
    createdAt: '2026-11-08 08:15',
  },
  {
    id: 'a1111111-1111-1111-1111-111111111002',
    trackingNumber: 'SDD-20261108-593024',
    customerName: 'Le Hoang Nam',
    senderAddress: 'Crescent Mall, Quan 7, TP.HCM',
    recipientName: 'Pham Minh Tuan',
    recipientAddress: 'Vincom Center Dong Khoi, Quan 1, TP.HCM',
    totalWeightKg: 3.4,
    shippingFee: 59000,
    pickupMethod: 'SENDER_ADDRESS',
    deliveryMethod: 'CUSTOMER_ADDRESS',
    isFragile: false,
    status: 'APPROVED',
    createdAt: '2026-11-08 08:40',
  },
  {
    id: 'a1111111-1111-1111-1111-111111111003',
    trackingNumber: 'SDD-20261108-704188',
    customerName: 'Vo Minh Khang',
    senderAddress: 'Dai Hoc Quoc Gia, TP. Thu Duc, TP.HCM',
    recipientName: 'Dang Thu Ha',
    recipientAddress: 'Phu My Hung, Quan 7, TP.HCM',
    totalWeightKg: 4.2,
    shippingFee: 82000,
    pickupMethod: 'STATION_DROP',
    deliveryMethod: 'CUSTOMER_ADDRESS',
    isFragile: true,
    status: 'PENDING_APPROVAL',
    createdAt: '2026-11-08 09:05',
  },
]

export const INITIAL_DRONES = [
  {
    id: '33333333-3333-3333-3333-333333333001',
    droneCode: 'DRN-001',
    model: 'DJI FlyCart 30 Lite',
    maxPayloadKg: 5.0,
    maxFlightRangeKm: 25.0,
    maxSpeedKmh: 60.0,
    batteryPercentage: 95,
    status: 'IDLE',
  },
  {
    id: '33333333-3333-3333-3333-333333333002',
    droneCode: 'DRN-002',
    model: 'Matrice 350 Delivery',
    maxPayloadKg: 3.5,
    maxFlightRangeKm: 20.0,
    maxSpeedKmh: 55.0,
    batteryPercentage: 88,
    status: 'IDLE',
  },
  {
    id: '33333333-3333-3333-3333-333333333003',
    droneCode: 'DRN-003',
    model: 'Wingcopter 198 Urban',
    maxPayloadKg: 4.5,
    maxFlightRangeKm: 30.0,
    maxSpeedKmh: 65.0,
    batteryPercentage: 92,
    status: 'IDLE',
  },
]

export const INITIAL_STATIONS = [
  {
    id: '22222222-2222-2222-2222-222222222001',
    stationCode: 'STN-Q1',
    name: 'Trạm Trung Tâm Quận 1',
    addressLine: 'Khu vực Bến Thành, Quận 1, TP.HCM',
    latitude: 10.771595,
    longitude: 106.70475,
    availableLandingPadsCount: 1,
  },
  {
    id: '22222222-2222-2222-2222-222222222002',
    stationCode: 'STN-TD',
    name: 'Trạm Khu Công Nghệ Cao Thủ Đức',
    addressLine: 'Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
    latitude: 10.841128,
    longitude: 106.809883,
    availableLandingPadsCount: 1,
  },
  {
    id: '22222222-2222-2222-2222-222222222003',
    stationCode: 'STN-Q7',
    name: 'Trạm Khu Đô Thị Phú Mỹ Hưng Q7',
    addressLine: 'Khu vực Phú Mỹ Hưng, Quận 7, TP.HCM',
    latitude: 10.72956,
    longitude: 106.72175,
    availableLandingPadsCount: 2,
  },
]

function mapBackendOrder(o) {
  const snapshot = o.addressSnapshot || {}
  const pkgs = Array.isArray(o.packages) ? o.packages : []
  return {
    id: o.id,
    trackingNumber: o.trackingNumber,
    customerName: snapshot.senderName || 'Khách hàng',
    senderAddress: snapshot.senderAddressText || '—',
    senderLatitude: snapshot.senderLatitude,
    senderLongitude: snapshot.senderLongitude,
    recipientName: snapshot.recipientName || 'Người nhận',
    recipientAddress: snapshot.recipientAddressText || '—',
    recipientLatitude: snapshot.recipientLatitude,
    recipientLongitude: snapshot.recipientLongitude,
    totalWeightKg: Number(o.totalWeightKg || 0),
    shippingFee: Number(o.shippingFee || 0),
    pickupMethod: o.pickupMethod || 'STATION_DROP',
    deliveryMethod: o.deliveryMethod || 'CUSTOMER_ADDRESS',
    isFragile: pkgs.some((p) => p.isFragile),
    status: o.status || 'PENDING_APPROVAL',
    concurrencyVersion: o.concurrencyVersion || 1,
    createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '',
  }
}

export async function fetchAllOrdersApi() {
  try {
    const response = await fetch(`${API_V1_URL}/delivery-orders`, {
      headers: authHeaders(),
    })
    if (!response.ok) return INITIAL_PENDING_ORDERS
    const payload = await response.json()
    const rawList = Array.isArray(payload) ? payload : payload?.data || []
    return rawList.length > 0 ? rawList.map(mapBackendOrder) : INITIAL_PENDING_ORDERS
  } catch {
    return INITIAL_PENDING_ORDERS
  }
}

export async function fetchAvailableDronesApi(requiredPayloadKg = null) {
  try {
    const url = requiredPayloadKg
      ? `${API_V1_URL}/flight-schedules/drones/available?requiredPayloadKg=${requiredPayloadKg}`
      : `${API_V1_URL}/flight-schedules/drones/available`
    const response = await fetch(url, { headers: authHeaders() })
    if (!response.ok) return INITIAL_DRONES
    const payload = await response.json()
    const list = Array.isArray(payload) ? payload : payload?.data || []
    return list.length > 0 ? list : INITIAL_DRONES
  } catch {
    return INITIAL_DRONES
  }
}

export async function fetchLandingStationsApi() {
  try {
    const response = await fetch(`${API_V1_URL}/landing-stations`, {
      headers: authHeaders(),
    })
    if (!response.ok) return INITIAL_STATIONS
    const payload = await response.json()
    const list = Array.isArray(payload) ? payload : payload?.data || []
    return list.length > 0 ? list : INITIAL_STATIONS
  } catch {
    return INITIAL_STATIONS
  }
}

export async function fetchFlightSchedulesApi() {
  try {
    const response = await fetch(`${API_V1_URL}/flight-schedules`, {
      headers: authHeaders(),
    })
    if (!response.ok) return []
    const payload = await response.json()
    return Array.isArray(payload) ? payload : payload?.data || []
  } catch {
    return []
  }
}

export async function reviewOrderApprovalApi(payload) {
  const response = await fetch(`${API_V1_URL}/flight-schedules/orders/review`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const errMessage =
      data?.message ||
      (Array.isArray(data?.errors) ? data.errors.join(', ') : null) ||
      `Phê duyệt đơn hàng thất bại (${response.status})`
    throw new Error(errMessage)
  }

  return data
}

export async function assignFlightScheduleApi(payload) {
  const response = await fetch(`${API_V1_URL}/flight-schedules/assign`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const errMessage =
      data?.message ||
      (Array.isArray(data?.errors) ? data.errors.join(', ') : null) ||
      `Gán lịch bay thất bại (${response.status})`
    throw new Error(errMessage)
  }

  return data
}

export async function predictOrderEtaApi(orderId, windSpeedKmh = 10) {
  try {
    const response = await fetch(
      `${API_V1_URL}/ai/eta/${orderId}?windSpeedKmh=${windSpeedKmh}`,
      { headers: authHeaders() }
    )
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function abortFlightScheduleApi(scheduleId, abortReason) {
  const response = await fetch(`${API_V1_URL}/flight-schedules/${scheduleId}/abort`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ abortReason }),
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) {
    throw new Error(data?.message || 'Hủy chuyến bay thất bại.')
  }
  return data
}
