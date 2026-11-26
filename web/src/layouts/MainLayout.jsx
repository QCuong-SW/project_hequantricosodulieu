import { useEffect, useRef, useState } from 'react'
import { Drone } from 'lucide-react'
import { ROLES, getNavigationByRole } from '../navigation/navigationConfig'
import { API_V1_URL } from '../config/apiConfig'
import { clearAuthSession } from '../features/dashboard/authBridge'
import { showToast } from '../utils/toast'
import './MainLayout.css'

const ROLE_BADGE_COLORS = {
  ADMIN: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  LOGISTICS_MANAGER: 'bg-teal-100 text-teal-800 border-teal-300',
  DISPATCHER: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  STATION_OPERATOR: 'bg-amber-100 text-amber-800 border-amber-300',
  CUSTOMER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function MainLayout({
  activePath = '/dashboard',
  initialRole = ROLES.ADMIN,
  onNavigate,
  onRoleChange,
  onLogout,
  currentUser,
  children,
}) {
  const [currentRole, setCurrentRole] = useState(initialRole)
  const [currentPath, setCurrentPath] = useState(activePath)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [toasts, setToasts] = useState([])
  const [deliveredEvents, setDeliveredEvents] = useState([])
  const [showDeliveredDetail, setShowDeliveredDetail] = useState(false)
  const seenCompletedIdsRef = useRef(null)

  // Theo dõi thời gian thực các đơn hàng vừa được khách hàng bấm "Đã nhận hàng" trên App Mobile -> cộng dồn 1 đơn, 2 đơn, 3 đơn... & giải phóng Drone!
  useEffect(() => {
    let active = true

    async function pollCompletedDeliveries() {
      try {
        const res = await fetch(`${API_V1_URL}/delivery-confirmations/completed-events`)
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        const list = Array.isArray(json?.data) ? json.data : []
        if (!active) return

        // Lần tải đầu tiên: ghi nhận các event cũ để không thông báo lại lịch sử trước đó
        if (seenCompletedIdsRef.current === null) {
          seenCompletedIdsRef.current = new Set(list.map((e) => e.eventId))
          return
        }

        const fresh = list.filter((e) => !seenCompletedIdsRef.current.has(e.eventId))
        if (fresh.length > 0) {
          fresh.forEach((e) => seenCompletedIdsRef.current.add(e.eventId))
          setDeliveredEvents((prev) => [...fresh, ...prev])
          window.dispatchEvent(new CustomEvent('sdd-order-delivered', { detail: fresh }))
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời
      }
    }

    pollCompletedDeliveries()
    const timer = setInterval(pollCompletedDeliveries, 2000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const handleToast = (e) => {
      const toast = e.detail
      if (!toast) return
      setToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 3500)
    }
    window.addEventListener('sdd-toast', handleToast)
    return () => window.removeEventListener('sdd-toast', handleToast)
  }, [])

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const handleLogout = () => {
    clearAuthSession()
    if (onLogout) {
      onLogout()
    }
    showToast('Đã đăng xuất phiên làm việc an toàn.', 'info')
  }

  useEffect(() => {
    setCurrentPath(activePath)
  }, [activePath])

  useEffect(() => {
    setCurrentRole(initialRole)
  }, [initialRole])

  const navItems = getNavigationByRole(currentRole)

  const handleSelectNav = (path) => {
    setCurrentPath(path)
    if (onNavigate) {
      onNavigate(path)
    }
  }

  const handleChangeRole = (newRole) => {
    setCurrentRole(newRole)
    if (onRoleChange) {
      onRoleChange(newRole)
    }
    const allowedItems = getNavigationByRole(newRole)
    if (allowedItems.length > 0 && !allowedItems.some((i) => i.path === currentPath)) {
      const fallbackPath = allowedItems[0].path
      setCurrentPath(fallbackPath)
      if (onNavigate) {
        onNavigate(fallbackPath)
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAF9] text-slate-900 font-sans">
      {/* Fixed Left Sidebar */}
      <aside
        className={`flex flex-col h-screen bg-white text-slate-800 border-r border-emerald-100/90 shadow-2xs transition-all duration-200 shrink-0 select-none ${
          isSidebarOpen ? 'w-68' : 'w-20'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 px-5 py-5 border-b border-emerald-100/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 ring-2 ring-emerald-500/15">
            <Drone className="w-6 h-6 text-white stroke-[2.2]" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <strong className="text-base font-extrabold tracking-tight text-slate-900 truncate">
                SmartDrone
              </strong>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                Mission Control
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="px-3 pt-4 pb-2">
          {isSidebarOpen && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700/70">
              Modules ({navItems.length})
            </p>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPath === item.path
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectNav(item.path)}
                className={`group flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-600/20'
                    : 'text-slate-600 hover:bg-emerald-50/80 hover:text-emerald-800'
                }`}
              >
                {isSidebarOpen && (
                  <div className="flex items-center justify-between w-full overflow-hidden">
                    <span className="truncate">{item.label}</span>
                    {item.path === '/orders' && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        6 ĐƠN
                      </span>
                    )}
                    {item.path === '/stations' && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        3 TRẠM
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Fixed Top Header */}
        <header className="shrink-0 z-30 flex flex-wrap items-center justify-between gap-4 px-7 py-3.5 bg-white/95 backdrop-blur-md border-b border-emerald-900/10 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 m-0">
              Smart Drone Delivery System
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
            >
              Đăng Xuất
            </button>
          </div>
        </header>

        {/* Global Toast Notifications Stack */}
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto bg-white rounded-xl border shadow-xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200 ${
                t.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
                  : t.type === 'error'
                    ? 'border-rose-200 bg-rose-50/90 text-rose-950'
                    : t.type === 'warning'
                      ? 'border-amber-200 bg-amber-50/90 text-amber-950'
                      : 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    t.type === 'success'
                      ? 'bg-emerald-500'
                      : t.type === 'error'
                        ? 'bg-rose-500'
                        : t.type === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                  }`}
                />
                <span className="text-xs font-semibold">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer ml-2"
              >
                Đóng
              </button>
            </div>
          ))}
        </div>

        {/* Cumulative Delivered Orders Mini Notification (1 đơn, 2 đơn, 3 đơn...) */}
        {deliveredEvents.length > 0 && (
          <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 max-w-sm">
            {showDeliveredDetail && (
              <div className="w-80 bg-white rounded-2xl border border-emerald-200 shadow-2xl overflow-hidden text-xs">
                <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                  <span className="font-extrabold text-emerald-900">
                    Đơn Đã Giao Thành Công ({deliveredEvents.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveredEvents([])
                      setShowDeliveredDetail(false)
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Đánh dấu đã xem
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {deliveredEvents.map((ev) => (
                    <div key={ev.eventId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-slate-900">{ev.trackingNumber}</div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          Đã giải phóng Drone {ev.releasedDroneCode || 'DRN-VN-04'} (IDLE)
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {ev.confirmedAt
                          ? new Date(ev.confirmedAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'Vừa xong'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border-2 border-emerald-500 rounded-2xl shadow-xl shadow-emerald-900/10 px-4 py-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeliveredDetail((prev) => !prev)}
                className="flex items-center gap-2.5 text-left cursor-pointer"
              >
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {deliveredEvents.length}
                </span>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 whitespace-nowrap">
                    {deliveredEvents.length} đơn hàng đã giao thành công
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold whitespace-nowrap">
                    Đã giải phóng Drone {deliveredEvents[0]?.releasedDroneCode || 'DRN-VN-04'} • Xem chi tiết
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeliveredEvents([])
                  setShowDeliveredDetail(false)
                }}
                title="Đóng thông báo"
                className="ml-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Page Content (Header & Sidebar remain fixed) */}
        <div className="flex-1 overflow-y-auto">
          <main className="p-6 md:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default MainLayout
