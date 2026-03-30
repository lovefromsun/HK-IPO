import { useState } from 'react'
import type { Account } from '../types'

interface AccountFormValues {
  accountNo: string
  ownerName: string
  email: string
  broker: string
  balance: string
  initialCapital: string
}

interface AccountFormSubmitValues {
  accountNo: string
  ownerName: string
  email: string
  broker: string
  balance: number | null
  initialCapital: number | null
}

interface AccountFormProps {
  initialValue?: Partial<Account>
  onSubmit: (value: AccountFormSubmitValues) => Promise<void>
  onCancel: () => void
}

const toInitialState = (initialValue?: Partial<Account>): AccountFormValues => ({
  accountNo: initialValue?.accountNo ?? '',
  ownerName: initialValue?.ownerName ?? '',
  email: initialValue?.email ?? '',
  broker: initialValue?.broker ?? '',
  balance:
    typeof initialValue?.balance === 'number' && Number.isFinite(initialValue.balance)
      ? String(initialValue.balance)
      : '',
  initialCapital:
    typeof initialValue?.initialCapital === 'number' &&
    Number.isFinite(initialValue.initialCapital)
      ? String(initialValue.initialCapital)
      : '',
})

export function AccountForm({ initialValue, onSubmit, onCancel }: AccountFormProps) {
  const [form, setForm] = useState<AccountFormValues>(toInitialState(initialValue))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field: keyof AccountFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!form.accountNo.trim() || !form.ownerName.trim()) {
      setError('账号编号和姓名为必填项')
      return
    }

    const normalizedBalance = form.balance.trim() ? Number(form.balance) : null
    if (normalizedBalance !== null && !Number.isFinite(normalizedBalance)) {
      setError('余额必须是有效数字')
      return
    }
    const normalizedInitialCapital = form.initialCapital.trim()
      ? Number(form.initialCapital)
      : null
    if (normalizedInitialCapital !== null && !Number.isFinite(normalizedInitialCapital)) {
      setError('初始资金必须是有效数字')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit({
        accountNo: form.accountNo.trim(),
        ownerName: form.ownerName.trim(),
        email: form.email.trim(),
        broker: form.broker.trim(),
        balance: normalizedBalance,
        initialCapital: normalizedInitialCapital,
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
        <label htmlFor="accountNo">账号编号</label>
        <input
          id="accountNo"
          value={form.accountNo}
          onChange={(event) => updateField('accountNo', event.target.value)}
          placeholder="例如 A001"
          maxLength={32}
        />
      </div>

      <div className="form-row">
        <label htmlFor="ownerName">姓名</label>
        <input
          id="ownerName"
          value={form.ownerName}
          onChange={(event) => updateField('ownerName', event.target.value)}
          placeholder="例如 张三"
          maxLength={32}
        />
      </div>

      <div className="form-row">
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => updateField('email', event.target.value)}
          placeholder="例如 name@example.com"
          maxLength={100}
        />
      </div>

      <div className="form-row">
        <label htmlFor="broker">券商</label>
        <input
          id="broker"
          value={form.broker}
          onChange={(event) => updateField('broker', event.target.value)}
          placeholder="例如 富途"
          maxLength={60}
        />
      </div>

      <div className="form-row">
        <label htmlFor="balance">余额</label>
        <input
          id="balance"
          type="number"
          step="0.01"
          value={form.balance}
          onChange={(event) => updateField('balance', event.target.value)}
          placeholder="例如 50000"
        />
      </div>

      <div className="form-row">
        <label htmlFor="initialCapital">初始资金</label>
        <input
          id="initialCapital"
          type="number"
          step="0.01"
          value={form.initialCapital}
          onChange={(event) => updateField('initialCapital', event.target.value)}
          placeholder="例如 100000"
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
