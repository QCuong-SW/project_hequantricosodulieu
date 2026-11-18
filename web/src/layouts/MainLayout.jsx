import { useEffect, useState } from 'react'
import { ROLES, getNavigationByRole } from '../navigation/navigationConfig'
import './MainLayout.css'

export function MainLayout({
  activePath = '/dashboard',
  initialRole = ROLES.ADMIN,
  onNavigate,
  onRoleChange,
  currentUser,
  children,
}) {
  const [currentRole, setCurrentRole] = useState(initialRole)
  const [currentPath, setCurrentPath] = useState(activePath)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

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
    <div className="sdd-layout">
      <aside className={`sdd-sidebar ${isSidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sdd-brand">
          <div className="sdd-brand-badge">SDD</div>
          {isSidebarOpen && (
            <div className="sdd-brand-text">
              <strong>SmartDrone</strong>
              <span>Delivery Platform</span>
            </div>
          )}
        </div>

        <nav className="sdd-nav">
          {navItems.map((item) => {
            const isActive = currentPath === item.path
            return (
              <button
                key={item.key}
                type="button"
                className={`sdd-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectNav(item.path)}
              >
                <span className="sdd-nav-dot" />
                {isSidebarOpen && <span className="sdd-nav-label">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sdd-sidebar-footer">
          <button
            type="button"
            className="sdd-collapse-btn"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            {isSidebarOpen ? 'Collapse Sidebar' : '>>'}
          </button>
        </div>
      </aside>

      <div className="sdd-main-wrapper">
        <header className="sdd-header">
          <div className="sdd-header-title">
            <h1>Smart Drone Delivery System</h1>
            <span className="sdd-route-indicator">{currentPath}</span>
          </div>

          <div className="sdd-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {currentUser?.email && (
              <span style={{ fontSize: '13px', color: '#475569' }}>
                👤 <strong>{currentUser.fullName || currentUser.email}</strong> ({currentUser.email})
              </span>
            )}
            <label className="sdd-role-switcher">
              <span>Role:</span>
              <select
                value={currentRole}
                onChange={(e) => handleChangeRole(e.target.value)}
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <main className="sdd-content">
          {children || (
            <div className="sdd-placeholder-card">
              <h2>Module Ready: {currentPath}</h2>
              <p>
                Active role: <strong>{currentRole}</strong>. Select an item from the
                navigation sidebar to switch views.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default MainLayout
