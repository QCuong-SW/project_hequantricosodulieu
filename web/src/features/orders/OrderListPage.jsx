import { useEffect, useMemo, useState } from 'react'
import { getConfiguredCustomerId, getCustomerOrders } from './orderService'
import './orders.css'

const STATUS_LABELS = {
  PENDING_APPROVAL: 'Chờ duyệt',
  PENDING: 'Chờ xử lý',
  APPROVED: 'Đã duyệt',
  PROCESSING: 'Đang xử lý',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  REJECTED: 'Từ chối',
}

export default function OrderListPage({ onViewOrder }) {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => { loadOrders() }, [])

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesSearch = !keyword ||
        String(order.trackingNumber || order.id || '').toLowerCase().includes(keyword)
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orders, search, statusFilter])

  return (
    <section className="orders-page">
      <div className="orders-heading orders-heading-row">
        <div>
          <p className="orders-eyebrow">CUSTOMER / ORDERS</p>
          <h1>Lịch sử đơn hàng</h1>
          <p className="orders-subtitle">Theo dõi các đơn giao hàng bạn đã tạo.</p>
        </div>
        <button type="button" className="orders-button orders-button-secondary" onClick={loadOrders} disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div className="orders-toolbar">
        <input aria-label="Tìm mã đơn hàng" placeholder="Tìm theo mã đơn..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Lọc trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error && <div className="orders-alert orders-alert-error" role="alert">{error}</div>}
      <div className="orders-card orders-table-wrap">
        {loading ? <p className="orders-empty">Đang tải lịch sử đơn hàng...</p> :
          filteredOrders.length === 0 ? <p className="orders-empty">Không tìm thấy đơn hàng nào.</p> : (
            <table className="orders-table">
              <thead>
                <tr><th>Mã đơn</th><th>Ngày tạo</th><th>Khối lượng</th><th>Phí giao hàng</th><th>Trạng thái</th><th></th></tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.trackingNumber || shortId(order.id)}</strong></td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>{order.totalWeightKg ?? totalWeight(order)} kg</td>
                    <td>{formatCurrency(order.shippingFee)}</td>
                    <td><span className={`orders-status ${statusClass(order.status)}`}>{STATUS_LABELS[order.status] || order.status || 'Không rõ'}</span></td>
                    <td><button className="orders-link-button" type="button" onClick={() => onViewOrder ? onViewOrder(order) : window.alert(orderSummary(order))}>Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </section>
  )
}

function shortId(id) { return id ? String(id).slice(0, 8).toUpperCase() : '—' }
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN')
}
function formatCurrency(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('vi-VN')} đ` : '—'
}
function totalWeight(order) {
  return (order.packages || []).reduce((sum, item) => sum + Number(item.weightKg || 0), 0)
}
function statusClass(status = '') {
  if (['DELIVERED', 'APPROVED'].includes(status)) return 'status-success'
  if (['CANCELLED', 'REJECTED'].includes(status)) return 'status-danger'
  if (['IN_TRANSIT', 'PICKED_UP', 'PROCESSING'].includes(status)) return 'status-info'
  return 'status-pending'
}
function orderSummary(order) {
  return [
    `Mã đơn: ${order.trackingNumber || order.id}`,
    `Trạng thái: ${STATUS_LABELS[order.status] || order.status}`,
    `Ngày tạo: ${formatDate(order.createdAt)}`,
    `Tổng khối lượng: ${order.totalWeightKg ?? totalWeight(order)} kg`,
    `Địa chỉ nhận: ${order.addressSnapshot?.recipientAddressText || '—'}`,
  ].join('\\n')
}