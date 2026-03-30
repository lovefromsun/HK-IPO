import { apiFetch } from '../lib/http'
import type {
  Account,
  AccountIpoRecord,
  Ipo,
  RecordWithAccount,
  SafeUser,
  User,
  UserAuditLog,
  UserRole,
} from '../types'

export const listAccounts = () => apiFetch<Account[]>('/accounts')

export const createAccount = async (
  payload: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
) => {
  const { id } = await apiFetch<{ id: number }>('/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return id
}

export const updateAccount = async (
  id: number,
  payload: Pick<
    Account,
    'accountNo' | 'ownerName' | 'email' | 'broker' | 'balance' | 'initialCapital'
  >,
) => {
  await apiFetch('/accounts/' + id, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return 1
}

export const countAccountRecords = async (accountId: number) => {
  const { count } = await apiFetch<{ count: number }>(`/accounts/${accountId}/record-count`)
  return count
}

export const deleteAccount = async (accountId: number, withRecords: boolean) => {
  const q = withRecords ? '?withRecords=1' : ''
  await apiFetch('/accounts/' + accountId + q, { method: 'DELETE' })
}

export const listIpos = () => apiFetch<Ipo[]>('/ipos')

export const deleteIpo = async (ipoId: number) => {
  await apiFetch('/ipos/' + ipoId, { method: 'DELETE' })
}

export const createIpo = async (payload: {
  ipoName: string
  stockCode?: string
  greyMarketDate?: string
  listDate?: string
  participantAccountCount?: number | null
}) => {
  const { id } = await apiFetch<{ id: number }>('/ipos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return id
}

export const updateIpoParticipantAccountCount = async (
  ipoId: number,
  participantAccountCount: number | null,
) => {
  await apiFetch('/ipos/' + ipoId + '/participant-count', {
    method: 'PATCH',
    body: JSON.stringify({ participantAccountCount }),
  })
  return 1
}

export const listRecords = async (accountId?: number) => {
  const q = typeof accountId === 'number' ? '?accountId=' + accountId : ''
  return apiFetch<AccountIpoRecord[]>('/records' + q)
}

export const listRecordsWithAccount = async (
  accountId?: number,
): Promise<RecordWithAccount[]> => {
  const q = typeof accountId === 'number' ? '?accountId=' + accountId : ''
  return apiFetch<RecordWithAccount[]>('/records/with-accounts' + q)
}

export const createRecord = async (
  payload: Omit<AccountIpoRecord, 'id' | 'createdAt' | 'updatedAt'>,
) => {
  const { id } = await apiFetch<{ id: number }>('/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return id
}

export const updateRecord = async (
  id: number,
  payload: Omit<AccountIpoRecord, 'id' | 'createdAt' | 'updatedAt'>,
) => {
  await apiFetch('/records/' + id, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return 1
}

export const deleteRecord = async (id: number) => {
  await apiFetch('/records/' + id, { method: 'DELETE' })
}

export const upsertIpoWinner = async (payload: {
  ipoId: number
  accountId: number
  allottedLots: number
  allottedShares: number
  isSold?: boolean
}) => {
  const { id } = await apiFetch<{ id: number }>('/records/upsert-winner', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return id
}

export interface BatchWinnerInput {
  accountId: number
  allottedQty: number
}

export interface BatchIpoRoundInput {
  ipoNameSnapshot: string
  winners: BatchWinnerInput[]
  greyOpenPrice: number | null
  firstDayPrice: number | null
}

export const createIpoRoundRecords = async (payload: BatchIpoRoundInput) => {
  await apiFetch('/records/batch-round', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const seedAccountsIfEmpty = async (ownerNames: readonly string[]) => {
  const { added } = await apiFetch<{ added: number }>('/accounts/seed-defaults', {
    method: 'POST',
    body: JSON.stringify({ ownerNames: [...ownerNames] }),
  })
  return added
}

export const listUserAuditLogs = async (limit = 200) =>
  apiFetch<UserAuditLog[]>('/audit-logs?limit=' + limit)

export const listUsers = async () => apiFetch<SafeUser[]>('/users')

export const createUser = async (payload: {
  username: string
  displayName: string
  password: string
  role: UserRole
  actorUserId?: number
}) => {
  return apiFetch<SafeUser>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const setUserActiveStatus = async (
  id: number,
  isActive: boolean,
  actorUserId?: number,
) => {
  await apiFetch('/users/' + id + '/active', {
    method: 'PATCH',
    body: JSON.stringify({ isActive, actorUserId }),
  })
}

export const updateUserRole = async (id: number, role: UserRole, actorUserId?: number) => {
  await apiFetch('/users/' + id + '/role', {
    method: 'PATCH',
    body: JSON.stringify({ role, actorUserId }),
  })
}

export const resetUserPasswordByAdmin = async (
  id: number,
  newPassword: string,
  actorUserId?: number,
) => {
  await apiFetch('/users/' + id + '/reset-password', {
    method: 'POST',
    body: JSON.stringify({ newPassword, actorUserId }),
  })
}

export const changeMyPassword = async (currentPassword: string, newPassword: string) => {
  await apiFetch('/me/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export const BACKUP_FORMAT_VERSION = 1

export interface FullBackupPayload {
  formatVersion: number
  exportedAt: string
  appDbName: string
  accounts: Account[]
  ipos: Ipo[]
  accountIpoRecords: AccountIpoRecord[]
  users: User[]
  userAuditLogs: UserAuditLog[]
}

const normalizeUserRow = (u: User): User => ({
  ...u,
  failedLoginAttempts: u.failedLoginAttempts ?? 0,
})

export const exportFullBackup = async (): Promise<FullBackupPayload> => {
  return apiFetch<FullBackupPayload>('/data')
}

export const importFullBackup = async (payload: unknown): Promise<void> => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('备份文件无效')
  }
  const raw = payload as Record<string, unknown>
  if (raw.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error('备份格式版本不匹配，请使用本工具导出的 JSON')
  }
  if (!Array.isArray(raw.accounts) || !Array.isArray(raw.ipos) || !Array.isArray(raw.accountIpoRecords)) {
    throw new Error('备份文件缺少账号、新股或记录数据')
  }
  const body = {
    ...raw,
    users: Array.isArray(raw.users) ? (raw.users as User[]).map(normalizeUserRow) : [],
    userAuditLogs: Array.isArray(raw.userAuditLogs) ? raw.userAuditLogs : [],
  }
  await apiFetch('/data', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
