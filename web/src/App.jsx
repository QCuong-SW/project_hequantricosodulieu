import { useEffect, useState } from 'react'
import MainLayout from './layouts/MainLayout'
import { ROLES } from './navigation/navigationConfig'
import { ROLE_ACCOUNTS, API_V1_URL } from './config/apiConfig'
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
    <section className="max-w-6xl mx-auto space-y-6 text-slate-900 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase font-mono">
              CUSTOMER / ADDRESS BOOK
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Sổ Địa Chỉ Giao Nhận Bằng Drone
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý tọa độ GPS nội đô TP.HCM phục vụ bãi đáp và hạ cánh an toàn.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}
      {message && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold">
          {message}
        </div>
      )}

      {/* New Address Form */}
      <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Thêm Địa Chỉ Mới</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Số nhà, tên đường / Tòa nhà *
            </label>
            <input
              value={form.addressLine}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              placeholder="Ví dụ: Số 2 Hải Triều, Tòa Bitexco Financial Tower"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Phường / Xã
            </label>
            <input
              value={form.ward}
              onChange={(e) => setForm({ ...form, ward: e.target.value })}
              placeholder="Bến Nghé"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Quận / Huyện / TP Thủ Đức
            </label>
            <input
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              placeholder="Quận 1"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Vĩ độ GPS (Latitude)
            </label>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Kinh độ GPS (Longitude)
            </label>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>
          <div className="md:col-span-2 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-800">Đặt làm địa chỉ nhận hàng mặc định</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md transition cursor-pointer text-xs"
          >
            Lưu Địa Chỉ Mới
          </button>
        </div>
      </form>

      {/* Address Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Danh Sách Địa Chỉ Đã Lưu ({addresses.length})</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sử dụng tọa độ này để điều hướng Drone đến đúng điểm nhận.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Địa Chỉ</th>
                <th className="py-3 px-4">Khu Vực</th>
                <th className="py-3 px-4">Tọa Độ GPS</th>
                <th className="py-3 px-4">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {addresses.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{a.addressLine}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {[a.ward, a.district, a.city].filter(Boolean).join(', ')}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {a.latitude}, {a.longitude}
                  </td>
                  <td className="py-3 px-4">
                    {a.isDefault ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Mặc định
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function AdminUsersPage({ currentUser, onSwitchAccount }) {
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [email, setEmail] = useState('admin@smartdrone.vn')
  const [password, setPassword] = useState('P@ssword123!')
  const [authStatus, setAuthStatus] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadAdminData() {
    setLoading(true)
    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch(`${API_V1_URL}/auth/users`),
        fetch(`${API_V1_URL}/auth/audit-logs`),
      ])
      if (usersRes.ok) {
        const uList = await usersRes.json()
        setUsers(Array.isArray(uList) ? uList : [])
      }
      if (logsRes.ok) {
        const lList = await logsRes.json()
        setAuditLogs(Array.isArray(lList) ? lList : [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  async function handleLoginSubmit(e) {
    e.preventDefault()
    setAuthStatus('Đang xác thực JWT với Backend...')
    const result = await loginWithCredentials(email, password)
    if (result?.user) {
      setAuthStatus(`Đăng nhập thành công: ${result.user.email} (Roles: ${(result.user.roles || []).join(', ')})`)
      if (onSwitchAccount) onSwitchAccount(result.user)
      await loadAdminData()
    } else {
      setAuthStatus('Đăng nhập thất bại. Kiểm tra lại thông tin hoặc kết nối Backend.')
    }
  }

  const hasToken = Boolean(getAccessToken())

  return (
    <section className="max-w-7xl mx-auto space-y-6 text-slate-900 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase font-mono">
              ADMIN / RBAC & AUDIT LOGS
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Quản Trị Người Dùng &amp; Nhật Ký Kiểm Toán
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản trị 5 vai trò bảo mật RBAC, xác thực JWT Bearer và theo dõi nhật ký kiểm toán hệ thống.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAdminData}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 shadow-xs transition cursor-pointer"
        >
          {loading ? 'Đang tải...' : 'Làm Mới Dữ Liệu'}
        </button>
      </div>

      {authStatus && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold">
          {authStatus}
        </div>
      )}

      {/* JWT Login Simulator Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Kiểm Tra Đăng Nhập JWT (`POST /api/auth/login`)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Thử nghiệm cấp phát Access Token &amp; Refresh Token theo tiêu chuẩn OAuth2 / OpenID Connect.
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs">
          <div className="sm:col-span-5">
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Email tài khoản *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Mật khẩu *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md transition cursor-pointer text-xs"
            >
              Đăng Nhập &amp; Cấp JWT
            </button>
          </div>
        </form>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-700">
          <div>
            Trạng thái Token: <strong className="font-semibold text-slate-900">{hasToken ? 'Đã cấp JWT Bearer' : 'Chưa có Token'}</strong>
            {currentUser?.email ? ` — Tài khoản hiện tại: ${currentUser.email}` : ''}
          </div>
          <span className="font-mono text-[11px] text-blue-700">SHA-256 HMAC</span>
        </div>
      </div>

      {/* Users RBAC Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Danh Sách Tài Khoản Người Dùng &amp; Phân Quyền</h2>
            <p className="text-xs text-slate-500 mt-0.5">Dữ liệu tài khoản từ `GET /api/v1/auth/users`.</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {users.length} tài khoản
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Vai Trò (RBAC)</th>
                <th className="py-3 px-4">Họ Và Tên</th>
                <th className="py-3 px-4">Email Đăng Nhập</th>
                <th className="py-3 px-4">Số Điện Thoại</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id || u.email} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      {u.role || u.roles?.[0] || 'USER'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                  <td className="py-3 px-4 font-mono text-slate-700">{u.email}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{u.phone || '—'}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                      {u.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(u.email)
                        setPassword('P@ssword123!')
                      }}
                      className="px-2.5 py-1 rounded-lg font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                    >
                      Điền Form
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Dữ liệu kiểm toán từ `GET /api/v1/auth/audit-logs`.</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
            {auditLogs.length} sự kiện
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Hành Động</th>
                <th className="py-2.5 px-4">Người Thực Hiện</th>
                <th className="py-2.5 px-4">Thực Thể</th>
                <th className="py-2.5 px-4">Địa Chỉ IP</th>
                <th className="py-2.5 px-4">Thời Gian</th>
                <th className="py-2.5 px-4">Chi Tiết Sự Kiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.auditLogId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{log.userEmail || 'Hệ thống'}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">
                    {log.entityName} {log.entityId ? `[${log.entityId}]` : ''}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                  <td className="py-2.5 px-4 text-slate-500">
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 truncate max-w-xs">{log.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
