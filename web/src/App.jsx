import { useEffect, useState } from 'react'
import MainLayout from './layouts/MainLayout'
import { ROLES } from './navigation/navigationConfig'
import { ROLE_ACCOUNTS } from './config/apiConfig'
import { loginAsRole, loginWithCredentials, getAccessToken } from './features/dashboard/authBridge'
import LogisticsDashboard from './features/dashboard/LogisticsDashboard'
import CreateOrderPage from './features/orders/CreateOrderPage'
import OrderListPage from './features/orders/OrderListPage'
import { getMyAddresses, createMyAddress } from './features/orders/orderService'
import DispatcherDashboard from './features/dispatch/DispatcherDashboard'
import StationOperatorView from './features/station/StationOperatorView'
import LiveDroneMapView from './features/station/LiveDroneMapView'
import './App.css'

function SavedAddressesPage() {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    addressLine: '',
    ward: '',
    district: '',
    city: 'TP. Hồ Chí Minh',
    latitude: '10.7769',
    longitude: '106.7009',
    isDefault: false,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const items = await getMyAddresses()
    setAddresses(items)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await createMyAddress({
        addressLine: form.addressLine.trim(),
        ward: form.ward.trim() || null,
        district: form.district.trim() || null,
        city: form.city.trim(),
        latitude: Number(form.latitude || 10.7769),
        longitude: Number(form.longitude || 106.7009),
        isDefault: form.isDefault,
      })
      setMessage('Đã lưu địa chỉ mới thành công!')
      setForm({
        addressLine: '',
        ward: '',
        district: '',
        city: 'TP. Hồ Chí Minh',
        latitude: '10.7769',
        longitude: '106.7009',
        isDefault: false,
      })
      await load()
    } catch (err) {
      setError(err.message || 'Không thể thêm địa chỉ.')
    }
  }

  return (
    <section className="orders-page">
      <div className="orders-heading">
        <div>
          <p className="orders-eyebrow">CUSTOMER / ADDRESS BOOK</p>
          <h1>Sổ địa chỉ giao nhận</h1>
          <p className="orders-subtitle">Quản lý danh sách địa chỉ và tọa độ GPS phục vụ giao hàng bằng Drone.</p>
        </div>
      </div>

      {error && <div className="orders-alert orders-alert-error">{error}</div>}
      {message && <div className="orders-alert orders-alert-success">{message}</div>}

      <form className="orders-card orders-form" onSubmit={handleAdd} style={{ marginBottom: '20px' }}>
        <h2>Thêm địa chỉ mới</h2>
        <div className="orders-grid">
          <label className="orders-field orders-field-full">
            <span>Số nhà, tên đường / tòa nhà *</span>
            <input
              value={form.addressLine}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              placeholder="Ví dụ: Số 2 Hải Triều, Tòa Bitexco"
              required
            />
          </label>
          <label className="orders-field">
            <span>Phường / Xã</span>
            <input value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} />
          </label>
          <label className="orders-field">
            <span>Quận / Huyện / TP</span>
            <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
          </label>
          <label className="orders-field">
            <span>Tỉnh / Thành phố *</span>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
          </label>
          <label className="orders-field">
            <span>Vĩ độ (Latitude)</span>
            <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          </label>
          <label className="orders-field">
            <span>Kinh độ (Longitude)</span>
            <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </label>
          <div className="orders-field orders-field-full orders-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />{' '}
              Đặt làm địa chỉ mặc định
            </label>
          </div>
        </div>
        <div className="orders-form-actions">
          <button className="orders-button orders-button-primary" type="submit">
            Lưu địa chỉ
          </button>
        </div>
      </form>

      <div className="orders-card orders-table-wrap">
        {loading ? (
          <p className="orders-empty">Đang tải danh sách địa chỉ...</p>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Địa chỉ</th>
                <th>Khu vực</th>
                <th>Tọa độ GPS</th>
                <th>Mặc định</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.addressLine}</strong></td>
                  <td>{[a.ward, a.district, a.city].filter(Boolean).join(', ')}</td>
                  <td>{a.latitude}, {a.longitude}</td>
                  <td>{a.isDefault ? 'Mặc định' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function AdminUsersPage({ currentUser, onSwitchAccount }) {
  const [email, setEmail] = useState('admin@smartdrone.vn')
  const [password, setPassword] = useState('P@ssword123!')
  const [authStatus, setAuthStatus] = useState('')

  async function handleLoginSubmit(e) {
    e.preventDefault()
    setAuthStatus('Đang xác thực JWT với Backend...')
    const result = await loginWithCredentials(email, password)
    if (result?.user) {
      setAuthStatus(`Đăng nhập thành công: ${result.user.email} (Roles: ${(result.user.roles || []).join(', ')})`)
      if (onSwitchAccount) onSwitchAccount(result.user)
    } else {
      setAuthStatus('Đăng nhập thất bại. Kiểm tra lại thông tin hoặc kết nối Backend.')
    }
  }

  const hasToken = Boolean(getAccessToken())

  return (
    <section className="orders-page">
      <div className="orders-heading">
        <div>
          <p className="orders-eyebrow">ADMIN / IDENTITY & RBAC</p>
          <h1>Quản trị Tài khoản & Phân quyền (RBAC)</h1>
          <p className="orders-subtitle">Danh sách 5 tài khoản vai trò chuẩn của hệ thống và kiểm tra phiên JWT.</p>
        </div>
      </div>

      {authStatus && <div className="orders-alert orders-alert-success">{authStatus}</div>}

      <div className="orders-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ marginTop: 0 }}>Kiểm tra Đăng nhập JWT (`POST /api/auth/login`)</h2>
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="orders-field" style={{ flex: 1, minWidth: '220px' }}>
            <span>Email tài khoản</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="orders-field" style={{ flex: 1, minWidth: '180px' }}>
            <span>Mật khẩu</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="orders-button orders-button-primary" type="submit">
            Đăng nhập & Cấp JWT
          </button>
        </form>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#475569' }}>
          Trạng thái Token hiện tại: <strong>{hasToken ? 'Đã cấp JWT Bearer Token' : 'Chưa có Token'}</strong>
          {currentUser?.email ? ` — Đang hoạt động với: ${currentUser.email}` : ''}
        </p>
      </div>

      <div className="orders-card orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Vai trò (Role)</th>
              <th>Họ tên</th>
              <th>Email đăng nhập</th>
              <th>Mật khẩu mặc định</th>
              <th>Thao tác nhanh</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ROLE_ACCOUNTS).map(([roleKey, info]) => (
              <tr key={roleKey}>
                <td><strong>{roleKey}</strong></td>
                <td>{info.fullName}</td>
                <td><code>{info.email}</code></td>
                <td><code>P@ssword123!</code></td>
                <td>
                  <button
                    type="button"
                    className="orders-link-button"
                    onClick={() => {
                      setEmail(info.email)
                      setPassword('P@ssword123!')
                    }}
                  >
                    Điền vào form
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function App() {
  const [role, setRole] = useState(ROLES.ADMIN)
  const [activePath, setActivePath] = useState('/dashboard')
  const [trackingOrderId, setTrackingOrderId] = useState('SDD-20261108-482910')
  const [currentUser, setCurrentUser] = useState(ROLE_ACCOUNTS.ADMIN)

  useEffect(() => {
    let active = true
    const fallbackUser = ROLE_ACCOUNTS[role] || ROLE_ACCOUNTS.CUSTOMER
    setCurrentUser(fallbackUser)
    localStorage.setItem('customerId', ROLE_ACCOUNTS.CUSTOMER.userId)

    loginAsRole(role).then((authData) => {
      if (active && authData?.user) {
        setCurrentUser(authData.user)
      }
    })

    return () => {
      active = false
    }
  }, [role])

  function renderActiveView() {
    switch (activePath) {
      case '/dashboard':
        return <LogisticsDashboard />
      case '/orders/create':
        return (
          <CreateOrderPage
            onCreated={(created) => {
              if (created?.trackingNumber) {
                setTrackingOrderId(created.trackingNumber)
              }
              setActivePath('/orders')
            }}
          />
        )
      case '/orders':
        return (
          <OrderListPage
            onViewOrder={(order) => {
              setTrackingOrderId(order.trackingNumber || order.id || 'ORD-2026-0001')
              setActivePath('/tracking')
            }}
          />
        )
      case '/customer/addresses':
        return <SavedAddressesPage />
      case '/logistics/approvals':
      case '/dispatch/drones':
        return <DispatcherDashboard />
      case '/stations':
        return <StationOperatorView />
      case '/tracking':
        return <LiveDroneMapView key={trackingOrderId} initialOrderId={trackingOrderId} />
      case '/admin/users':
        return (
          <AdminUsersPage
            currentUser={currentUser}
            onSwitchAccount={(user) => {
              setCurrentUser(user)
              if (user.roles?.[0]) setRole(user.roles[0])
            }}
          />
        )
      default:
        return <LogisticsDashboard />
    }
  }

  return (
    <MainLayout
      activePath={activePath}
      initialRole={role}
      currentUser={currentUser}
      onNavigate={(path) => setActivePath(path)}
      onRoleChange={(nextRole) => setRole(nextRole)}
    >
      {renderActiveView()}
    </MainLayout>
  )
}
