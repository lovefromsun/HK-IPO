import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AccountForm } from '../../components/AccountForm'
import { DEFAULT_OWNER_NAMES } from '../../data/defaultAccounts'
import {
  countAccountRecords,
  createAccount,
  deleteAccount,
  seedAccountsIfEmpty,
  updateAccount,
} from '../../db'
import { queryKeys } from '../../query/keys'
import { useAccountsQuery } from '../../query/hooks'
import type { Account } from '../../types'

type Mode = 'create' | 'edit' | null

export function AccountsPage() {
  const qc = useQueryClient()
  const { data: accounts = [], isPending } = useAccountsQuery()
  const [mode, setMode] = useState<Mode>(null)
  const [editing, setEditing] = useState<Account | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    seedAccountsIfEmpty(DEFAULT_OWNER_NAMES)
      .then(() => qc.invalidateQueries({ queryKey: queryKeys.accounts }))
      .catch(() => undefined)
  }, [qc])

  const handleCreate = async (value: {
    accountNo: string
    ownerName: string
    email: string
    broker: string
    balance: number | null
    initialCapital: number | null
  }) => {
    await createAccount(value)
    void qc.invalidateQueries({ queryKey: queryKeys.accounts })
    setMode(null)
  }

  const handleUpdate = async (value: {
    accountNo: string
    ownerName: string
    email: string
    broker: string
    balance: number | null
    initialCapital: number | null
  }) => {
    if (!editing?.id) return
    await updateAccount(editing.id, value)
    void qc.invalidateQueries({ queryKey: queryKeys.accounts })
    setMode(null)
    setEditing(null)
  }

  const handleDelete = async (account: Account) => {
    if (!account.id) return
    const firstConfirm = window.confirm(`确认删除账号 ${account.accountNo} - ${account.ownerName} 吗？`)
    if (!firstConfirm) return

    const hasRecords = (await countAccountRecords(account.id)) > 0
    const deleteWithRecords = window.confirm(
      '是否同时删除该账号下所有新股记录？点击“确定”会一并删除，点击“取消”则仅删除账号。',
    )

    if (!deleteWithRecords && hasRecords) {
      window.alert('该账号存在新股记录，请选择“同时删除记录”后再删除。')
      return
    }

    await deleteAccount(account.id, deleteWithRecords)
    void qc.invalidateQueries({ queryKey: queryKeys.accounts })
    if (deleteWithRecords) {
      void qc.invalidateQueries({ queryKey: queryKeys.records })
      void qc.invalidateQueries({ queryKey: queryKeys.recordsWithAccounts })
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>账号管理</h2>
          <p>维护港股账号基础信息（编号、姓名、邮箱、券商、余额、初始资金）</p>
        </div>
        <button type="button" onClick={() => setMode('create')}>
          新增账号
        </button>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {isPending ? <p className="data-hint">正在加载账号列表…</p> : null}

      {mode === 'create' ? (
        <div
          className="modal-backdrop"
          onClick={() => setMode(null)}
          role="presentation"
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="presentation">
            <h3>新增账号</h3>
            <AccountForm onSubmit={handleCreate} onCancel={() => setMode(null)} />
          </div>
        </div>
      ) : null}
      {mode === 'edit' ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            setMode(null)
            setEditing(null)
          }}
          role="presentation"
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="presentation">
            <h3>编辑账号</h3>
            <AccountForm
              initialValue={editing ?? undefined}
              onSubmit={handleUpdate}
              onCancel={() => {
                setMode(null)
                setEditing(null)
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>编号</th>
              <th>姓名</th>
              <th>邮箱</th>
              <th>券商</th>
              <th>余额</th>
              <th>初始资金</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length ? (
              accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.accountNo}</td>
                  <td>{account.ownerName}</td>
                  <td>{account.email || '-'}</td>
                  <td>{account.broker || '-'}</td>
                  <td>{account.balance ?? '-'}</td>
                  <td>{account.initialCapital ?? '-'}</td>
                  <td className="action-cell">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setEditing(account)
                        setMode('edit')
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => {
                        handleDelete(account).catch(() => {
                          setError('删除账号失败')
                        })
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="empty-cell">
                  暂无账号，请先新增账号
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
