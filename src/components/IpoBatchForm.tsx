import { useMemo, useState } from 'react'
import type { Account } from '../types'

interface WinnerInput {
  accountId: number
  allottedQty: number
}

interface BatchPayload {
  ipoNameSnapshot: string
  greyOpenPrice: number | null
  firstDayPrice: number | null
  winners: WinnerInput[]
}

interface IpoBatchFormProps {
  accounts: Account[]
  onSubmit: (payload: BatchPayload) => Promise<void>
  onCancel: () => void
}

const numberOrNull = (value: string): number | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function IpoBatchForm({ accounts, onSubmit, onCancel }: IpoBatchFormProps) {
  const [ipoNameSnapshot, setIpoNameSnapshot] = useState('')
  const [greyOpenPrice, setGreyOpenPrice] = useState('')
  const [firstDayPrice, setFirstDayPrice] = useState('')
  const [winnerState, setWinnerState] = useState<Record<number, { selected: boolean; qty: number }>>(
    {},
  )
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedCount = useMemo(
    () => Object.values(winnerState).filter((item) => item.selected).length,
    [winnerState],
  )

  const updateWinnerSelected = (accountId: number, selected: boolean) => {
    setWinnerState((prev) => ({
      ...prev,
      [accountId]: {
        selected,
        qty: selected ? (prev[accountId]?.qty ?? 1) : 0,
      },
    }))
  }

  const updateWinnerQty = (accountId: number, qty: number) => {
    setWinnerState((prev) => ({
      ...prev,
      [accountId]: {
        selected: true,
        qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
      },
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!ipoNameSnapshot.trim()) {
      setError('请填写新股名称')
      return
    }

    if (selectedCount === 0) {
      setError('请至少选择一个中签账号')
      return
    }

    const normalizedGrey = numberOrNull(greyOpenPrice)
    const normalizedFirst = numberOrNull(firstDayPrice)
    if (normalizedGrey !== null && normalizedGrey < 0) {
      setError('暗盘开盘价不能为负数')
      return
    }
    if (normalizedFirst !== null && normalizedFirst < 0) {
      setError('上市首日价不能为负数')
      return
    }

    const winners = accounts
      .filter((account) => {
        const accountId = account.id ?? 0
        return winnerState[accountId]?.selected
      })
      .map((account) => {
        const accountId = account.id ?? 0
        return {
          accountId,
          allottedQty: Math.max(0, winnerState[accountId]?.qty ?? 0),
        }
      })

    try {
      setSubmitting(true)
      await onSubmit({
        ipoNameSnapshot: ipoNameSnapshot.trim(),
        greyOpenPrice: normalizedGrey,
        firstDayPrice: normalizedFirst,
        winners,
      })
    } catch {
      setError('批量保存失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <div className="form-row">
        <label htmlFor="batchIpoName">新股名称</label>
        <input
          id="batchIpoName"
          value={ipoNameSnapshot}
          onChange={(event) => setIpoNameSnapshot(event.target.value)}
          placeholder="例如 宁德时代港股"
          maxLength={80}
        />
      </div>

      <div className="form-inline">
        <div className="form-row">
          <label htmlFor="batchGrey">暗盘开盘价</label>
          <input
            id="batchGrey"
            type="number"
            min={0}
            step="0.0001"
            value={greyOpenPrice}
            onChange={(event) => setGreyOpenPrice(event.target.value)}
            placeholder="可选"
          />
        </div>
        <div className="form-row">
          <label htmlFor="batchFirst">上市首日价</label>
          <input
            id="batchFirst"
            type="number"
            min={0}
            step="0.0001"
            value={firstDayPrice}
            onChange={(event) => setFirstDayPrice(event.target.value)}
            placeholder="可选"
          />
        </div>
      </div>

      <p className="batch-tip">勾选中签账号并填写中签数量，未勾选账号将自动记录为未中签。</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>中签</th>
              <th>账号</th>
              <th>中签数量</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const accountId = account.id ?? 0
              const selected = winnerState[accountId]?.selected ?? false
              const qty = winnerState[accountId]?.qty ?? 1
              return (
                <tr key={account.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => updateWinnerSelected(accountId, event.target.checked)}
                    />
                  </td>
                  <td>
                    {account.accountNo} - {account.ownerName}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      disabled={!selected}
                      onChange={(event) => updateWinnerQty(accountId, Number(event.target.value))}
                      style={{ width: 110 }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="secondary-btn">
          取消
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? '保存中...' : `保存本只新股（中签 ${selectedCount} 个账号）`}
        </button>
      </div>
    </form>
  )
}
