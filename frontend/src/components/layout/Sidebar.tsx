import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useTheme } from '../../lib/theme-context'
import { REVIEWER_STAT_CARDS } from '../StatCard'
import type { ApplicationStatus } from '../../types'

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  status?: ApplicationStatus
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)

  const applicantNav: NavItem[] = [
    { to: '/', label: 'My applications', icon: FolderKanban },
    { to: '/applications/new', label: 'New application', icon: FilePlus },
  ]

  const reviewerNav: NavItem[] = [
    { to: '/review', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ...REVIEWER_STAT_CARDS.map((card) => ({
      to: `/review/queue?status=${card.status}`,
      label: card.label,
      icon: card.icon,
      status: card.status,
    })),
  ]

  const navItems = user?.role === 'REVIEWER' ? reviewerNav : applicantNav

  function isActive(item: NavItem) {
    if (item.exact) return location.pathname === item.to
    if (item.status) {
      if (location.pathname !== '/review/queue') return false
      const currentStatus = searchParams.get('status') ?? 'SUBMITTED'
      return currentStatus === item.status
    }
    if (item.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.to)
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-glyph">A</div>
        {!collapsed && (
          <div>
            <div className="sidebar-logo-title">Approval Workflow</div>
            <div className="sidebar-logo-role font-geist-mono">
              {user?.role === 'REVIEWER' ? 'Reviewer' : 'Applicant'}
            </div>
          </div>
        )}
      </div>

      {!collapsed && user && (
        <div className="sidebar-user">
          <div className="sidebar-user-email font-geist-mono">{user.email}</div>
          <div className="sidebar-user-meta font-geist-mono">Demo account</div>
        </div>
      )}

      <nav className="sidebar-nav" aria-label="Main navigation">
        {!collapsed && (
          <div className="sidebar-section-title font-geist-mono section-title">
            Navigation
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link${active ? ' active' : ''}`}
              title={collapsed ? item.label.toUpperCase() : undefined}
            >
              <Icon
                className="nav-icon"
                size={18}
                style={active ? { color: 'var(--ds-on-primary)' } : undefined}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-link"
          onClick={toggleTheme}
          title={collapsed ? 'Toggle theme' : undefined}
          style={{
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          {theme === 'dark' ? (
            <Sun className="nav-icon" size={18} />
          ) : (
            <Moon className="nav-icon" size={18} />
          )}
          {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>
        <button
          type="button"
          className="nav-link"
          onClick={logout}
          title={collapsed ? 'LOG OUT' : undefined}
          style={{
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <LogOut className="nav-icon" size={18} />
          {!collapsed && <span>Log out</span>}
        </button>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}
