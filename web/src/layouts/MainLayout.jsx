import { useEffect, useState } from 'react'
import { ROLES, getNavigationByRole } from '../navigation/navigationConfig'
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
    <div className="flex min-h-screen bg-[#F8FAF9] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-[#0B1512] text-slate-100 border-r border-emerald-950/80 transition-all duration-200 shrink-0 select-none ${
          isSidebarOpen ? 'w-68' : 'w-20'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 px-5 py-5 border-b border-emerald-950/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold text-sm flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0 ring-1 ring-white/15">
            SDD
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <strong className="text-base font-bold tracking-tight text-white truncate">
                SmartDrone
              </strong>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Mission Control
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="px-3 pt-4 pb-2">
          {isSidebarOpen && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600/80">
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
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-600/25'
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-emerald-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isActive ? 'bg-white' : 'bg-slate-600 group-hover:bg-emerald-400'
                  }`}
                />
                {isSidebarOpen && (
                  <div className="flex items-center justify-between w-full overflow-hidden">
                    <span className="truncate">{item.label}</span>
                    {item.path === '/orders' && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                        6 ĐƠN
                      </span>
                    )}
                    {item.path === '/dispatch/drones' && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                        LIVE
                      </span>
                    )}
                    {item.path === '/stations' && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-teal-500/20 text-teal-300">
                        3 TRẠM
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </nav>

        {/* System Telemetry Status & Collapse */}
        <div className="p-3 border-t border-emerald-950/80 space-y-2.5">
          {isSidebarOpen && (
            <div className="px-3 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-900/60 text-xs">
              <div className="flex items-center gap-2 font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>SignalR Telemetry 2s</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                API: localhost:5028
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="w-full py-2 px-3 rounded-lg border border-emerald-950 bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-emerald-300 text-xs font-medium transition cursor-pointer"
          >
            {isSidebarOpen ? 'Thu gọn thanh bên' : 'Mở'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 px-7 py-3.5 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 m-0">
              Smart Drone Delivery System
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-semibold">
              {currentPath}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {currentUser?.email && (
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-50/70 border border-emerald-200/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-800">
                  {currentUser.fullName || currentUser.email}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">{currentUser.email}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  ROLE_BADGE_COLORS[currentRole] || 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Role
              </span>
              <select
                aria-label="Role:"
                value={currentRole}
                onChange={(e) => handleChangeRole(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-bold shadow-2xs hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer transition"
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

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

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainLayout
