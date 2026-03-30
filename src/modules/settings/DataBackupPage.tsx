import { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { exportFullBackup, importFullBackup } from '../../db'

export function DataBackupPage() {
  const { user, refreshCurrentUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (user?.role !== 'admin') {
    return <Navigate to="/accounts" replace />
  }

  const handleExport = async () => {
    setError('')
    try {
      setBusy(true)
      const data = await exportFullBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const a = document.createElement('a')
      a.href = url
      a.download = `hk-ipo-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      window.alert('已导出备份文件，请妥善保管（内含登录密码哈希，勿泄露）')
    } catch {
      setError('导出失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const confirmed = window.confirm(
      '导入将覆盖服务器数据库中的全部业务数据（账号、新股、记录、用户与日志）。确定继续？',
    )
    if (!confirmed) return

    setError('')
    try {
      setBusy(true)
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      await importFullBackup(parsed)
      await refreshCurrentUser()
      window.alert('导入成功。若导入后无法登录，请使用备份中的管理员账号。')
    } catch (e) {
      const message = e instanceof Error ? e.message : '导入失败'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>数据备份</h2>
          <p>
            数据保存在服务端 SQLite。可用 JSON 做全量导出/导入（仅管理员）；导入会替换服务器当前全部业务数据。
          </p>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-card">
        <h3>导出备份</h3>
        <p className="batch-tip">
          文件包含账号/新股/中签记录、登录用户与审计日志；请自行保管，勿上传到公开位置。
        </p>
        <div className="form-actions">
          <button type="button" disabled={busy} onClick={() => handleExport().catch(() => setError('导出失败'))}>
            {busy ? '处理中...' : '下载 JSON 备份'}
          </button>
        </div>
      </div>

      <div className="form-card">
        <h3>导入备份</h3>
        <p className="batch-tip">
          选择本工具导出的 JSON，将<strong>写入服务器数据库</strong>并覆盖现有数据。完成后会刷新当前登录信息；若账号被替换导致失效，请重新登录。
        </p>
        <div className="form-actions backup-import-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            disabled={busy}
            onChange={(e) => {
              handleImportFile(e).catch(() => setError('导入失败'))
            }}
          />
          <button
            type="button"
            className="secondary-btn"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? '处理中...' : '选择备份文件导入'}
          </button>
        </div>
      </div>
    </section>
  )
}
