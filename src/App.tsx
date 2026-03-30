import { useIsFetching } from '@tanstack/react-query'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { useAuth } from './auth/useAuth'
import { CoreDataPrefetch } from './components/CoreDataPrefetch'
import { AccountsPage } from './modules/accounts/AccountsPage'
import { LoginPage } from './modules/auth/LoginPage'
import { UserManagementPage } from './modules/auth/UserManagementPage'
import { AllotmentMatrixPage } from './modules/overview/AllotmentMatrixPage'
import { RecordsPage } from './modules/records/RecordsPage'
import { StatsPage } from './modules/stats/StatsPage'
import { DataBackupPage } from './modules/settings/DataBackupPage'

function DataSyncIndicator() {
  const fetching = useIsFetching({ fetchStatus: 'fetching' })
  if (fetching === 0) return null
  return (
    <span className="sync-strip" aria-live="polite">
      同步中…
    </span>
  )
}

function App() {
  const { user, logout } = useAuth()
  const navItems = [
    { to: '/accounts', label: '账号管理' },
    { to: '/records', label: '新股记录' },
    { to: '/matrix', label: '中签总览' },
    { to: '/stats', label: '汇总统计' },
    { to: '/users', label: '用户管理' },
    ...(user?.role === 'admin' ? [{ to: '/data-backup', label: '数据备份' }] : []),
  ]
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  return (
    <div className="layout">
      {user && !isLoginPage ? <CoreDataPrefetch /> : null}
      {!isLoginPage ? (
        <header className="app-header">
          <div>
            <h1>港股中签查询</h1>
            <p>账号中签情况管理工具</p>
          </div>
          <div className="header-right">
            <nav className="main-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="login-meta">
              <DataSyncIndicator />
              <span>
                当前用户：{user?.displayName ?? '-'} ({user?.role === 'admin' ? '管理员' : '普通用户'})
              </span>
              <button type="button" className="secondary-btn" onClick={logout}>
                退出登录
              </button>
            </div>
          </div>
        </header>
      ) : null}

      <main className="page-content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Navigate to="/accounts" replace />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/matrix" element={<AllotmentMatrixPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/data-backup" element={<DataBackupPage />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? '/accounts' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
