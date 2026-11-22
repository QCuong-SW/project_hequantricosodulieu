import { useEffect, useMemo, useState } from 'react'
import RealGoogleMapView from '../../components/common/RealGoogleMapView'
import {
  cancelDeliveryOrder,
  getConfiguredCustomerId,
  getCustomerOrders,
  payDeliveryOrder,
} from './orderService'

export const ORDER_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  SCHEDULED: 'Đã xếp lịch bay',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERING: 'Đang tiếp cận giao',
  ARRIVED: 'Đã đến bãi đáp',
  DELIVERED: 'Giao thành công',
  DELIVERY_FAILED: 'Giao thất bại',
  REJECTED: 'Từ chối duyệt',
  CANCELLED: 'Đã hủy đơn',
}

const ORDER_TIMELINE_STEPS = [
  { key: 'DRAFT', label: 'Tạo đơn' },
  { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'SCHEDULED', label: 'Xếp lịch' },
  { key: 'IN_TRANSIT', label: 'Đang bay' },
  { key: 'DELIVERED', label: 'Đã giao' },
]

function getStepIndex(status) {
  if (['DELIVERED'].includes(status)) return 5
  if (['IN_TRANSIT', 'DELIVERING', 'ARRIVED'].includes(status)) return 4
  if (['SCHEDULED'].includes(status)) return 3
  if (['APPROVED'].includes(status)) return 2
  if (['PENDING_APPROVAL'].includes(status)) return 1
  return 0
}

