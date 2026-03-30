import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  createIpo,
  deleteIpo,
  deleteRecord,
  upsertIpoWinner,
} from '../../db'
import { useAccountsQuery, useIposQuery, useRecordsWithAccountQuery } from '../../query/hooks'
import { queryKeys } from '../../query/keys'
import type { RecordWithAccount } from '../../types'

type WinnerEditMode = 'create' | 'edit'
const getLotsValue = (record: RecordWithAccount) => Math.max(0, record.allottedLots ?? 0)
const getSharesValue = (record: RecordWithAccount) =>
  Math.max(0, record.allottedShares ?? record.allottedQty ?? 0)
const DEFAULT_LOT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const DEFAULT_SHARE_OPTIONS = [50, 100, 200, 300, 400, 500]

const getSelectOptions = (defaults: number[], currentValue: number) => {
  if (defaults.includes(currentValue)) return defaults
  return [...defaults, currentValue].sort((a, b) => a - b)
}

export function RecordsPage() {
  const [ipoName, setIpoName] = useState('')
  const [ipoStockCode, setIpoStockCode] = useState('')
  const [ipoGreyMarketDate, setIpoGreyMarketDate] = useState('')
  const [ipoListDate, setIpoListDate] = useState('')
  const [selectedIpoId, setSelectedIpoId] = useState<number | null>(null)
  const [winnerAccountId, setWinnerAccountId] = useState<number>(0)
  const [winnerLots, setWinnerLots] = useState<number>(1)
  const [winnerShares, setWinnerShares] = useState<number>(100)
  const [winnerMode, setWinnerMode] = useState<WinnerEditMode>('create')
  const [editingWinner, setEditingWinner] = useState<RecordWithAccount | null>(null)
  const [pendingSoldChanges, setPendingSoldChanges] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')
  const qc = useQueryClient()
  const { data: accounts = [], isPending: accountsPending } = useAccountsQuery()
  const { data: ipos = [], isPending: iposPending } = useIposQuery()
  const { data: records = [], isPending: recordsPending } = useRecordsWithAccountQuery()
  const listsLoading = accountsPending || iposPending || recordsPending

  const invalidateRecordQueries = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.records })
    void qc.invalidateQueries({ queryKey: queryKeys.recordsWithAccounts })
  }
  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.accounts })
    void qc.invalidateQueries({ queryKey: queryKeys.ipos })
    invalidateRecordQueries()
  }

  const selectedIpo = useMemo(
    () => ipos.find((item) => item.id === selectedIpoId) ?? null,
    [ipos, selectedIpoId],
  )
  const lotOptions = useMemo(
    () => getSelectOptions(DEFAULT_LOT_OPTIONS, winnerLots),
    [winnerLots],
  )
  const shareOptions = useMemo(
    () => getSelectOptions(DEFAULT_SHARE_OPTIONS, winnerShares),
    [winnerShares],
  )

  const winnerRecords = useMemo(() => {
    if (!selectedIpo) return []
    return records
      .filter(
        (record) =>
          record.isAllotted &&
          (record.ipoId === selectedIpo.id || record.ipoNameSnapshot === selectedIpo.ipoName),
      )
      .sort((a, b) => a.accountNo.localeCompare(b.accountNo, 'zh-Hans-CN'))
  }, [records, selectedIpo])

  const availableAccounts = useMemo(() => {
    if (winnerMode === 'edit' && editingWinner?.accountId) return accounts
    const usedSet = new Set(winnerRecords.map((item) => item.accountId))
    return accounts.filter((account) => !usedSet.has(account.id ?? 0))
  }, [accounts, winnerMode, editingWinner?.accountId, winnerRecords])

  const handleCreateIpo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!ipoName.trim()) {
      setError('请先填写新股名称')
      return
    }
    try {
      const newId = await createIpo({
        ipoName: ipoName.trim(),
        stockCode: ipoStockCode.trim() || undefined,
        greyMarketDate: ipoGreyMarketDate || undefined,
        listDate: ipoListDate || undefined,
      })

      const normalizedId =
        typeof newId === 'number' && Number.isFinite(newId) ? newId : Number(newId)

      setIpoName('')
      setIpoStockCode('')
      setIpoGreyMarketDate('')
      setIpoListDate('')
      setSelectedIpoId(Number.isFinite(normalizedId) ? normalizedId : null)
      void qc.invalidateQueries({ queryKey: queryKeys.ipos })
      window.alert('新股添加成功')
    } catch {
      setError('新股添加失败（名称可能重复）')
    }
  }

  const resetWinnerForm = () => {
    setWinnerMode('create')
    setEditingWinner(null)
    setWinnerLots(1)
    setWinnerShares(100)
    const firstId = availableAccounts[0]?.id ?? 0
    setWinnerAccountId(firstId)
  }

  const handleSaveWinner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!selectedIpo?.id) {
      setError('请先选择新股')
      return
    }
    if (!winnerAccountId) {
      setError('请选择账号')
      return
    }
    if (winnerLots < 0 || winnerShares < 0) {
      setError('中签手数和中签股数不能为负数')
      return
    }
    if (winnerLots === 0 && winnerShares === 0) {
      setError('中签手数和中签股数不能同时为0')
      return
    }
    try {
      await upsertIpoWinner({
        ipoId: selectedIpo.id,
        accountId: winnerAccountId,
        allottedLots: winnerLots,
        allottedShares: winnerShares,
        isSold: false,
      })
      resetWinnerForm()
      invalidateRecordQueries()
      window.alert('中签账号添加成功')
    } catch {
      setError('保存中签账号失败')
    }
  }

  const handleDeleteSelectedIpo = async () => {
    if (!selectedIpo?.id) {
      setError('请先选择新股')
      return
    }
    const confirmed = window.confirm(`确认删除新股“${selectedIpo.ipoName}”及其全部记录吗？`)
    if (!confirmed) return

    try {
      await deleteIpo(selectedIpo.id)
      setSelectedIpoId(null)
      setPendingSoldChanges({})
      resetWinnerForm()
      refreshAll()
      window.alert('新股删除成功')
    } catch {
      setError('删除新股失败')
    }
  }

  const handleSoldBatchSet = async (targetSold: boolean) => {
    if (!winnerRecords.length) return

    try {
      let updated = 0
      for (const record of winnerRecords) {
        if (!record.ipoId) continue
        await upsertIpoWinner({
          ipoId: record.ipoId,
          accountId: record.accountId,
          allottedLots: getLotsValue(record),
          allottedShares: getSharesValue(record),
          isSold: targetSold,
        })
        updated += 1
      }
      setPendingSoldChanges({})
      invalidateRecordQueries()
      window.alert(`修改成功，已更新 ${updated} 条记录为${targetSold ? '是' : '否'}`)
    } catch {
      setError('全选更新卖出状态失败')
    }
  }

  const handleSoldChange = async (record: RecordWithAccount, isSold: boolean) => {
    if (!record.id) return
    setPendingSoldChanges((prev) => ({ ...prev, [record.id as number]: isSold }))
  }

  const handleConfirmSoldChange = async (record: RecordWithAccount) => {
    if (!record.id) return
    const pendingValue = pendingSoldChanges[record.id]
    if (typeof pendingValue !== 'boolean') return
    if (!record.ipoId) {
      setError('该记录缺少新股ID，无法更新卖出状态')
      return
    }
    try {
      await upsertIpoWinner({
        ipoId: record.ipoId,
        accountId: record.accountId,
        allottedLots: getLotsValue(record),
        allottedShares: getSharesValue(record),
        isSold: pendingValue,
      })
      setPendingSoldChanges((prev) => {
        const next = { ...prev }
        delete next[record.id as number]
        return next
      })
      invalidateRecordQueries()
      window.alert('修改成功')
    } catch {
      setError('更新卖出状态失败')
    }
  }

  const handleCancelSoldChange = (record: RecordWithAccount) => {
    if (!record.id) return
    setPendingSoldChanges((prev) => {
      const next = { ...prev }
      delete next[record.id as number]
      return next
    })
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>新股记录</h2>
          <p>先添加新股，再在该新股下录入中签账号的中签手数和中签股数</p>
        </div>
      </header>

      {listsLoading ? <p className="data-hint">正在加载账号、新股与中签记录…</p> : null}

      {error ? <p className="error-text">{error}</p> : null}

      <form className="form-card" onSubmit={handleCreateIpo}>
        <h3>第一步：添加新股</h3>
        <div className="form-inline">
          <div className="form-row">
            <label htmlFor="ipoName">新股名称</label>
            <input
              id="ipoName"
              value={ipoName}
              onChange={(event) => setIpoName(event.target.value)}
              placeholder="例如 宁德时代港股"
            />
          </div>
          <div className="form-row">
            <label htmlFor="ipoStockCode">股票代码（可选）</label>
            <input
              id="ipoStockCode"
              value={ipoStockCode}
              onChange={(event) => setIpoStockCode(event.target.value)}
              placeholder="例如 09618"
            />
          </div>
        </div>
        <div className="form-inline">
          <div className="form-row">
            <label htmlFor="ipoGreyMarketDate">暗盘日期（可选）</label>
            <input
              id="ipoGreyMarketDate"
              type="date"
              value={ipoGreyMarketDate}
              onChange={(event) => setIpoGreyMarketDate(event.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="ipoListDate">上市日期（可选）</label>
            <input
              id="ipoListDate"
              type="date"
              value={ipoListDate}
              onChange={(event) => setIpoListDate(event.target.value)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit">添加新股</button>
        </div>
      </form>

      <form className="form-card" onSubmit={handleSaveWinner}>
        <h3>第二步：录入该新股的中签账号</h3>
        <div className="form-inline">
          <div className="form-row">
            <label htmlFor="selectedIpo">选择新股</label>
            <select
              id="selectedIpo"
              value={selectedIpoId ?? ''}
              onChange={(event) => {
                const next = Number(event.target.value) || null
                setSelectedIpoId(next)
                resetWinnerForm()
              }}
            >
              <option value="">请选择新股</option>
              {ipos.map((ipo) => (
                <option key={ipo.id} value={ipo.id}>
                  {ipo.ipoName}
                  {ipo.stockCode ? ` (${ipo.stockCode})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="winnerAccount">中签账号</label>
            <select
              id="winnerAccount"
              value={winnerAccountId}
              onChange={(event) => setWinnerAccountId(Number(event.target.value))}
              disabled={!selectedIpo}
            >
              <option value={0}>请选择账号</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountNo} - {account.ownerName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="winnerLots">中签手数</label>
            <select
              id="winnerLots"
              value={winnerLots}
              onChange={(event) => setWinnerLots(Number(event.target.value))}
              disabled={!selectedIpo}
            >
              {lotOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="winnerShares">中签股数</label>
            <select
              id="winnerShares"
              value={winnerShares}
              onChange={(event) => setWinnerShares(Number(event.target.value))}
              disabled={!selectedIpo}
            >
              {shareOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={!selectedIpo}>
            {winnerMode === 'edit' ? '更新中签账号' : '添加中签账号'}
          </button>
          <button
            type="button"
            className="danger-btn"
            disabled={!selectedIpo}
            onClick={() => {
              handleDeleteSelectedIpo().catch(() => setError('删除新股失败'))
            }}
          >
            删除当前新股
          </button>
          {winnerMode === 'edit' ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => resetWinnerForm()}
            >
              取消编辑
            </button>
          ) : null}
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>新股</th>
              <th>账号</th>
              <th>中签手数</th>
              <th>中签股数</th>
              <th>
                <div className="sold-header">
                  <span>是否卖出</span>
                  <div className="sold-header-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        handleSoldBatchSet(true).catch(() => setError('批量更新卖出状态失败'))
                      }}
                      disabled={!winnerRecords.length}
                    >
                      全部设为是
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        handleSoldBatchSet(false).catch(() => setError('批量更新卖出状态失败'))
                      }}
                      disabled={!winnerRecords.length}
                    >
                      全部设为否
                    </button>
                  </div>
                </div>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {winnerRecords.length ? (
              winnerRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.ipoNameSnapshot}</td>
                  <td>
                    {record.accountNo} - {record.ownerName}
                  </td>
                  <td>{getLotsValue(record)}</td>
                  <td>{getSharesValue(record)}</td>
                  <td>
                    {(() => {
                      const pendingValue = record.id
                        ? pendingSoldChanges[record.id]
                        : undefined
                      const selectedValue =
                        typeof pendingValue === 'boolean'
                          ? pendingValue
                          : record.isSold
                      const hasPending =
                        typeof pendingValue === 'boolean' &&
                        pendingValue !== record.isSold
                      return (
                        <div className="sold-editor">
                          <select
                            value={selectedValue ? 'yes' : 'no'}
                            onChange={(event) =>
                              handleSoldChange(record, event.target.value === 'yes').catch(
                                () => {
                                  setError('更新卖出状态失败')
                                },
                              )
                            }
                          >
                            <option value="no">否</option>
                            <option value="yes">是</option>
                          </select>
                          {hasPending ? (
                            <div className="sold-confirm-actions">
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => {
                                  handleConfirmSoldChange(record).catch(() => {
                                    setError('更新卖出状态失败')
                                  })
                                }}
                              >
                                确认
                              </button>
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => handleCancelSoldChange(record)}
                              >
                                取消
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="action-cell">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setWinnerMode('edit')
                        setEditingWinner(record)
                        setWinnerAccountId(record.accountId)
                        setWinnerLots(getLotsValue(record))
                        setWinnerShares(getSharesValue(record))
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => {
                        const isConfirmed = window.confirm('确认删除这条记录吗？')
                        if (!isConfirmed || !record.id) return
                        deleteRecord(record.id)
                          .then(() => {
                            if (editingWinner?.id === record.id) {
                              resetWinnerForm()
                            }
                            invalidateRecordQueries()
                          })
                          .catch(() => setError('删除记录失败'))
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty-cell">
                  暂无中签账号，请先选择新股后录入中签账号
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
