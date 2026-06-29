import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Loading } from './Feedback'
import { Sidebar } from './layout/Sidebar'

export function Layout() {
  const { user, loading } = useAuth()

  if (loading) return <Loading />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content page-enter">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
