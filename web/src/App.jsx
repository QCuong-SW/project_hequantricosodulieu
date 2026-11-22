import { useEffect, useState } from 'react'
import MainLayout from './layouts/MainLayout'
import { ROLES } from './navigation/navigationConfig'
import { ROLE_ACCOUNTS, API_V1_URL } from './config/apiConfig'
import { loginAsRole, loginWithCredentials, getAccessToken, clearAuthSession } from './features/dashboard/authBridge'
import LogisticsDashboard from './features/dashboard/LogisticsDashboard'
import CreateOrderPage from './features/orders/CreateOrderPage'
import OrderListPage from './features/orders/OrderListPage'
import { getMyAddresses, createMyAddress, updateMyAddress, deleteMyAddress } from './features/orders/orderService'
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
  const [editingAddress, setEditingAddress] = useState(null)
  const [deletingAddress, setDeletingAddress] = useState(null)
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

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editingAddress) return
    setError('')
    setMessage('')
    try {
      await updateMyAddress(editingAddress.id, {
        addressLine: editingAddress.addressLine.trim(),
        ward: editingAddress.ward?.trim() || null,
        district: editingAddress.district?.trim() || null,
        city: editingAddress.city.trim(),
        latitude: Number(editingAddress.latitude || 10.7769),
        longitude: Number(editingAddress.longitude || 106.7009),
        isDefault: editingAddress.isDefault,
      })
      setMessage('Đã cập nhật địa chỉ thành công!')
      setEditingAddress(null)
      await load()
    } catch (err) {
      setError(err.message || 'Không thể cập nhật địa chỉ.')
    }
  }

  async function handleDelete(addressId) {
    setError('')
    setMessage('')
    try {
      await deleteMyAddress(addressId)
      setMessage('Đã xóa địa chỉ thành công!')
      setDeletingAddress(null)
      await load()
    } catch (err) {
      setError(err.message || 'Không thể xóa địa chỉ.')
    }
  }

  return (
    <section className="max-w-6xl mx-auto space-y-6 text-slate-900 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase font-mono">
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
      <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4 text-xs">
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
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
          </div>
          <div className="md:col-span-2 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-800">Đặt làm địa chỉ nhận hàng mặc định</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer text-xs"
          >
            Lưu Địa Chỉ Mới
          </button>
        </div>
      </form>

      {/* Address Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Danh Sách Địa Chỉ Đã Lưu ({addresses.length})</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sử dụng tọa độ này để điều hướng Drone đến đúng điểm nhận.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                <th className="py-3 px-4">Địa Chỉ</th>
                <th className="py-3 px-4">Khu Vực</th>
                <th className="py-3 px-4">Tọa Độ GPS</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Mặc định
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditingAddress({ ...a })}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingAddress(a)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Address Modal */}
      {editingAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleUpdate}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Chỉnh Sửa Địa Chỉ</h3>
              <button
                type="button"
                onClick={() => setEditingAddress(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                x
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1">
                  Địa chỉ chi tiết *
                </label>
                <input
                  value={editingAddress.addressLine}
                  onChange={(e) => setEditingAddress({ ...editingAddress, addressLine: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1">
                    Phường / Xã
                  </label>
                  <input
                    value={editingAddress.ward || ''}
                    onChange={(e) => setEditingAddress({ ...editingAddress, ward: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1">
                    Quận / TP Thủ Đức
                  </label>
                  <input
                    value={editingAddress.district || ''}
                    onChange={(e) => setEditingAddress({ ...editingAddress, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1">
                    Vĩ độ (Lat)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingAddress.latitude}
                    onChange={(e) => setEditingAddress({ ...editingAddress, latitude: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1">
                    Kinh độ (Lng)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingAddress.longitude}
                    onChange={(e) => setEditingAddress({ ...editingAddress, longitude: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
              </div>
              <div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingAddress.isDefault}
                    onChange={(e) => setEditingAddress({ ...editingAddress, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Đặt làm địa chỉ nhận hàng mặc định</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingAddress(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Address Modal */}
      {deletingAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Xác Nhận Xóa Địa Chỉ?</h3>
            <p className="text-xs text-slate-600">
              Bạn có chắc muốn xóa địa chỉ: <strong className="text-slate-900">{deletingAddress.addressLine}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingAddress(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingAddress.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition cursor-pointer"
              >
                Đồng Ý Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function AdminUsersPage({ currentUser, onSwitchAccount }) {
  const [adminTab, setAdminTab] = useState('USERS') // 'USERS' | 'DB_HEALTH' | 'AUDIT_LOGS'
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [dbHealth, setDbHealth] = useState(null)
  const [email, setEmail] = useState('admin@smartdrone.vn')
  const [password, setPassword] = useState('P@ssword123!')
  const [authStatus, setAuthStatus] = useState('')
  const [loading, setLoading] = useState(true)

  // User search & filters
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [auditSearch, setAuditSearch] = useState('')

  // Create User Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPassword, setNewPassword] = useState('P@ssword123!')
  const [newRole, setNewRole] = useState('CUSTOMER')
  const [isSubmittingUser, setIsSubmittingUser] = useState(false)
  const [modalError, setModalError] = useState('')

  async function loadAdminData() {
    setLoading(true)
    try {
      const [usersRes, logsRes, healthRes] = await Promise.all([
        fetch(`${API_V1_URL}/auth/users`),
        fetch(`${API_V1_URL}/auth/audit-logs`),
        fetch(`${API_V1_URL}/analytics/db-health`).catch(() => null),
      ])
      if (usersRes.ok) {
        const uList = await usersRes.json()
        setUsers(Array.isArray(uList) ? uList : [])
      }
      if (logsRes.ok) {
        const lList = await logsRes.json()
        setAuditLogs(Array.isArray(lList) ? lList : [])
      }
      if (healthRes && healthRes.ok) {
        const hData = await healthRes.json()
        setDbHealth(hData)
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

  async function handleCreateUserSubmit(e) {
    e.preventDefault()
    setModalError('')
    setIsSubmittingUser(true)
    try {
      const res = await fetch(`${API_V1_URL}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newFullName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          password: newPassword,
          role: newRole,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || 'Không thể tạo tài khoản mới.')
      }

      setAuthStatus(`Tạo tài khoản thành công: ${data.data?.email || newEmail}`)
      setShowCreateModal(false)
      setNewFullName('')
      setNewEmail('')
      setNewPhone('')
      setNewPassword('P@ssword123!')
      setNewRole('CUSTOMER')
      await loadAdminData()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setIsSubmittingUser(false)
    }
  }

  async function handleToggleUserStatus(user) {
    const nextStatus = user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED'
    try {
      const res = await fetch(`${API_V1_URL}/auth/users/${user.id || user.email}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('Không thể cập nhật trạng thái người dùng.')
      setAuthStatus(`Tài khoản ${user.email} đã được chuyển sang ${nextStatus}.`)
      await loadAdminData()
    } catch (err) {
      setAuthStatus(`Lỗi: ${err.message}`)
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !userSearch ||
      u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
    const matchRole =
      roleFilter === 'ALL' ||
      u.role === roleFilter ||
      u.roles?.includes(roleFilter)
    return matchSearch && matchRole
  })

  const filteredLogs = auditLogs.filter((log) => {
    if (!auditSearch) return true
    const term = auditSearch.toLowerCase()
    return (
      log.action?.toLowerCase().includes(term) ||
      log.userEmail?.toLowerCase().includes(term) ||
      log.entityName?.toLowerCase().includes(term)
    )
  })

  const hasToken = Boolean(getAccessToken())

  return (
    <section className="max-w-7xl mx-auto space-y-6 text-slate-900 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase font-mono">
              ADMIN / RBAC &amp; DATABASE OPERATIONS
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Quản Trị Người Dùng &amp; Giám Sát CSDL
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản trị 5 vai trò bảo mật RBAC, giám sát trạng thái SQL Server, hiệu suất SQL Views và nhật ký kiểm toán.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {adminTab === 'USERS' && (
            <button
              type="button"
              onClick={() => {
                setModalError('')
                setShowCreateModal(true)
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 transition cursor-pointer"
            >
              + Tạo Người Dùng Mới
            </button>
          )}
          <button
            type="button"
            onClick={loadAdminData}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-xs transition cursor-pointer"
          >
            {loading ? 'Đang tải...' : 'Làm Mới'}
          </button>
        </div>
      </div>

      {authStatus && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>{authStatus}</span>
          <button type="button" onClick={() => setAuthStatus('')} className="text-xs underline cursor-pointer">
            Đóng
          </button>
        </div>
      )}

      {/* Admin Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setAdminTab('USERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'USERS'
              ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Người Dùng &amp; Phân Quyền RBAC ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('DB_HEALTH')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'DB_HEALTH'
              ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Giám Sát CSDL &amp; SQL Views
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('AUDIT_LOGS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'AUDIT_LOGS'
              ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Nhật Ký Kiểm Toán ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: USERS & RBAC */}
      {adminTab === 'USERS' && (
        <div className="space-y-6">
          {/* JWT Login Simulator Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Kiểm Tra Đăng Nhập JWT (`POST /api/auth/login`)</h2>
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
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 transition cursor-pointer text-xs"
                >
                  Đăng Nhập &amp; Cấp JWT
                </button>
              </div>
            </form>

            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs text-slate-700">
              <div>
                Trạng thái Token: <strong className="font-semibold text-emerald-800">{hasToken ? 'Đã cấp JWT Bearer' : 'Chưa có Token'}</strong>
                {currentUser?.email ? ` — Đang đăng nhập: ${currentUser.email}` : ''}
              </div>
              <span className="font-mono text-[11px] text-emerald-700 font-bold">SHA-256 HMAC</span>
            </div>
          </div>

          {/* Users RBAC Table with Search & Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <input
                  type="text"
                  placeholder="Tìm theo họ tên hoặc email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full max-w-xs px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="ALL">Tất Cả Vai Trò</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="DISPATCHER">DISPATCHER</option>
                  <option value="STATION_OPERATOR">STATION_OPERATOR</option>
                  <option value="LOGISTICS_MANAGER">LOGISTICS_MANAGER</option>
                  <option value="CUSTOMER">CUSTOMER</option>
                </select>
              </div>

              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {filteredUsers.length} tài khoản
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                    <th className="py-3 px-4">Vai Trò (RBAC)</th>
                    <th className="py-3 px-4">Họ Và Tên</th>
                    <th className="py-3 px-4">Email Đăng Nhập</th>
                    <th className="py-3 px-4">Số Điện Thoại</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">
                        Không tìm thấy người dùng phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isLocked = u.status === 'LOCKED'
                      const roleName = u.role || u.roles?.[0] || 'CUSTOMER'
                      return (
                        <tr key={u.id || u.email} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                                roleName === 'ADMIN'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : roleName === 'DISPATCHER'
                                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                    : roleName === 'STATION_OPERATOR'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : roleName === 'LOGISTICS_MANAGER'
                                        ? 'bg-teal-50 text-teal-800 border-teal-200'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  roleName === 'ADMIN'
                                    ? 'bg-emerald-700'
                                    : roleName === 'DISPATCHER'
                                      ? 'bg-cyan-600'
                                      : roleName === 'STATION_OPERATOR'
                                        ? 'bg-amber-600'
                                        : roleName === 'LOGISTICS_MANAGER'
                                          ? 'bg-teal-600'
                                          : 'bg-emerald-600'
                                }`}
                              ></span>
                              {roleName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                          <td className="py-3 px-4 font-mono text-slate-700">{u.email}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{u.phone || '—'}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isLocked
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${
                                  isLocked ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                              ></span>
                              {u.status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer border ${
                                isLocked
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              {isLocked ? 'Mở Khóa' : 'Khóa'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEmail(u.email)
                                setPassword('P@ssword123!')
                              }}
                              className="px-2.5 py-1 rounded-lg font-bold text-[11px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                            >
                              Điền Đăng Nhập
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE HEALTH & SQL VIEWS */}
      {adminTab === 'DB_HEALTH' && (
        <div className="space-y-6">
          {/* Card: Engine Status */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-black text-emerald-700 uppercase tracking-widest">
                  RELATIONAL DATABASE ENGINE
                </span>
                <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {dbHealth?.database?.engine || 'Microsoft SQL Server 2022 (RTM)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  CSDL: <strong className="text-slate-800">{dbHealth?.database?.databaseName || 'SmartDroneDeliveryDb'}</strong> | Provider: {dbHealth?.database?.provider || 'EF Core SqlServer'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {dbHealth?.database?.status || 'ONLINE (HEALTHY)'}
                </span>
              </div>
            </div>
          </div>

          {/* Grid: Core Tables Metrics */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Các Bảng CSDL Cốt Lõi (Core Entity Tables)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(dbHealth?.tables || [
                { name: 'users', displayName: 'Tài khoản người dùng (RBAC)', rowCount: users.length || 5, status: 'SYNCED' },
                { name: 'delivery_orders', displayName: 'Đơn vận chuyển Drone', rowCount: 6, status: 'SYNCED' },
                { name: 'packages', displayName: 'Kiện hàng theo đơn', rowCount: 8, status: 'SYNCED' },
                { name: 'flight_schedules', displayName: 'Lịch trình bay & Hành lang', rowCount: 3, status: 'SYNCED' },
                { name: 'landing_stations', displayName: 'Trạm tiếp đất & Khay sạc', rowCount: 3, status: 'SYNCED' },
                { name: 'audit_logs', displayName: 'Nhật ký kiểm toán truy vết', rowCount: auditLogs.length || 15, status: 'SYNCED' },
              ]).map((tbl) => (
                <div key={tbl.name} className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-emerald-200 transition">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-xs text-emerald-800">dbo.{tbl.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {tbl.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{tbl.displayName}</p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Số bản ghi:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{tbl.rowCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table: SQL Views Monitor */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Danh Mục SQL Views Tối Ưu Hóa Báo Cáo</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các khung nhìn dữ liệu được đánh chỉ mục và tính toán sẵn giúp tăng tốc truy vấn phân tích logistics.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                    <th className="py-3 px-4">Tên SQL View</th>
                    <th className="py-3 px-4">Mô Tả Nghiệp Vụ</th>
                    <th className="py-3 px-4">Trạng Thái View</th>
                    <th className="py-3 px-4 text-right">Số Dòng Dữ Liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(dbHealth?.views || [
                    {
                      viewName: 'v_station_slot_utilization',
                      description: 'Thống kê tỷ lệ chiếm dụng bãi đáp, dock sạc và tủ lưu trữ theo thời gian thực',
                      recordsCount: 3,
                      status: 'INDEXED_ACTIVE',
                    },
                    {
                      viewName: 'v_flight_delivery_performance',
                      description: 'Chỉ số hiệu suất chuyến bay, tỷ lệ đến đúng giờ (On-Time) và cự ly trung bình',
                      recordsCount: 7,
                      status: 'INDEXED_ACTIVE',
                    },
                    {
                      viewName: 'vw_order_full_lifecycle',
                      description: 'Theo dõi tiến trình toàn diện đơn hàng từ tạo mới, duyệt, gán drone đến hoàn tất giao',
                      recordsCount: 6,
                      status: 'INDEXED_ACTIVE',
                    },
                  ]).map((vw) => (
                    <tr key={vw.viewName} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800">dbo.{vw.viewName}</td>
                      <td className="py-3 px-4 text-slate-700">{vw.description}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {vw.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{vw.recordsCount} rows</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {adminTab === 'AUDIT_LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Lọc nhật ký theo hành động hoặc email..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full max-w-sm px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {filteredLogs.length} sự kiện
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[10px] font-bold text-emerald-950 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Hành Động</th>
                  <th className="py-2.5 px-4">Người Thực Hiện</th>
                  <th className="py-2.5 px-4">Thực Thể</th>
                  <th className="py-2.5 px-4">Địa Chỉ IP</th>
                  <th className="py-2.5 px-4">Thời Gian</th>
                  <th className="py-2.5 px-4">Chi Tiết Sự Kiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      Không có sự kiện kiểm toán nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.auditLogId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tạo Người Dùng Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-black text-emerald-700 uppercase tracking-widest">
                  NEW RBAC ACCOUNT
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">Tạo Người Dùng Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Thị Hồng"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                  Email đăng nhập *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@smartdrone.vn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    placeholder="0901234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                    Vai trò (RBAC) *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="DISPATCHER">DISPATCHER</option>
                    <option value="STATION_OPERATOR">STATION_OPERATOR</option>
                    <option value="LOGISTICS_MANAGER">LOGISTICS_MANAGER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                  Mật khẩu khởi tạo *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 -mx-6 -mb-6 mt-6 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmittingUser}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingUser ? 'Đang Tạo...' : 'Tạo Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
      onLogout={() => {
        clearAuthSession()
        setCurrentUser(null)
        setRole(ROLES.CUSTOMER)
        setActivePath('/dashboard')
      }}
    >
      {renderActiveView()}
    </MainLayout>
  )
}
