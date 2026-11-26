import { useEffect, useState } from 'react'
import {
  INITIAL_DRONES,
  INITIAL_PENDING_ORDERS,
  INITIAL_STATIONS,
  abortFlightScheduleApi,
  assignFlightScheduleApi,
  fetchAllOrdersApi,
  fetchAvailableDronesApi,
  fetchFlightSchedulesApi,
  fetchLandingStationsApi,
  predictOrderEtaApi,
  reviewOrderApprovalApi,
} from './dispatchService'
import { AssignDroneModal } from './AssignDroneModal'

export function DispatcherDashboard() {
  const [orders, setOrders] = useState(INITIAL_PENDING_ORDERS)
  const [drones, setDrones] = useState(INITIAL_DRONES)
  const [stations, setStations] = useState(INITIAL_STATIONS)
  const [flightSchedules, setFlightSchedules] = useState([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null)
  const [abortingFlight, setAbortingFlight] = useState(null)
  const [abortReason, setAbortReason] = useState('')
  const [isAborting, setIsAborting] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [etaMap, setEtaMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function refreshData() {
    setLoading(true)
    setErrorMessage('')
    try {
      const [latestOrders, latestDrones, latestStations, latestSchedules] = await Promise.all([
        fetchAllOrdersApi(),
        fetchAvailableDronesApi(),
        fetchLandingStationsApi(),
        fetchFlightSchedulesApi(),
      ])
      setOrders(latestOrders)
      setDrones(latestDrones)
      setStations(latestStations)
      setFlightSchedules(latestSchedules)
    } catch (err) {
      setErrorMessage(`Lỗi làm mới dữ liệu điều phối: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshData()

    const handleOrderDelivered = (e) => {
      const fresh = Array.isArray(e?.detail) ? e.detail : []
      if (fresh.length > 0) {
        setActionMessage(
          `Khách hàng vừa xác nhận nhận hàng (${fresh[0].trackingNumber}) — Đã hoàn thành đơn & giải phóng Drone ${fresh[0].releasedDroneCode || 'DRN-VN-04'} về trạng thái IDLE.`
        )
      }
      refreshData()
    }

    window.addEventListener('sdd-order-delivered', handleOrderDelivered)
    const autoSync = setInterval(() => {
      Promise.all([
        fetchAllOrdersApi(),
        fetchAvailableDronesApi(),
        fetchFlightSchedulesApi(),
      ])
        .then(([latestOrders, latestDrones, latestSchedules]) => {
          setOrders(latestOrders)
          setDrones(latestDrones)
          setFlightSchedules(latestSchedules)
        })
        .catch(() => {})
    }, 5000)

    return () => {
      window.removeEventListener('sdd-order-delivered', handleOrderDelivered)
      clearInterval(autoSync)
    }
  }, [])

  const handlePredictEta = async (orderId) => {
    setErrorMessage('')
    try {
      const eta = await predictOrderEtaApi(orderId, 12)
      if (eta) {
        setEtaMap((prev) => ({ ...prev, [orderId]: eta }))
        setActionMessage(
          `Thời gian dự kiến đến nơi [${eta.source}]: ~${eta.estimatedMinutes} phút (${eta.distanceKm} km) — ${eta.note || 'Dự báo thành công'}`
        )
      } else {
        setActionMessage(`Thời gian dự kiến đến nơi: ~20 phút cho đơn ${String(orderId).slice(-6)}.`)
      }
    } catch (err) {
      setErrorMessage(`Lỗi tính thời gian dự kiến đến nơi: ${err.message}`)
    }
  }

  const filteredOrders = orders.filter((order) =>
    statusFilter === 'ALL' ? true : order.status === statusFilter
  )

  const handleReviewOrder = async (orderId, isApproved) => {
    setErrorMessage('')
    setActionMessage('')
    try {
      await reviewOrderApprovalApi({
        orderId,
        approvedByUserId: '11111111-1111-1111-1111-111111111002',
        isApproved,
        rejectionReason: isApproved ? null : 'Từ chối bởi chuyên viên điều phối chuyến bay.',
      })

      const newStatus = isApproved ? 'APPROVED' : 'REJECTED'
      setActionMessage(
        `Đơn hàng ${String(orderId).slice(-6).toUpperCase()} đã được chuyển sang ${newStatus}.`
      )
      await refreshData()
    } catch (err) {
      setErrorMessage(`Không thể cập nhật trạng thái đơn: ${err.message}`)
    }
  }

  const handleConfirmAssignDrone = async (schedulePayload) => {
    setIsSubmitting(true)
    setErrorMessage('')
    setActionMessage('')
    try {
      const res = await assignFlightScheduleApi(schedulePayload)
      setSelectedOrderForModal(null)
      setActionMessage(
        `Lập lịch bay thành công! Mã chuyến: ${res?.flightCode || 'FLT'} — Drone ${res?.droneCode || ''}.`
      )
      await refreshData()
    } catch (err) {
      setErrorMessage(`Lỗi gán lịch bay: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAbortFlight = async () => {
    if (!abortingFlight) return
    setIsAborting(true)
    setErrorMessage('')
    try {
      await abortFlightScheduleApi(
        abortingFlight.id,
        abortReason || 'Điều phối viên phát lệnh hủy chuyến khẩn cấp.'
      )
      setActionMessage(
        `Chuyến bay ${abortingFlight.flightCode} đã bị hủy khẩn cấp thành công. Thiết bị bay đã chuyển về trạng thái IDLE.`
      )
      setAbortingFlight(null)
      setAbortReason('')
      await refreshData()
    } catch (err) {
      setErrorMessage(`Lỗi khi hủy chuyến bay: ${err.message}`)
    } finally {
      setIsAborting(false)
    }
  }

  const pendingCount = orders.filter((o) => o.status === 'PENDING_APPROVAL').length
  const approvedCount = orders.filter((o) => o.status === 'APPROVED').length
  const scheduledCount = orders.filter((o) => o.status === 'SCHEDULED').length
  const idleDroneCount = drones.filter((d) => d.status === 'IDLE').length

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-slate-900 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Trung Tâm Điều Phối Chuyến Bay Drone
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Đang đồng bộ...' : 'Làm Mới Dữ Liệu'}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-amber-200 transition">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            Chờ duyệt (Pending)
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">{pendingCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-200 transition">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Đã duyệt - Chờ gán Drone
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{approvedCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-teal-200 transition">
          <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
            Lịch bay đã lên (Scheduled)
          </div>
          <div className="text-2xl font-black text-teal-700 font-mono mt-1">
            {scheduledCount}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-300 transition">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Drone Sẵn Sàng (IDLE)
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {idleDroneCount} / {drones.length}
          </div>
        </div>
      </div>

      {/* Banner notifications */}
      {actionMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage('')}
            className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
          >
            x
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-xs font-semibold flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
          >
            x
          </button>
        </div>
      )}

      {/* Orders Approval & Dispatch Queue */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Hàng Đợi Duyệt Đơn &amp; Điều Phối Chuyến Bay
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiểm tra thông số bưu kiện, duyệt đơn hợp lệ và phân bổ lịch bay với thiết bị bay phù
              hợp.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold border border-slate-200/70">
            {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'REJECTED'].map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setStatusFilter(filterKey)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === filterKey
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filterKey === 'ALL'
                  ? 'Tất cả'
                  : filterKey === 'PENDING_APPROVAL'
                    ? 'Chờ duyệt'
                    : filterKey === 'APPROVED'
                      ? 'Đã duyệt'
                      : filterKey === 'SCHEDULED'
                        ? 'Đã xếp lịch'
                        : 'Từ chối'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                <th className="py-3 px-4">Mã Đơn / Ngày Tạo</th>
                <th className="py-3 px-4">Lộ Trình Giao Hàng</th>
                <th className="py-3 px-4">Tải Trọng</th>
                <th className="py-3 px-4">Phương Thức</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    Không có đơn hàng nào trong hàng đợi này.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900 tracking-tight">
                        {order.trackingNumber || String(order.id).slice(0, 8)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{order.createdAt}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="text-slate-900 font-medium truncate">
                        Gửi: {order.senderAddress}
                      </div>
                      <div className="text-slate-500 truncate mt-0.5">
                        Nhận: {order.recipientName} ({order.recipientAddress})
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      <span className="font-bold text-slate-900">
                        {order.totalWeightKg.toFixed(2)} kg
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      <div>{order.pickupMethod}</div>
                      <div className="text-slate-400">→ {order.deliveryMethod}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          order.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : order.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : order.status === 'SCHEDULED'
                                ? 'bg-teal-50 text-teal-800 border-teal-200'
                                : order.status === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            order.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-500'
                              : order.status === 'APPROVED'
                                ? 'bg-emerald-500'
                                : order.status === 'SCHEDULED'
                                  ? 'bg-teal-500'
                                  : 'bg-slate-400'
                          }`}
                        ></span>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {order.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReviewOrder(order.id, true)}
                            className="px-2.5 py-1 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                          >
                            Duyệt Đơn
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewOrder(order.id, false)}
                            className="px-2.5 py-1 rounded-lg font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                          >
                            Từ Chối
                          </button>
                        </>
                      )}

                      {order.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForModal(order)}
                          className="px-3 py-1 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                        >
                          Gán Drone
                        </button>
                      )}

                      {order.status === 'SCHEDULED' && (
                        <span className="text-slate-400 font-mono text-[11px]">Đã lên lịch</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePredictEta(order.id)}
                        className="px-2.5 py-1 rounded-lg font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer whitespace-nowrap"
                      >
                        {etaMap[order.id]
                          ? `Dự kiến: ${etaMap[order.id].estimatedMinutes} phút`
                          : 'Thời gian dự kiến đến nơi'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scheduled Flight Missions Table */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Lịch Trình Chuyến Bay Đã Xếp
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Danh sách các chuyến bay đã điều phối thành công và trạng thái thực hiện hành lang bay.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            {flightSchedules.length} nhiệm vụ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                <th className="py-3 px-4">Mã Chuyến Bay</th>
                <th className="py-3 px-4">Drone Thực Hiện</th>
                <th className="py-3 px-4">Cự Ly Bay</th>
                <th className="py-3 px-4">Khởi Hành Dự Kiến</th>
                <th className="py-3 px-4">Hạ Cánh Dự Kiến</th>
                <th className="py-3 px-4">Trạng Thái Chuyến</th>
                <th className="py-3 px-4 text-right">Lệnh Khẩn Cấp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {flightSchedules.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Chưa có chuyến bay nào được xếp lịch.
                  </td>
                </tr>
              ) : (
                flightSchedules.map((flt) => (
                  <tr key={flt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                      {flt.flightCode}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {flt.droneCode}
                    </td>
                    <td className="py-3 px-4 font-mono">{flt.flightDistanceKm} km</td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(flt.scheduledDeparture).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(flt.scheduledArrival).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          flt.status === 'IN_PROGRESS'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : flt.status === 'COMPLETED'
                              ? 'bg-teal-50 text-teal-800 border-teal-200'
                              : flt.status === 'ABORTED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            flt.status === 'IN_PROGRESS'
                              ? 'bg-emerald-500 animate-pulse'
                              : flt.status === 'COMPLETED'
                                ? 'bg-teal-500'
                                : flt.status === 'ABORTED'
                                  ? 'bg-rose-500'
                                  : 'bg-slate-400'
                          }`}
                        ></span>
                        {flt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {flt.status === 'IN_PROGRESS' || flt.status === 'SCHEDULED' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAbortingFlight(flt)
                            setAbortReason('')
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                        >
                          Hủy Khẩn Cấp
                        </button>
                      ) : flt.status === 'ABORTED' ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-semibold text-rose-600">Đã Hủy</span>
                          {flt.abortReason && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={flt.abortReason}>
                              {flt.abortReason}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drone Fleet Status Section */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Đội Bay Không Người Lái (Drone Fleet)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dung lượng pin, trần tải trọng và trạng thái sẵn sàng cất cánh của từng thiết bị.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                <th className="py-3 px-4">Mã Drone</th>
                <th className="py-3 px-4">Model Thiết Bị</th>
                <th className="py-3 px-4">Tải Trọng Tối Đa</th>
                <th className="py-3 px-4">Tầm Bay Tối Đa</th>
                <th className="py-3 px-4">Mức Pin Hiện Tại</th>
                <th className="py-3 px-4">Trạng Thái Hoạt Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {drones.map((drone) => (
                <tr key={drone.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{drone.droneCode}</td>
                  <td className="py-3 px-4 text-slate-700">{drone.model}</td>
                  <td className="py-3 px-4 font-mono font-semibold">
                    {drone.maxPayloadKg.toFixed(2)} kg
                  </td>
                  <td className="py-3 px-4 font-mono">{drone.maxFlightRangeKm.toFixed(1)} km</td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        drone.batteryPercentage > 60
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : drone.batteryPercentage > 30
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {drone.batteryPercentage}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        drone.status === 'IDLE'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : drone.status === 'ASSIGNED'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          drone.status === 'IDLE' ? 'bg-emerald-500' : 'bg-teal-500'
                        }`}
                      ></span>
                      {drone.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Assign Drone */}
      {selectedOrderForModal && (
        <AssignDroneModal
          order={selectedOrderForModal}
          drones={drones}
          stations={stations}
          onClose={() => setSelectedOrderForModal(null)}
          onConfirmAssign={handleConfirmAssignDrone}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Modal Hủy Chuyến Bay Khẩn Cấp */}
      {abortingFlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-black text-rose-700 uppercase tracking-widest">
                  EMERGENCY MISSION ABORT
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  Lệnh Hủy Chuyến Bay Khẩn Cấp
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white text-rose-700 border border-rose-200">
                {abortingFlight.flightCode}
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Drone thực hiện:</span>
                  <span className="font-mono font-bold text-slate-900">{abortingFlight.droneCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Cự ly lộ trình:</span>
                  <span className="font-mono font-bold text-slate-900">{abortingFlight.flightDistanceKm} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Trạng thái hiện tại:</span>
                  <span className="font-mono font-bold text-rose-700">{abortingFlight.status}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Chọn Lý Do Khẩn Cấp Nhanh:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Thời tiết xấu / gió giật nguy hiểm',
                    'Sự cố pin tụt nhanh / nhiệt độ cao',
                    'Xung đột không phận hành lang',
                    'Lệnh từ cơ quan điều phối không lưu',
                    'Kiện hàng bất thường / nghi ngờ lỏng khóa',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAbortReason(preset)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        abortReason === preset
                          ? 'bg-rose-100 border-rose-300 text-rose-800 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chi Tiết Lý Do Hủy Chuyến:
                </label>
                <textarea
                  value={abortReason}
                  onChange={(e) => setAbortReason(e.target.value)}
                  placeholder="Ghi rõ lý do điều phối viên kích hoạt lệnh hủy chuyến bay..."
                  rows={3}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium">
                Cảnh báo: Hành động này sẽ lập tức ra lệnh Drone quay về trạm gần nhất hoặc hạ cánh an toàn.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAbortingFlight(null)}
                disabled={isAborting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleAbortFlight}
                disabled={isAborting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isAborting ? 'Đang Phát Lệnh Hủy...' : 'Xác Nhận Hủy Khẩn Cấp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DispatcherDashboard
