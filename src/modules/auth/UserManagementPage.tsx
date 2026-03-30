import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import {
  changeMyPassword,
  createUser,
  resetUserPasswordByAdmin,
  setUserActiveStatus,
  updateUserRole,
} from '../../db'
import { useAuditLogsQuery, useUsersQuery } from '../../query/hooks'
import { queryKeys } from '../../query/keys'
import type { SafeUser, UserAuditAction, UserRole } from '../../types'

const AUDIT_LIMIT = 120

const defaultCreateForm = {
  username: '',
  displayName: '',
  password: '',
  role: 'operator' as UserRole,
}

export function UserManagementPage() {
  const qc = useQueryClient()
  const { user, refreshCurrentUser, logout } = useAuth()
  const { data: users = [] } = useUsersQuery()
  const { data: auditLogs = [] } = useAuditLogsQuery(AUDIT_LIMIT)
  const refreshAdminData = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.users })
    void qc.invalidateQueries({ queryKey: queryKeys.auditLogs(AUDIT_LIMIT) })
  }
  const [createForm, setCreateForm] = useState(defaultCreateForm)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [adminResetPassword, setAdminResetPassword] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'admin'
  const forceChangeHint = user?.mustChangePassword
  const activeUsers = useMemo(() => users.filter((item) => item.isActive).length, [users])

  const actionTextMap: Record<UserAuditAction, string> = {
    login_success: '登录成功',
    login_failed: '登录失败',
    login_locked: '账号锁定',
    user_created: '创建用户',
    password_changed: '修改密码',
    password_reset: '重置密码',
    user_status_changed: '状态变更',
    user_role_changed: '角色变更',
  }

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isAdmin) return
    setError('')
    if (!createForm.username.trim() || !createForm.displayName.trim() || !createForm.password.trim()) {
      setError('请完整填写用户名、显示名称和初始密码')
      return
    }
    try {
      setSaving(true)
      await createUser({
        ...createForm,
        actorUserId: user?.id,
      })
      setCreateForm(defaultCreateForm)
      refreshAdminData()
      window.alert('用户创建成功')
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : '创建用户失败'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangeMyPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user?.id) return
    setError('')
    if (!oldPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setError('请完整填写密码信息')
      return
    }
    if (newPassword.trim() !== confirmNewPassword.trim()) {
      setError('两次新密码输入不一致')
      return
    }

    try {
      setSaving(true)
      await changeMyPassword(oldPassword, newPassword)
      setOldPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      await refreshCurrentUser()
      window.alert('密码修改成功，请使用新密码继续登录')
      logout()
    } catch (changeError) {
      const message = changeError instanceof Error ? changeError.message : '修改密码失败'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdminToggleUserStatus = async (item: SafeUser) => {
    if (!isAdmin || !item.id) return
    if (item.id === user?.id && item.isActive) {
      setError('不能停用当前登录账号')
      return
    }
    setError('')
    try {
      await setUserActiveStatus(item.id, !item.isActive, user?.id)
      refreshAdminData()
      window.alert('用户状态更新成功')
    } catch {
      setError('用户状态更新失败')
    }
  }

  const handleAdminRoleChange = async (item: SafeUser, role: UserRole) => {
    if (!isAdmin || !item.id) return
    if (item.id === user?.id && role !== user.role) {
      setError('不能修改当前登录管理员的角色')
      return
    }
    setError('')
    try {
      await updateUserRole(item.id, role, user?.id)
      refreshAdminData()
      window.alert('用户角色更新成功')
    } catch {
      setError('用户角色更新失败')
    }
  }

  const handleAdminResetPassword = async (item: SafeUser) => {
    if (!isAdmin || !item.id) return
    const nextPassword = adminResetPassword[item.id]?.trim() ?? ''
    if (!nextPassword) {
      setError('请先输入重置后的密码')
      return
    }
    setError('')
    try {
      await resetUserPasswordByAdmin(item.id, nextPassword, user?.id)
      setAdminResetPassword((prev) => ({ ...prev, [item.id]: '' }))
      refreshAdminData()
      window.alert('密码重置成功，用户下次登录需修改密码')
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : '密码重置失败'
      setError(message)
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>用户管理</h2>
          <p>支持创建用户、修改密码、角色和启用状态管理</p>
        </div>
      </header>

      {forceChangeHint ? (
        <p className="warning-text">当前账号为初始密码或已被重置，请先在下方修改密码。</p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}

      <section className="metrics-grid">
        <div className="metric-card">
          <p>用户总数</p>
          <strong>{users.length}</strong>
        </div>
        <div className="metric-card">
          <p>启用用户</p>
          <strong>{activeUsers}</strong>
        </div>
        <div className="metric-card">
          <p>当前用户</p>
          <strong>{user?.displayName ?? '-'}</strong>
        </div>
      </section>

      {isAdmin ? (
        <form className="form-card" onSubmit={handleCreateUser}>
          <h3>新增用户</h3>
          <div className="form-inline">
            <div className="form-row">
              <label htmlFor="new-username">用户名</label>
              <input
                id="new-username"
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="例如 trader01"
                maxLength={30}
              />
            </div>
            <div className="form-row">
              <label htmlFor="new-display-name">显示名称</label>
              <input
                id="new-display-name"
                value={createForm.displayName}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))
                }
                placeholder="例如 交易员A"
                maxLength={30}
              />
            </div>
            <div className="form-row">
              <label htmlFor="new-role">角色</label>
              <select
                id="new-role"
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, role: event.target.value as UserRole }))
                }
              >
                <option value="operator">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="new-password">初始密码</label>
              <input
                id="new-password"
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="至少6位"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? '创建中...' : '创建用户'}
            </button>
          </div>
        </form>
      ) : null}

      <form className="form-card" onSubmit={handleChangeMyPassword}>
        <h3>修改我的密码</h3>
        <div className="form-inline">
          <div className="form-row">
            <label htmlFor="old-password">当前密码</label>
            <input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="form-row">
            <label htmlFor="new-password-self">新密码</label>
            <input
              id="new-password-self"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="form-row">
            <label htmlFor="confirm-new-password-self">确认新密码</label>
            <input
              id="confirm-new-password-self"
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? '保存中...' : '修改密码'}
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>显示名称</th>
              <th>角色</th>
              <th>状态</th>
              <th>安全状态</th>
              <th>最后登录时间</th>
              {isAdmin ? <th>管理操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {users.length ? (
              users.map((item) => (
                <tr key={item.id}>
                  <td>{item.username}</td>
                  <td>{item.displayName}</td>
                  <td>{item.role === 'admin' ? '管理员' : '普通用户'}</td>
                  <td>{item.isActive ? '启用' : '停用'}</td>
                  <td>
                    {item.lockUntil && new Date(item.lockUntil).getTime() > Date.now()
                      ? `锁定至 ${new Date(item.lockUntil).toLocaleString()}`
                      : `失败次数 ${item.failedLoginAttempts}`}
                  </td>
                  <td>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : '-'}</td>
                  {isAdmin ? (
                    <td>
                      <div className="user-admin-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            handleAdminRoleChange(
                              item,
                              item.role === 'admin' ? 'operator' : 'admin',
                            ).catch(() => setError('用户角色更新失败'))
                          }}
                        >
                          设为{item.role === 'admin' ? '普通用户' : '管理员'}
                        </button>
                        <button
                          type="button"
                          className={item.isActive ? 'danger-btn' : 'secondary-btn'}
                          onClick={() => {
                            handleAdminToggleUserStatus(item).catch(() => {
                              setError('用户状态更新失败')
                            })
                          }}
                        >
                          {item.isActive ? '停用' : '启用'}
                        </button>
                        <div className="user-reset-wrap">
                          <input
                            type="password"
                            value={adminResetPassword[item.id] ?? ''}
                            placeholder="重置密码（至少6位）"
                            onChange={(event) =>
                              setAdminResetPassword((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => {
                              handleAdminResetPassword(item).catch(() => {
                                setError('密码重置失败')
                              })
                            }}
                          >
                            重置密码
                          </button>
                        </div>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="empty-cell">
                  暂无用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="form-card">
        <h3>最近操作日志</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>操作人</th>
                <th>目标用户</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length ? (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{actionTextMap[log.action]}</td>
                    <td>{log.actorUsername ?? '-'}</td>
                    <td>{log.targetUsername ?? '-'}</td>
                    <td>{log.detail ?? '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    暂无操作日志
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
