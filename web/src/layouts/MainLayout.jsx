import { useState } from 'react'
import { ROLES, getNavigationByRole } from '../navigation/navigationConfig'
import './MainLayout.css'

export function MainLayout({
  activePath = '/orders/create',
  initialRole = ROLES.CUSTOMER,
  onNavigate,
  children,
}) {
  const [currentRole, setCurrentRole] = useState(initialRole)
  const [currentPath, setCurrentPath] = useState(activePath)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const navItems = getNavigationByRole(currentRole)

  const handleSelectNav = (path) => {
    setCurrentPath(path)
    if (onNavigate) {
      onNavigate(path)
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

          <div className="sdd-header-actions">
            <label className="sdd-role-switcher">
              <span>Role:</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
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
