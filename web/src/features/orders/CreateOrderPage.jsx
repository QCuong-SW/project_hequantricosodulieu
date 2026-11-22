import { useEffect, useMemo, useState } from 'react'
import RealGoogleMapView from '../../components/common/RealGoogleMapView'
import { geocodeGoogleMaps } from '../../services/googleMapsService'
import {
  createDeliveryOrder,
  getConfiguredCustomerId,
  getLandingStations,
  getMyAddresses,
} from './orderService'

const initialPackage = {
  description: '',
  weightKg: '1.2',
  lengthCm: '25',
  widthCm: '18',
  heightCm: '12',
  declaredValue: '500000',
  isFragile: false,
  isHazardous: false,
}

// Haversine formula to compute distance in km
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

export default function CreateOrderPage({ onCreated }) {
  const [addresses, setAddresses] = useState([])
  const [stations, setStations] = useState([])
  const [selectedStationId, setSelectedStationId] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [originType, setOriginType] = useState('HUB') // 'HUB' | 'CUSTOM'

  const [sender, setSender] = useState({
    name: 'Trung Tâm Điều Phối Q1',
    phone: '0901234567',
    addressText: 'Trạm Trung Tâm Quận 1, Khu vực Bến Thành, Quận 1, TP.HCM',
    latitude: 10.771595,
    longitude: 106.70475,
  })

  const [recipient, setRecipient] = useState({
    name: 'Nguyễn Văn Nhận',
    phone: '0987654321',
    addressText: '',
    latitude: 10.841128,
    longitude: 106.809883,
  })

  const [packageInfo, setPackageInfo] = useState(initialPackage)
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeMessage, setGeocodeMessage] = useState('')

  async function handleGeocodeRecipient() {
    if (!recipient.addressText.trim()) return
    setIsGeocoding(true)
    setGeocodeMessage('')
    try {
      const geo = await geocodeGoogleMaps(recipient.addressText)
      if (geo && geo.latitude && geo.longitude) {
        setRecipient((prev) => ({
          ...prev,
          latitude: geo.latitude,
          longitude: geo.longitude,
        }))
        setGeocodeMessage(
          `Đã định vị thành công qua ${geo.provider}: (${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)})`
        )
      } else {
        setGeocodeMessage('Không lấy được tọa độ chi tiết từ API. Đang sử dụng tọa độ bãi đáp mặc định.')
      }
    } catch {
      setGeocodeMessage('Lỗi khi gọi Geocoding API.')
    } finally {
      setIsGeocoding(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([getMyAddresses(), getLandingStations()])
      .then(([addrItems, stationItems]) => {
        if (!active) return
        setAddresses(addrItems)
        setStations(stationItems)

        // Select first active station as origin
        if (stationItems && stationItems.length > 0) {
          const firstStation = stationItems[0]
          setSelectedStationId(firstStation.id)
          setSender((prev) => ({
            ...prev,
            name: `Điều Phối ${firstStation.name}`,
            addressText: `${firstStation.name} - ${firstStation.addressLine}`,
            latitude: Number(firstStation.latitude),
            longitude: Number(firstStation.longitude),
          }))
        }

        // Select default recipient address
        const defaultAddress = addrItems.find((item) => item.isDefault) || addrItems[0]
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id)
          setRecipient((prev) => ({
            ...prev,
            addressText: formatAddress(defaultAddress),
            latitude: Number(defaultAddress.latitude || 10.841128),
            longitude: Number(defaultAddress.longitude || 106.809883),
          }))
        }
      })
      .catch((err) => {
        if (active) setError(`Không thể tải dữ liệu trạm/địa chỉ: ${err.message}`)
      })
      .finally(() => {
        if (active) setLoadingData(false)
      })

    return () => {
      active = false
    }
  }, [])

  function handleStationChange(stationId) {
    setSelectedStationId(stationId)
    const stn = stations.find((s) => s.id === stationId)
    if (stn) {
      setSender((prev) => ({
        ...prev,
        name: `Điều Phối ${stn.name}`,
        addressText: `${stn.name} - ${stn.addressLine}`,
        latitude: Number(stn.latitude),
        longitude: Number(stn.longitude),
      }))
    }
  }

  function handleRecipientAddressChange(id) {
    setSelectedAddressId(id)
    const address = addresses.find((item) => item.id === id)
    if (address) {
      setRecipient((prev) => ({
        ...prev,
        addressText: formatAddress(address),
        latitude: Number(address.latitude || 10.841128),
        longitude: Number(address.longitude || 106.809883),
      }))
    }
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    setPhotoDataUrl('')
    setPhotoName('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh.')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ảnh tối đa 2 MB.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ''))
      setPhotoName(file.name)
      setError('')
    }
    reader.onerror = () => setError('Không đọc được ảnh đã chọn.')
    reader.readAsDataURL(file)
  }

  // Live flight calculations
  const distanceKm = useMemo(() => {
    return calculateDistanceKm(
      sender.latitude,
      sender.longitude,
      recipient.latitude,
      recipient.longitude
    )
  }, [sender.latitude, sender.longitude, recipient.latitude, recipient.longitude])

  const estimatedFlightMinutes = useMemo(() => {
    if (distanceKm <= 0) return 0
    // Drone average cruising speed: 50 km/h + 3 mins takeoff/landing
    const flyMinutes = (distanceKm / 50) * 60
    return Math.round(flyMinutes + 3)
  }, [distanceKm])

  const calculatedFee = useMemo(() => {
    const baseFee = 25000
    const weight = Number(packageInfo.weightKg) || 1
    const weightFee = Math.round(weight * 10000)
    const fragileFee = packageInfo.isFragile ? 15000 : 0
    return {
      baseFee,
      weightFee,
      fragileFee,
      total: baseFee + weightFee + fragileFee,
    }
  }, [packageInfo.weightKg, packageInfo.isFragile])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const customerId = getConfiguredCustomerId()
    if (!customerId) {
      setError('Thiếu Customer ID. Hãy cấu hình VITE_CUSTOMER_ID hoặc localStorage.customerId.')
      return
    }

    if (!sender.name.trim() || !sender.phone.trim() || !sender.addressText.trim()) {
      setError('Vui lòng nhập đầy đủ tên, số điện thoại và địa chỉ người gửi.')
      return
    }
    if (!recipient.name.trim() || !recipient.phone.trim() || !recipient.addressText.trim()) {
      setError('Vui lòng nhập đầy đủ tên, số điện thoại và địa chỉ người nhận.')
      return
    }

    const numericFields = ['weightKg', 'lengthCm', 'widthCm', 'heightCm']
    if (
      numericFields.some(
        (key) => !Number.isFinite(Number(packageInfo[key])) || Number(packageInfo[key]) <= 0
      )
    ) {
      setError('Cân nặng và ba kích thước phải là số lớn hơn 0.')
      return
    }

    const body = {
      customerId,
      pickupMethod: originType === 'HUB' ? 'STATION_DROP' : 'SENDER_ADDRESS',
      deliveryMethod: 'CUSTOMER_ADDRESS',
      sender: {
        name: sender.name.trim(),
        phone: sender.phone.trim(),
        addressText: sender.addressText.trim(),
        latitude: Number(sender.latitude) || 10.771595,
        longitude: Number(sender.longitude) || 106.70475,
      },
      recipient: {
        name: recipient.name.trim(),
        phone: recipient.phone.trim(),
        addressText: recipient.addressText.trim(),
        latitude: Number(recipient.latitude) || 10.841128,
        longitude: Number(recipient.longitude) || 106.809883,
      },
      packages: [
        {
          description: packageInfo.description.trim() || 'Bưu kiện giao bằng drone',
          weightKg: Number(packageInfo.weightKg),
          lengthCm: Number(packageInfo.lengthCm),
          widthCm: Number(packageInfo.widthCm),
          heightCm: Number(packageInfo.heightCm),
          declaredValue: Number(packageInfo.declaredValue || 0),
          isFragile: packageInfo.isFragile,
          isHazardous: packageInfo.isHazardous,
          packagePhotoUrl: photoDataUrl || null,
        },
      ],
    }

    setSubmitting(true)
    try {
      const created = await createDeliveryOrder(body)
      setSuccess(
        `Đã tạo đơn giao hàng thành công! Mã vận đơn: ${created?.trackingNumber || created?.id}`
      )
      setPackageInfo(initialPackage)
      setPhotoDataUrl('')
      setPhotoName('')
      if (onCreated) onCreated(created)
    } catch (err) {
      setError(err.message || 'Không thể tạo đơn hàng.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="max-w-6xl mx-auto space-y-6 text-slate-900 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-emerald-900/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Tạo Đơn Giao Hàng Bằng Drone
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Thiết lập điểm cất cánh, điểm đáp nội đô TP.HCM và thông số bưu kiện.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-medium">
          <div className="font-bold text-rose-900 mb-0.5">Lỗi tạo đơn hàng:</div>
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-medium">
          <div className="font-bold text-emerald-900 mb-0.5">Hoàn tất!</div>
          {success}
        </div>
      )}

      {/* Main 2-Column Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Sender / Hub */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                  01
                </span>
                <h2 className="text-base font-bold text-slate-900">Điểm Xuất Phát (Điểm Gửi)</h2>
              </div>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setOriginType('HUB')
                    if (stations.length > 0) handleStationChange(stations[0].id)
                  }}
                  className={`px-3 py-1 rounded-md transition-all ${
                    originType === 'HUB'
                      ? 'bg-white text-emerald-800 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Trạm Drone Hub
                </button>
                <button
                  type="button"
                  onClick={() => setOriginType('CUSTOM')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    originType === 'CUSTOM'
                      ? 'bg-white text-emerald-800 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Địa chỉ riêng
                </button>
              </div>
            </div>

            {originType === 'HUB' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Chọn Trạm Tiếp Đất Cất Cánh *
                  </label>
                  <select
                    value={selectedStationId}
                    onChange={(e) => handleStationChange(e.target.value)}
                    disabled={loadingData || stations.length === 0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  >
                    {stations.map((stn) => (
                      <option key={stn.id} value={stn.id}>
                        [{stn.stationCode}] {stn.name} — {stn.addressLine}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Trạm được trang bị bãi đáp tiêu chuẩn và hệ thống sạc tự động.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Người bàn giao tại trạm *
                    </label>
                    <input
                      type="text"
                      value={sender.name}
                      onChange={(e) => setSender({ ...sender, name: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Số điện thoại liên hệ *
                    </label>
                    <input
                      type="tel"
                      value={sender.phone}
                      onChange={(e) => setSender({ ...sender, phone: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 flex items-center justify-between text-xs text-emerald-950">
                  <span>Tọa độ trạm cất cánh:</span>
                  <span className="font-mono font-semibold">
                    {sender.latitude.toFixed(6)}, {sender.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Họ tên người gửi *
                    </label>
                    <input
                      type="text"
                      value={sender.name}
                      onChange={(e) => setSender({ ...sender, name: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Số điện thoại *
                    </label>
                    <input
                      type="tel"
                      value={sender.phone}
                      onChange={(e) => setSender({ ...sender, phone: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Địa chỉ lấy hàng chi tiết *
                  </label>
                  <input
                    type="text"
                    value={sender.addressText}
                    onChange={(e) => setSender({ ...sender, addressText: e.target.value })}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Vĩ độ (Lat)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={sender.latitude}
                      onChange={(e) =>
                        setSender({ ...sender, latitude: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Kinh độ (Lng)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={sender.longitude}
                      onChange={(e) =>
                        setSender({ ...sender, longitude: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Recipient Address */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                02
              </span>
              <h2 className="text-base font-bold text-slate-900">Điểm Đích (Người Nhận)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Chọn Địa Chỉ Người Nhận Đã Lưu *
                </label>
                <select
                  value={selectedAddressId}
                  onChange={(e) => handleRecipientAddressChange(e.target.value)}
                  disabled={loadingData || addresses.length === 0}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                >
                  <option value="">{loadingData ? 'Đang tải...' : 'Chọn địa chỉ nhận hàng'}</option>
                  {addresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {formatAddress(addr)} {addr.isDefault ? '(Mặc định)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Họ tên người nhận *
                  </label>
                  <input
                    type="text"
                    value={recipient.name}
                    onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Số điện thoại người nhận *
                  </label>
                  <input
                    type="tel"
                    value={recipient.phone}
                    onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Địa chỉ giao chi tiết
                  </label>
                  <button
                    type="button"
                    onClick={handleGeocodeRecipient}
                    disabled={isGeocoding || !recipient.addressText.trim()}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer transition"
                  >
                    <svg className={`w-3.5 h-3.5 ${isGeocoding ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>{isGeocoding ? 'Đang tìm tọa độ...' : 'Định vị Google API'}</span>
                  </button>
                </div>
                <textarea
                  value={recipient.addressText}
                  onChange={(e) => setRecipient({ ...recipient, addressText: e.target.value })}
                  rows="2"
                  placeholder="Nhập địa chỉ nhận hàng để tra cứu tọa độ thật..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              {geocodeMessage && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                  {geocodeMessage}
                </div>
              )}

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between text-xs text-emerald-950">
                <span>Tọa độ giao hàng GPS:</span>
                <span className="font-mono font-semibold">
                  {recipient.latitude.toFixed(6)}, {recipient.longitude.toFixed(6)}
                </span>
              </div>

              {/* Real Google Maps Route Preview */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🗺️ Minh Họa Bản Đồ Tuyến Bay Google Maps</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      GOOGLE API
                    </span>
                  </span>
                  <span className="text-xs text-emerald-700 font-bold font-mono">
                    Khoảng cách: ~{distanceKm} km
                  </span>
                </div>
                <RealGoogleMapView
                  origin={{
                    lat: sender.latitude,
                    lng: sender.longitude,
                    label: sender.name || 'Trạm cất cánh',
                  }}
                  destination={{
                    lat: recipient.latitude,
                    lng: recipient.longitude,
                    label: recipient.name || 'Điểm giao nhận',
                  }}
                  heightClass="h-56 md:h-64"
                  showControls={true}
                  showTelemetryOverlay={false}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Package Specs */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                03
              </span>
              <h2 className="text-base font-bold text-slate-900">Quy Cách Kiện Hàng</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mô tả kiện hàng
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thiết bị điện tử nhỏ, mẫu thử nghiệm y tế, tài liệu..."
                  value={packageInfo.description}
                  onChange={(e) => setPackageInfo({ ...packageInfo, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Trọng lượng (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={packageInfo.weightKg}
                    onChange={(e) => setPackageInfo({ ...packageInfo, weightKg: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Dài (cm) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={packageInfo.lengthCm}
                    onChange={(e) => setPackageInfo({ ...packageInfo, lengthCm: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rộng (cm) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={packageInfo.widthCm}
                    onChange={(e) => setPackageInfo({ ...packageInfo, widthCm: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cao (cm) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={packageInfo.heightCm}
                    onChange={(e) => setPackageInfo({ ...packageInfo, heightCm: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Giá trị khai báo (VNĐ)
                </label>
                <input
                  type="number"
                  step="10000"
                  min="0"
                  value={packageInfo.declaredValue}
                  onChange={(e) => setPackageInfo({ ...packageInfo, declaredValue: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={packageInfo.isFragile}
                    onChange={(e) =>
                      setPackageInfo({ ...packageInfo, isFragile: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Hàng dễ vỡ (+15.000 đ bảo hiểm chuyên dụng)
                  </span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={packageInfo.isHazardous}
                    onChange={(e) =>
                      setPackageInfo({ ...packageInfo, isHazardous: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-800">Hàng nguy hiểm (Pin/Hóa chất)</span>
                </label>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ảnh chụp kiện hàng (Tùy chọn, tối đa 2 MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 transition cursor-pointer"
                />
                {photoName && <p className="text-xs text-slate-500 mt-1">Đã chọn: {photoName}</p>}
                {photoDataUrl && (
                  <div className="mt-3 relative w-36 h-28 rounded-xl overflow-hidden border border-slate-200">
                    <img
                      src={photoDataUrl}
                      alt="Xem trước kiện hàng"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Flight Calculation & Fee Summary (5 cols - Sticky) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
          <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-md shadow-emerald-900/5 space-y-6 border border-emerald-200/90">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono tracking-widest text-emerald-700 uppercase font-bold">
                  FLIGHT ESTIMATE &amp; SUMMARY
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Dự Toán Hành Trình Bay</h3>
            </div>

            {/* Route visual */}
            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                <div className="text-xs">
                  <div className="text-slate-500 font-medium">Xuất phát:</div>
                  <div className="text-slate-900 font-bold line-clamp-1">{sender.addressText}</div>
                  <div className="text-emerald-700 font-mono text-[11px] font-semibold">
                    {sender.latitude.toFixed(4)}, {sender.longitude.toFixed(4)}
                  </div>
                </div>
              </div>

              <div className="border-l-2 border-dashed border-emerald-300 ml-1.25 h-4"></div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 mt-1 shrink-0"></div>
                <div className="text-xs">
                  <div className="text-slate-500 font-medium">Đích đến:</div>
                  <div className="text-slate-900 font-bold line-clamp-1">{recipient.addressText || 'Chưa chọn địa chỉ nhận'}</div>
                  <div className="text-teal-700 font-mono text-[11px] font-semibold">
                    {recipient.latitude.toFixed(4)}, {recipient.longitude.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Flight Stats */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
                <div className="text-xs text-slate-500 font-medium">Khoảng cách bay</div>
                <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                  {distanceKm} km
                </div>
              </div>
              <div className="bg-teal-50/60 rounded-xl p-3 border border-teal-100">
                <div className="text-xs text-slate-500 font-medium">Thời gian bay ước tính</div>
                <div className="text-xl font-black text-teal-700 font-mono mt-0.5">
                  ~{estimatedFlightMinutes} phút
                </div>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="space-y-2.5 text-xs border-t border-slate-100 pt-4">
              <div className="flex justify-between text-slate-600">
                <span>Cước cơ bản cất cánh:</span>
                <span className="font-mono font-semibold text-slate-800">{calculatedFee.baseFee.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Phụ phí khối lượng ({packageInfo.weightKg || 0} kg):</span>
                <span className="font-mono font-semibold text-slate-800">
                  {calculatedFee.weightFee.toLocaleString('vi-VN')} đ
                </span>
              </div>
              {packageInfo.isFragile && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Bảo hiểm hàng dễ vỡ:</span>
                  <span className="font-mono">
                    +{calculatedFee.fragileFee.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 border-t border-emerald-100 pt-3">
                <span>Tổng cước phí giao:</span>
                <span className="text-emerald-700 font-mono text-lg font-extrabold">
                  {calculatedFee.total.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            {/* Action Submit */}
            <button
              type="submit"
              disabled={submitting || loadingData}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-emerald-200 disabled:to-teal-200 disabled:text-emerald-900/50 text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? 'Đang gửi yêu cầu đặt chuyến...' : 'Xác Nhận Tạo Đơn Giao Hàng'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

function formatAddress(address) {
  if (!address) return ''
  return [address.addressLine, address.ward, address.district, address.city]
    .filter(Boolean)
    .join(', ')
}