const CANCELLABLE_STATUSES = new Set(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'])

export default function OrderListPage({ onViewOrder }) {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [cancellingOrder, setCancellingOrder] = useState(null)
  const [payingOrder, setPayingOrder] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('VNPAY_QR')
  const [cancelReason, setCancelReason] = useState('Khách hàng yêu cầu hủy đơn trước khi bay.')
  const [isCancelling, setIsCancelling] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [copiedTracking, setCopiedTracking] = useState('')

  async function loadOrders() {
    setLoading(true)
    setError('')
    try {
      const customerId = getConfiguredCustomerId()
      const items = await getCustomerOrders(customerId)
      setOrders(Array.isArray(items) ? items : [])
    } catch (err) {
      setError(err.message || 'Không tải được lịch sử đơn hàng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesSearch =
        !keyword ||
        String(order.trackingNumber || order.id || '').toLowerCase().includes(keyword) ||
        String(order.addressSnapshot?.recipientName || '').toLowerCase().includes(keyword) ||
        String(order.addressSnapshot?.recipientAddressText || '').toLowerCase().includes(keyword)
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orders, search, statusFilter])

  // Statistics KPI
  const stats = useMemo(() => {
    const total = orders.length
    const activeFlights = orders.filter((o) =>
      ['IN_TRANSIT', 'DELIVERING', 'ARRIVED'].includes(o.status)
    ).length
    const delivered = orders.filter((o) => o.status === 'DELIVERED').length
    const pendingOrScheduled = orders.filter((o) =>
      ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'].includes(o.status)
    ).length
    return { total, activeFlights, delivered, pendingOrScheduled }
  }, [orders])

  async function handleConfirmCancel(e) {
    e.preventDefault()
    if (!cancellingOrder) return

    setIsCancelling(true)
    setError('')
    setSuccess('')
    try {
      await cancelDeliveryOrder(
        cancellingOrder.id,
        cancellingOrder.concurrencyVersion || 0,
        cancelReason
      )
      setSuccess(
        `Đã hủy thành công đơn hàng ${cancellingOrder.trackingNumber || cancellingOrder.id}.`
      )
      setCancellingOrder(null)
      setCancelReason('Khách hàng yêu cầu hủy đơn trước khi bay.')
      await loadOrders()
    } catch (err) {
      setError(`Hủy đơn thất bại: ${err.message}`)
    } finally {
      setIsCancelling(false)
    }
  }

  async function handleConfirmPayment(e) {
    e.preventDefault()
    if (!payingOrder) return

    setIsPaying(true)
    setError('')
    setSuccess('')
    try {
      await payDeliveryOrder(payingOrder.id)
      setSuccess(
        `Thanh toán thành công ${formatCurrency(payingOrder.shippingFee)} cho đơn ${payingOrder.trackingNumber || payingOrder.id} qua ${paymentMethod}.`
      )
      setPayingOrder(null)
      await loadOrders()
    } catch (err) {
      setError(`Thanh toán thất bại: ${err.message}`)
    } finally {
      setIsPaying(false)
    }
  }

  function copyToClipboard(text) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedTracking(text)
    setTimeout(() => setCopiedTracking(''), 2000)
  }

  return (
    <section className="max-w-6xl mx-auto space-y-6 text-slate-900 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Lịch Sử Đơn Hàng Drone
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý hành trình giao hàng, thanh toán cước phí và hủy đơn trước khi cất cánh.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Đang đồng bộ...' : 'Làm Mới Danh Sách'}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-200 transition">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tổng đơn hàng
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-200 transition">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Đang bay / Tiếp cận
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {stats.activeFlights}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-amber-200 transition">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            Chờ duyệt / Lên lịch
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">
            {stats.pendingOrScheduled}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-200 transition">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Giao thành công
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {stats.delivered}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-medium">
          <div className="font-bold text-rose-900 mb-0.5">Thông báo lỗi:</div>
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-medium">
          <div className="font-bold text-emerald-900 mb-0.5">Thao tác thành công!</div>
          {success}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm theo mã vận đơn, tên hoặc địa chỉ người nhận..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition shadow-xs"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition shadow-xs"
          >
            <option value="ALL">Tất cả trạng thái (11 trạng thái)</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label} ({val})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium">Đang tải danh sách đơn hàng từ máy chủ...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-base font-semibold text-slate-700">Không tìm thấy đơn hàng nào</p>
            <p className="text-xs text-slate-400 mt-1">
              Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mã Vận Đơn</th>
                  <th className="py-3.5 px-4">Ngày Tạo</th>
                  <th className="py-3.5 px-4">Tuyến Giao</th>
                  <th className="py-3.5 px-4">Khối Lượng</th>
                  <th className="py-3.5 px-4">Cước Phí &amp; Thanh Toán</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const tracking = order.trackingNumber || shortId(order.id)
                  const canCancel = CANCELLABLE_STATUSES.has(order.status)
                  const isPaid = order.paymentStatus === 'PAID'
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 tracking-tight">
                            {tracking}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(tracking)}
                            title="Sao chép mã"
                            className="text-[10px] text-emerald-600 hover:text-emerald-800 font-mono underline cursor-pointer"
                          >
                            {copiedTracking === tracking ? 'Đã chép' : 'Chép'}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-xs max-w-xs truncate text-slate-700">
                        <span className="font-medium text-slate-900">
                          {order.addressSnapshot?.recipientName || 'Khách nhận'}
                        </span>
                        <div className="text-slate-400 truncate text-[11px]">
                          {order.addressSnapshot?.recipientAddressText || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono font-semibold text-slate-700">
                        {order.totalWeightKg ?? totalWeight(order)} kg
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-mono font-bold text-slate-900">
                          {formatCurrency(order.shippingFee)}
                        </div>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isPaid ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {!isPaid && order.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => setPayingOrder(order)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                          >
                            Thanh Toán
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onViewOrder ? onViewOrder(order) : setSelectedOrder(order)
                          }
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                        >
                          Chi Tiết
                        </button>
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => setCancellingOrder(order)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                          >
                            Hủy Đơn
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: View Order Details with Stepper Timeline */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
                  ORDER SPECIFICATION &amp; TRACKING
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedOrder.trackingNumber || selectedOrder.id}
                </h3>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>

            {/* Stepper Timeline */}
            <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-3">
                Tiến Trình Hành Trình Đơn Hàng:
              </div>
              <div className="flex items-center justify-between relative">
                {ORDER_TIMELINE_STEPS.map((step, idx) => {
                  const currentIdx = getStepIndex(selectedOrder.status)
                  const isDone = idx <= currentIdx
                  const isCurrent = idx === currentIdx
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center text-center relative z-10">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                          isCurrent
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110 shadow-xs'
                            : isDone
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span
                        className={`text-[10px] mt-1 font-semibold truncate max-w-[80px] ${
                          isCurrent ? 'text-emerald-800 font-bold' : isDone ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Điểm Xuất Phát</div>
                <div className="font-semibold text-slate-900">
                  {selectedOrder.addressSnapshot?.senderName || 'Người gửi'}
                </div>
                <div className="text-slate-600">
                  {selectedOrder.addressSnapshot?.senderAddressText || '—'}
                </div>
                <div className="font-mono text-slate-400 text-[11px]">
                  Tọa độ: {selectedOrder.addressSnapshot?.senderLatitude},{' '}
                  {selectedOrder.addressSnapshot?.senderLongitude}
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Điểm Đích</div>
                <div className="font-semibold text-slate-900">
                  {selectedOrder.addressSnapshot?.recipientName || 'Người nhận'}
                </div>
                <div className="text-slate-600">
                  {selectedOrder.addressSnapshot?.recipientAddressText || '—'}
                </div>
                <div className="font-mono text-slate-400 text-[11px]">
                  Tọa độ: {selectedOrder.addressSnapshot?.recipientLatitude},{' '}
                  {selectedOrder.addressSnapshot?.recipientLongitude}
                </div>
              </div>
            </div>

            {/* Real Google Maps Route Illustration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🗺️ Bản Đồ Lộ Trình Google Maps Thực Tế</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    CALL API GOOGLE
                  </span>
                </div>
                {onViewOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewOrder(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <span>Radar Trực Tiếp &rarr;</span>
                  </button>
                )}
              </div>

              <RealGoogleMapView
                origin={{
                  lat: Number(selectedOrder.addressSnapshot?.senderLatitude) || 10.771595,
                  lng: Number(selectedOrder.addressSnapshot?.senderLongitude) || 106.70475,
                  label: selectedOrder.addressSnapshot?.senderAddressText || 'Điểm cất cánh',
                }}
                destination={{
                  lat: Number(selectedOrder.addressSnapshot?.recipientLatitude) || 10.841128,
                  lng: Number(selectedOrder.addressSnapshot?.recipientLongitude) || 106.809883,
                  label: selectedOrder.addressSnapshot?.recipientAddressText || 'Điểm giao hàng',
                }}
                droneCode={selectedOrder.droneCode || 'DRN-VN-04'}
                heightClass="h-56 md:h-64"
                showControls={true}
                showTelemetryOverlay={false}
              />
            </div>

            {/* Packages list */}
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Danh Sách Kiện Hàng ({selectedOrder.packages?.length || 1})
              </div>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                {(selectedOrder.packages || []).map((pkg, idx) => (
                  <div key={pkg.id || idx} className="p-3 bg-white flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-900">{pkg.description}</div>
                      <div className="text-slate-500 text-[11px]">
                        Kích thước: {pkg.lengthCm}x{pkg.widthCm}x{pkg.heightCm} cm — Khối lượng:{' '}
                        {pkg.weightKg} kg
                      </div>
                      <div className="flex gap-2 mt-1">
                        {pkg.isFragile && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Hàng dễ vỡ
                          </span>
                        )}
                        {pkg.isHazardous && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                            Hàng nguy hiểm
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900">
                        {formatCurrency(pkg.declaredValue)}
                      </div>
                      <div className="text-[10px] text-slate-400">Khai báo</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
              <span className="text-slate-500">
                Phiên bản đồng thời: #{selectedOrder.concurrencyVersion} · Trạng thái cước:{' '}
                <strong>{selectedOrder.paymentStatus || 'PENDING'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Payment Simulation */}
      {payingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmPayment}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200"
          >
            <div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
                SECURE PAYMENT GATEWAY (SIMULATOR)
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">Thanh Toán Cước Phí Vận Chuyển</h3>
              <p className="text-xs text-slate-500 mt-1">
                Mã đơn hàng: <strong className="font-mono text-slate-900">{payingOrder.trackingNumber || payingOrder.id}</strong>
              </p>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100 text-center space-y-1">
              <div className="text-xs text-emerald-800 font-semibold">Số tiền cần thanh toán:</div>
              <div className="text-2xl font-black font-mono text-emerald-700">
                {formatCurrency(payingOrder.shippingFee)}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                Chọn phương thức thanh toán:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'VNPAY_QR', name: 'VNPay QR' },
                  { key: 'MOMO', name: 'Ví MoMo' },
                  { key: 'BANK_CARD', name: 'Thẻ ATM / Visa' },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMethod(m.key)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      paymentMethod === m.key
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayingOrder(null)}
                disabled={isPaying}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPaying}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {isPaying ? 'Đang xử lý...' : 'Xác Nhận Thanh Toán'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Confirm Order Cancellation */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmCancel}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200"
          >
            <div>
              <span className="text-[10px] font-mono font-bold text-rose-600 uppercase tracking-wider">
                CONFIRM CANCELLATION
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">Xác Nhận Hủy Đơn Hàng?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Đơn hàng{' '}
                <strong className="text-slate-900 font-mono">
                  {cancellingOrder.trackingNumber || cancellingOrder.id}
                </strong>{' '}
                sẽ chuyển sang trạng thái <strong>CANCELLED</strong>. Drone và bãi đáp (nếu đã xếp
                lịch) sẽ được giải phóng ngay lập tức.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Lý do hủy đơn *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
                maxLength={500}
                rows="3"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'Đang hủy...' : 'Đồng Ý Hủy Đơn'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function StatusBadge({ status }) {
  const label = ORDER_STATUS_LABELS[status] || status || 'Không rõ'

  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200'
  let dotColor = 'bg-slate-400'

  switch (status) {
    case 'DRAFT':
      badgeColor = 'bg-slate-100 text-slate-700 border-slate-300'
      dotColor = 'bg-slate-400'
      break
    case 'PENDING_APPROVAL':
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200'
      dotColor = 'bg-amber-500'
      break
    case 'APPROVED':
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200'
      dotColor = 'bg-emerald-500'
      break
    case 'SCHEDULED':
      badgeColor = 'bg-teal-50 text-teal-800 border-teal-200'
      dotColor = 'bg-teal-500'
      break
    case 'IN_TRANSIT':
      badgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300'
      dotColor = 'bg-emerald-600 animate-pulse'
      break
    case 'DELIVERING':
      badgeColor = 'bg-teal-100 text-teal-900 border-teal-300'
      dotColor = 'bg-teal-600 animate-pulse'
      break
    case 'ARRIVED':
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200'
      dotColor = 'bg-emerald-500'
      break
    case 'DELIVERED':
      badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300'
      dotColor = 'bg-emerald-600'
      break
    case 'DELIVERY_FAILED':
      badgeColor = 'bg-orange-50 text-orange-800 border-orange-200'
      dotColor = 'bg-orange-500'
      break
    case 'REJECTED':
      badgeColor = 'bg-rose-50 text-rose-800 border-rose-200'
      dotColor = 'bg-rose-500'
      break
    case 'CANCELLED':
      badgeColor = 'bg-red-50 text-red-800 border-red-200'
      dotColor = 'bg-red-500'
      break
    default:
      break
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeColor}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      {label}
    </span>
  )
}

function shortId(id) {
  return id ? String(id).slice(0, 8).toUpperCase() : '—'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

function formatCurrency(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('vi-VN')} đ` : '—'
}

function totalWeight(order) {
  return (order.packages || []).reduce((sum, item) => sum + Number(item.weightKg || 0), 0)
}
