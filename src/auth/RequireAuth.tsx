import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { UserRole } from '../types'

export function RequireAuth({ requiredRole }: { requiredRole?: UserRole }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="auth-loading">
        <p>正在加载登录状态...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/accounts" replace />
  }

  return <Outlet />
}
