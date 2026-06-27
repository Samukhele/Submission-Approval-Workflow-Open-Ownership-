import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Loading } from './Feedback'

export function Layout() {
  const { user, loading, logout } = useAuth()

  if (loading) return <Loading />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">Approval Workflow</div>
        <nav aria-label="Main navigation">
          {user.role === 'APPLICANT' ? (
            <>
              <Link to="/">My applications</Link>
              <Link to="/applications/new">New</Link>
            </>
          ) : (
            <Link to="/review">Review queue</Link>
          )}
        </nav>
        <div className="user-menu">
          <span className="muted">{user.email}</span>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
