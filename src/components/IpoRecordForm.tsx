import { useEffect, useState } from 'react'
import type { Account, AccountIpoRecord } from '../types'

interface RecordFormValues {
  accountId: number
  ipoNameSnapshot: string
  isAllotted: boolean
  allottedQty: number
  isSold: boolean
  greyOpenPrice: string
  firstDayPrice: string
}

interface IpoRecordFormProps {
  accounts: Account[]
  initialValue?: Partial<AccountIpoRecord>
  presetAccountId?: number
  onSubmit: (
    payload: Omit<AccountIpoRecord, 'id' | 'createdAt' | 'updatedAt' | 'ipoId'>,
  ) => Promise<void>
  onCancel: () => void
}

const numberOrNull = (value: string): number | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function IpoRecordForm({
  accounts,
  initialValue,
  presetAccountId,
  onSubmit,
  onCancel,
}: IpoRecordFormProps) {
  const fallbackAccountId = presetAccountId ?? accounts[0]?.id ?? 0

  const [form, setForm] = useState<RecordFormValues>({
    accountId: initialValue?.accountId ?? fallbackAccountId,
    ipoNameSnapshot: initialValue?.ipoNameSnapshot ?? '',
    isAllotted: initialValue?.isAllotted ?? false,
    allottedQty: initialValue?.allottedQty ?? 0,
    isSold: initialValue?.isSold ?? false,
    greyOpenPrice: initialValue?.greyOpenPrice?.toString() ?? '',
    firstDayPrice: initialValue?.firstDayPrice?.toString() ?? '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!form.isAllotted && form.allottedQty !== 0) {
      setForm((prev) => ({ ...prev, allottedQty: 0 }))
    }
  }, [form.isAllotted, form.allottedQty])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!form.accountId) {
      setError('请选择账号')
      return
    }
    if (!form.ipoNameSnapshot.trim()) {
      setError('请填写新股名称')
      return
    }
    if (form.isAllotted && form.allottedQty < 0) {
      setError('中签数量不能为负数')
      return
    }

    const greyOpenPrice = numberOrNull(form.greyOpenPrice)
    const firstDayPrice = numberOrNull(form.firstDayPrice)
    if (greyOpenPrice !== null && greyOpenPrice < 0) {
      setError('暗盘开盘价不能为负数')
      return
    }
    if (firstDayPrice !== null && firstDayPrice < 0) {
      setError('上市首日价不能为负数')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit({
        accountId: form.accountId,
        ipoNameSnapshot: form.ipoNameSnapshot.trim(),
        isAllotted: form.isAllotted,
        allottedQty: form.isAllotted ? form.allottedQty : 0,
        isSold: form.isSold,
        greyOpenPrice,
        firstDayPrice,
      })
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <div className="form-row">
        <label htmlFor="accountId">账号</label>
        <select
          id="accountId"
          value={form.accountId}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, accountId: Number(event.target.value) }))
          }
          disabled={Boolean(presetAccountId)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.accountNo} - {account.ownerName}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="ipoNameSnapshot">新股名称</label>
        <input
          id="ipoNameSnapshot"
          value={form.ipoNameSnapshot}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, ipoNameSnapshot: event.target.value }))
          }
          placeholder="例如 宁德时代港股"
          maxLength={80}
        />
      </div>

      <div className="form-inline">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.isAllotted}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, isAllotted: event.target.checked }))
            }
          />
          是否中签
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.isSold}
            onChange={(event) => setForm((prev) => ({ ...prev, isSold: event.target.checked }))}
          />
          是否已卖出
        </label>
      </div>

      <div className="form-row">
        <label htmlFor="allottedQty">中签数量</label>
        <input
          id="allottedQty"
          type="number"
          min={0}
          value={form.allottedQty}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, allottedQty: Number(event.target.value) }))
          }
          disabled={!form.isAllotted}
        />
      </div>

      <div className="form-row">
        <label htmlFor="greyOpenPrice">暗盘开盘价</label>
        <input
          id="greyOpenPrice"
          type="number"
          min={0}
          step="0.0001"
          value={form.greyOpenPrice}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, greyOpenPrice: event.target.value }))
          }
          placeholder="可选"
        />
      </div>

      <div className="form-row">
        <label htmlFor="firstDayPrice">上市首日价</label>
        <input
          id="firstDayPrice"
          type="number"
          min={0}
          step="0.0001"
          value={form.firstDayPrice}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, firstDayPrice: event.target.value }))
          }
          placeholder="可选"
        />
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="secondary-btn">
          取消
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}
