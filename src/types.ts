export interface Account {
  id?: number
  accountNo: string
  ownerName: string
  email?: string
  broker?: string
  balance?: number | null
  initialCapital?: number | null
  createdAt: string
  updatedAt: string
}

export interface Ipo {
  id?: number
  ipoName: string
  stockCode?: string
  greyMarketDate?: string
  listDate?: string
  participantAccountCount?: number | null
  createdAt: string
  updatedAt: string
}

export interface AccountIpoRecord {
  id?: number
  accountId: number
  ipoId?: number
  ipoNameSnapshot: string
  isAllotted: boolean
  allottedLots?: number
  allottedShares?: number
  allottedQty: number
  isSold: boolean
  greyOpenPrice?: number | null
  firstDayPrice?: number | null
  createdAt: string
  updatedAt: string
}

export interface RecordWithAccount extends AccountIpoRecord {
  accountNo: string
  ownerName: string
}

export type UserRole = 'admin' | 'operator'

export interface User {
  id?: number
  username: string
  displayName: string
  passwordSalt: string
  passwordHash: string
  role: UserRole
  isActive: boolean
  mustChangePassword: boolean
  failedLoginAttempts: number
  lockUntil?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface SafeUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  isActive: boolean
  mustChangePassword: boolean
  failedLoginAttempts: number
  lockUntil?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export type UserAuditAction =
  | 'login_success'
  | 'login_failed'
  | 'login_locked'
  | 'user_created'
  | 'password_changed'
  | 'password_reset'
  | 'user_status_changed'
  | 'user_role_changed'

export interface UserAuditLog {
  id?: number
  action: UserAuditAction
  actorUserId?: number
  actorUsername?: string
  targetUserId?: number
  targetUsername?: string
  detail?: string
  createdAt: string
}
