import { useMemo, useState } from 'react'

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 10
  const R = 6371
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

export function AssignDroneModal({
  order,
  drones = [],
  stations = [],
  onClose,
  onConfirmAssign,
  isSubmitting = false,
}) {
  const eligibleDrones = useMemo(() => {
    return drones.filter(
      (d) =>
        d.status === 'IDLE' &&
        d.maxPayloadKg >= order.totalWeightKg &&
        d.batteryPercentage >= 30
    )
  }, [drones, order.totalWeightKg])

  const [selectedDroneId, setSelectedDroneId] = useState(eligibleDrones[0]?.id || '')
  const [originStationId, setOriginStationId] = useState(stations[0]?.id || '')
  const [destinationStationId, setDestinationStationId] = useState(
    stations[1]?.id || stations[0]?.id || ''
  )
  const [targetAltitudeMeter, setTargetAltitudeMeter] = useState('65')
  const [errorMsg, setErrorMsg] = useState('')

  // Selected station objects
  const originStation = stations.find((s) => s.id === originStationId)
  const destStation = stations.find((s) => s.id === destinationStationId)

  // Live distance calculation
  const computedDistanceKm = useMemo(() => {
    if (!originStation || !destStation) return 12.5
    const dist = calculateDistanceKm(
      originStation.latitude,
      originStation.longitude,
      destStation.latitude,
      destStation.longitude
    )
    return dist > 0 ? dist : 5.0
  }, [originStation, destStation])

  const [flightDistanceKm, setFlightDistanceKm] = useState('')
  const effectiveDistance = flightDistanceKm ? parseFloat(flightDistanceKm) : computedDistanceKm

  if (!order) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!selectedDroneId) {
      setErrorMsg('Vui lòng chọn một Drone khả dụng (Trạng thái IDLE, Pin >= 30%).')
      return
    }

    if (!originStationId || !destinationStationId) {
      setErrorMsg('Vui lòng chọn trạm xuất phát và trạm hạ cánh.')
      return
    }

    if (originStationId === destinationStationId) {
      setErrorMsg('Trạm cất cánh và trạm hạ cánh phải khác nhau.')
      return
    }

    const distance = effectiveDistance
    const altitude = parseFloat(targetAltitudeMeter)

    if (Number.isNaN(distance) || distance <= 0) {
      setErrorMsg('Khoảng cách bay phải lớn hơn 0 km.')
      return
    }

    if (Number.isNaN(altitude) || altitude < 10 || altitude > 120) {
      setErrorMsg('Độ cao hành trình an toàn phải từ 10m đến 120m.')
      return
    }

    const waypoints = [
      {
        sequenceOrder: 1,
        latitude: Number(originStation?.latitude) || 10.771595,
        longitude: Number(originStation?.longitude) || 106.70475,
        targetAltitudeMeter: altitude,
        estimatedSpeedKmh: 45,
      },
      {
        sequenceOrder: 2,
        latitude: Number(destStation?.latitude) || 10.841128,
        longitude: Number(destStation?.longitude) || 106.809883,
        targetAltitudeMeter: altitude,
        estimatedSpeedKmh: 50,
      },
    ]

    onConfirmAssign({
      orderId: order.id,
      droneId: selectedDroneId,
      originStationId,
      destinationStationId,
      dispatcherId: '11111111-1111-1111-1111-111111111002',
      orderWeightKg: order.totalWeightKg,
      flightDistanceKm: distance,
      scheduledDeparture: new Date(Date.now() + 15 * 60000).toISOString(),
      waypoints,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
              FLIGHT DISPATCH CONFIGURATION
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Gán Drone &amp; Lập Lịch Bay Chuyên Dụng
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold transition cursor-pointer"
          >
            x
          </button>
        </div>

        {/* Order summary pill */}
        <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Mã vận đơn:</span>
            <span className="font-mono font-bold text-slate-900">{order.trackingNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Trọng lượng bưu kiện:</span>
            <span className="font-mono font-bold text-emerald-800">
              {order.totalWeightKg.toFixed(2)} kg (Giới hạn Drone: 5.0 kg)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Điểm giao đến:</span>
            <span className="text-slate-800 font-medium truncate max-w-xs">
              {order.recipientName} ({order.recipientAddress})
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Drone Selection */}
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Chọn Thiết Bị Drone Khả Dụng (Tải trọng &gt;= {order.totalWeightKg} kg) *
            </label>
            {eligibleDrones.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                Không tìm thấy Drone nào ở trạng thái IDLE đủ tải trọng ({order.totalWeightKg} kg)
                hoặc mức pin &gt;= 30%. Vui lòng chờ các drone hoàn thành nhiệm vụ hoặc sạc lại.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {eligibleDrones.map((drone) => {
                  const isSelected = selectedDroneId === drone.id
                  return (
                    <div
                      key={drone.id}
                      onClick={() => setSelectedDroneId(drone.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {drone.droneCode}
                          </span>
                          <span className="text-slate-500 text-[11px]">{drone.model}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tải tối đa: <strong>{drone.maxPayloadKg} kg</strong> — Tầm bay:{' '}
                          <strong>{drone.maxFlightRangeKm} km</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                            drone.batteryPercentage > 50
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Pin: {drone.batteryPercentage}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stations Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                Trạm Cất Cánh (Origin) *
              </label>
              <select
                value={originStationId}
                onChange={(e) => setOriginStationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              >
                {stations.map((stn) => (
                  <option key={stn.id} value={stn.id}>
                    [{stn.stationCode}] {stn.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                Trạm Tiếp Đất (Destination) *
              </label>
              <select
                value={destinationStationId}
                onChange={(e) => setDestinationStationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              >
                {stations.map((stn) => (
                  <option key={stn.id} value={stn.id}>
                    [{stn.stationCode}] {stn.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Flight Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                Khoảng Cách Lộ Trình (km)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder={computedDistanceKm.toString()}
                value={flightDistanceKm}
                onChange={(e) => setFlightDistanceKm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Tự tính theo GPS: {computedDistanceKm} km
              </span>
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                Độ Cao Hành Trình (10m - 120m)
              </label>
              <input
                type="number"
                min="10"
                max="120"
                value={targetAltitudeMeter}
                onChange={(e) => setTargetAltitudeMeter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Hành lang bay nội đô TP.HCM
              </span>
            </div>
          </div>

          {/* Waypoints preview */}
          <div className="p-3 bg-[#0B1512] text-white rounded-xl font-mono text-[11px] space-y-1 border border-emerald-950">
            <div className="text-emerald-400 uppercase tracking-widest text-[10px] font-bold">
              Waypoints Corridors:
            </div>
            <div>
              WP1: {originStation?.stationCode || 'STN-ORG'} (Alt: {targetAltitudeMeter}m, Speed: 45
              km/h)
            </div>
            <div>
              WP2: {destStation?.stationCode || 'STN-DST'} (Alt: {targetAltitudeMeter}m, Speed: 50
              km/h)
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={eligibleDrones.length === 0 || isSubmitting}
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Đang kích hoạt lịch bay...' : 'Xác Nhận Lên Lịch Bay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
