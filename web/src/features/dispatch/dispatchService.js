const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

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
    name: 'Tram Trung Tam Quan 1',
    latitude: 10.771595,
    longitude: 106.70475,
    availableLandingPads: 2,
  },
  {
    id: '22222222-2222-2222-2222-222222222002',
    stationCode: 'STN-TD',
    name: 'Tram Khu Cong Nghe Cao Thu Duc',
    latitude: 10.841128,
    longitude: 106.809883,
    availableLandingPads: 2,
  },
  {
    id: '22222222-2222-2222-2222-222222222003',
    stationCode: 'STN-Q7',
    name: 'Tram Khu Do Thi Phu My Hung Q7',
    latitude: 10.72956,
    longitude: 106.72175,
    availableLandingPads: 2,
  },
]

export async function reviewOrderApprovalApi(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/flight-schedules/orders/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function assignFlightScheduleApi(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/flight-schedules/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
