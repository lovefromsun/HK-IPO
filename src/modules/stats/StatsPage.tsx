import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { updateIpoParticipantAccountCount } from '../../db'
import { useIposQuery, useRecordsWithAccountQuery } from '../../query/hooks'
import { queryKeys } from '../../query/keys'

export function StatsPage() {
  const [selectedIpoId, setSelectedIpoId] = useState<number | null>(null)
  const [participantDraft, setParticipantDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [error, setError] = useState('')
  const qc = useQueryClient()
  const { data: ipos = [], isPending: iposPending } = useIposQuery()
  const { data: records = [], isPending: recordsPending } = useRecordsWithAccountQuery()
  const listsLoading = iposPending || recordsPending

  const activeIpoId = selectedIpoId ?? ipos[0]?.id ?? null
  const selectedIpo = useMemo(
    () => ipos.find((item) => item.id === activeIpoId) ?? null,
    [ipos, activeIpoId],
  )

  const participantValue = useMemo(() => {
    if (!selectedIpo) return ''
    if (participantDraft) return participantDraft
    if (typeof selectedIpo.participantAccountCount === 'number') {
      return String(selectedIpo.participantAccountCount)
    }
    return ''
  }, [selectedIpo, participantDraft])

  const summary = useMemo(() => {
    if (!selectedIpo) {
      return {
        participantCount: 0,
        allottedCount: 0,
        allottedRate: '0%',
        winnerRecords: [],
      }
    }

    const winnerRecords = records.filter(
      (item) =>
        item.isAllotted &&
        (item.ipoId === selectedIpo.id || item.ipoNameSnapshot === selectedIpo.ipoName),
    )
    const allottedCount = winnerRecords.length
    const participantCount =
      typeof selectedIpo.participantAccountCount === 'number'
        ? selectedIpo.participantAccountCount
        : 0
    const allottedRate =
      participantCount === 0 ? '0%' : `${((allottedCount / participantCount) * 100).toFixed(2)}%`

    return {
      participantCount,
      allottedCount,
      allottedRate,
      winnerRecords,
    }
  }, [selectedIpo, records])

  const handleSaveParticipantCount = async () => {
    if (!selectedIpo?.id) {
      setError('请先选择新股')
      return
    }

    const value = participantValue.trim()
    if (!value) {
      await updateIpoParticipantAccountCount(selectedIpo.id, null)
      setParticipantDraft('')
      void qc.invalidateQueries({ queryKey: queryKeys.ipos })
      window.alert('参与账户数量已清空')
      return
    }

    const count = Number(value)
    if (!Number.isFinite(count) || count < 0) {
      setError('参与账户数量必须是非负数字')
      return
    }

    try {
      setSaving(true)
      setError('')
      await updateIpoParticipantAccountCount(selectedIpo.id, count)
      setParticipantDraft('')
      void qc.invalidateQueries({ queryKey: queryKeys.ipos })
      window.alert('参与账户数量更新成功')
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>汇总统计</h2>
          <p>以新股为导向统计：先录参与账户数量，再看中签情况</p>
        </div>
      </header>

      {listsLoading ? <p className="data-hint">正在加载新股与中签数据…</p> : null}

      <div className="filter-row">
        <label>
          新股选择：
          <select
            value={activeIpoId ?? ''}
            onChange={(event) =>
              setSelectedIpoId(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">请选择新股</option>
            {ipos.map((ipo) => (
              <option key={ipo.id} value={ipo.id}>
                {ipo.ipoName}
                {ipo.stockCode ? ` (${ipo.stockCode})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          参与账户数量（先录入）：
          <input
            type="number"
            min={0}
            value={participantValue}
            onChange={(event) => setParticipantDraft(event.target.value)}
            placeholder="例如 47"
            disabled={!selectedIpo}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            handleSaveParticipantCount().catch(() => setError('保存失败，请重试'))
          }}
          disabled={!selectedIpo || saving}
        >
          {saving ? '保存中...' : '保存参与数量'}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="metrics-grid">
        <div className="metric-card">
          <p>参与账户数量</p>
          <strong>{summary.participantCount}</strong>
        </div>
        <button
          type="button"
          className="metric-card clickable-card"
          title="点击查看中签账户明细"
          onClick={() => setShowWinnerModal(true)}
          disabled={!selectedIpo}
        >
          <p>中签账户数</p>
          <strong>{summary.allottedCount}</strong>
          <small className="metric-hint">点击查看明细</small>
        </button>
        <div className="metric-card">
          <p>中签率</p>
          <strong>{summary.allottedRate}</strong>
        </div>
      </section>

      {showWinnerModal ? (
        <div className="modal-backdrop" onClick={() => setShowWinnerModal(false)} role="presentation">
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="presentation">
            <h3>
              中签账户明细
              {selectedIpo ? ` - ${selectedIpo.ipoName}` : ''}
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>账号</th>
                    <th>中签手数</th>
                    <th>中签股数</th>
                    <th>是否卖出</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.winnerRecords.length ? (
                    summary.winnerRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {record.accountNo} - {record.ownerName}
                        </td>
                        <td>{record.allottedLots ?? 0}</td>
                        <td>{record.allottedShares ?? record.allottedQty}</td>
                        <td>{record.isSold ? '是' : '否'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty-cell">
                        当前新股暂无中签账户
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowWinnerModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
