/**
 * Domain logic: SQLite CRUD + user auth (mirrors former src/db/index.ts)
 */
import { randomBytes } from 'node:crypto'
import {
  createPasswordHash,
  rowAccount,
  rowIpo,
  rowRecord,
  rowUser,
  rowAudit,
  toSafeUser,
  findUserByUsername,
} from './sqlite-store.mjs'

const nowIso = () => new Date().toISOString()

const MIN_PASSWORD_LENGTH = 6
const MAX_LOGIN_ATTEMPTS = 5
const LOCK_MINUTES = 15

const accountNoSortValue = (accountNo) => {
  const parsed = Number(accountNo)
  if (Number.isFinite(parsed)) return parsed
  return Number.POSITIVE_INFINITY
}

function lastInsertId(db) {
  return Number(db.prepare('SELECT last_insert_rowid() AS i').get().i)
}

const normalizeUsername = (username) => String(username ?? '').trim().toLowerCase()

const assertPassword = (password) => {
  const normalized = String(password).trim()
  if (normalized.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`密码至少需要${MIN_PASSWORD_LENGTH}位`)
  }
  return normalized
}

const lockUntilText = (isoText) => {
  const diffMs = new Date(isoText).getTime() - Date.now()
  const leftMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)))
  return `登录失败次数过多，账号已锁定，请${leftMinutes}分钟后再试`
}

function insertAuditLog(db, payload) {
  db.prepare(
    `INSERT INTO user_audit_logs (action, actor_user_id, actor_username, target_user_id, target_username, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    payload.action,
    payload.actorUserId ?? null,
    payload.actorUsername ?? null,
    payload.targetUserId ?? null,
    payload.targetUsername ?? null,
    payload.detail ?? null,
    nowIso(),
  )
}

export function listAccounts(db) {
  const accounts = db.prepare('SELECT * FROM accounts').all().map(rowAccount)
  return accounts.sort((a, b) => {
    const byNumber = accountNoSortValue(a.accountNo) - accountNoSortValue(b.accountNo)
    if (byNumber !== 0) return byNumber
    return String(a.accountNo).localeCompare(String(b.accountNo), 'zh-Hans-CN')
  })
}

export function createAccount(db, payload) {
  const now = nowIso()
  db.prepare(
    `INSERT INTO accounts (account_no, owner_name, email, broker, balance, initial_capital, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    payload.accountNo,
    payload.ownerName,
    payload.email ?? null,
    payload.broker ?? null,
    payload.balance ?? null,
    payload.initialCapital ?? null,
    now,
    now,
  )
  return lastInsertId(db)
}

export function updateAccount(db, id, payload) {
  const n = db
    .prepare(
      `UPDATE accounts SET account_no = ?, owner_name = ?, email = ?, broker = ?, balance = ?, initial_capital = ?, updated_at = ?
     WHERE id = ?`,
    )
    .run(
      payload.accountNo,
      payload.ownerName,
      payload.email ?? null,
      payload.broker ?? null,
      payload.balance ?? null,
      payload.initialCapital ?? null,
      nowIso(),
      id,
    )
  return n.changes ?? 1
}

export function countAccountRecords(db, accountId) {
  return db.prepare('SELECT COUNT(*) AS c FROM account_ipo_records WHERE account_id = ?').get(accountId).c
}

export function deleteAccount(db, accountId, withRecords) {
  db.exec('BEGIN IMMEDIATE')
  try {
    if (withRecords) {
      db.prepare('DELETE FROM account_ipo_records WHERE account_id = ?').run(accountId)
    }
    db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function listIpos(db) {
  return db.prepare('SELECT * FROM ipos ORDER BY ipo_name').all().map(rowIpo)
}

export function deleteIpo(db, ipoId) {
  const ipo = db.prepare('SELECT * FROM ipos WHERE id = ?').get(ipoId)
  if (!ipo) return
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM account_ipo_records WHERE ipo_id = ?').run(ipoId)
    db.prepare('DELETE FROM account_ipo_records WHERE ipo_name_snapshot = ?').run(ipo.ipo_name)
    db.prepare('DELETE FROM ipos WHERE id = ?').run(ipoId)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function createIpo(db, payload) {
  const normalizedName = String(payload.ipoName ?? '').trim()
  if (!normalizedName) throw new Error('ipoName is required')
  const now = nowIso()
  db.prepare(
    `INSERT INTO ipos (ipo_name, stock_code, grey_market_date, list_date, participant_account_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    normalizedName,
    payload.stockCode?.trim() || null,
    payload.greyMarketDate ?? null,
    payload.listDate ?? null,
    payload.participantAccountCount ?? null,
    now,
    now,
  )
  return lastInsertId(db)
}

export function updateIpoParticipantAccountCount(db, ipoId, participantAccountCount) {
  return db
    .prepare('UPDATE ipos SET participant_account_count = ?, updated_at = ? WHERE id = ?')
    .run(participantAccountCount, nowIso(), ipoId).changes ?? 1
}

export function upsertIpoByName(db, ipoName, listDate) {
  const normalizedName = String(ipoName ?? '').trim()
  const now = nowIso()
  const existing = db.prepare('SELECT * FROM ipos WHERE lower(ipo_name) = lower(?)').get(normalizedName)
  if (existing?.id) {
    db.prepare('UPDATE ipos SET list_date = ?, updated_at = ? WHERE id = ?').run(listDate ?? null, now, existing.id)
    return existing.id
  }
  db.prepare(
    `INSERT INTO ipos (ipo_name, list_date, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(normalizedName, listDate ?? null, now, now)
  return lastInsertId(db)
}

export function listRecords(db, accountId) {
  let rows
  if (typeof accountId === 'number') {
    rows = db.prepare('SELECT * FROM account_ipo_records WHERE account_id = ?').all(accountId)
  } else {
    rows = db.prepare('SELECT * FROM account_ipo_records').all()
  }
  const base = rows.map(rowRecord)
  return base.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listRecordsWithAccount(db, accountId) {
  const records = listRecords(db, accountId)
  const accounts = listAccounts(db)
  const accountMap = new Map(accounts.map((item) => [item.id, item]))
  return records
    .map((record) => {
      const account = accountMap.get(record.accountId)
      if (!account) return null
      return {
        ...record,
        accountNo: account.accountNo,
        ownerName: account.ownerName,
      }
    })
    .filter(Boolean)
}

export function createRecord(db, payload) {
  const now = nowIso()
  const shares = payload.isAllotted
    ? Math.max(payload.allottedShares ?? payload.allottedQty ?? 0, 0)
    : 0
  const lots = payload.isAllotted ? Math.max(payload.allottedLots ?? 0, 0) : 0
  const ipoId = upsertIpoByName(db, payload.ipoNameSnapshot)
  db.prepare(
    `INSERT INTO account_ipo_records (
      account_id, ipo_id, ipo_name_snapshot, is_allotted, allotted_lots, allotted_shares, allotted_qty,
      is_sold, grey_open_price, first_day_price, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    payload.accountId,
    ipoId,
    payload.ipoNameSnapshot,
    payload.isAllotted ? 1 : 0,
    lots,
    shares,
    shares,
    payload.isSold ? 1 : 0,
    payload.greyOpenPrice ?? null,
    payload.firstDayPrice ?? null,
    now,
    now,
  )
  return lastInsertId(db)
}

export function updateRecord(db, id, payload) {
  const shares = payload.isAllotted
    ? Math.max(payload.allottedShares ?? payload.allottedQty ?? 0, 0)
    : 0
  const lots = payload.isAllotted ? Math.max(payload.allottedLots ?? 0, 0) : 0
  const ipoId = upsertIpoByName(db, payload.ipoNameSnapshot)
  return db
    .prepare(
      `UPDATE account_ipo_records SET
        account_id = ?, ipo_id = ?, ipo_name_snapshot = ?, is_allotted = ?, allotted_lots = ?, allotted_shares = ?,
        allotted_qty = ?, is_sold = ?, grey_open_price = ?, first_day_price = ?, updated_at = ?
      WHERE id = ?`,
    )
    .run(
      payload.accountId,
      ipoId,
      payload.ipoNameSnapshot,
      payload.isAllotted ? 1 : 0,
      lots,
      shares,
      shares,
      payload.isSold ? 1 : 0,
      payload.greyOpenPrice ?? null,
      payload.firstDayPrice ?? null,
      nowIso(),
      id,
    ).changes ?? 1
}

export function deleteRecord(db, id) {
  db.prepare('DELETE FROM account_ipo_records WHERE id = ?').run(id)
}

export function upsertIpoWinner(db, payload) {
  const ipo = db.prepare('SELECT * FROM ipos WHERE id = ?').get(payload.ipoId)
  if (!ipo?.ipo_name) throw new Error('IPO not found')

  const ipoNameSnapshot = ipo.ipo_name
  const now = nowIso()
  const lots = Math.max(0, payload.allottedLots)
  const shares = Math.max(0, payload.allottedShares)
  const normalizedIsSold = Boolean(payload.isSold)
  const existing = db
    .prepare(
      'SELECT * FROM account_ipo_records WHERE account_id = ? AND ipo_name_snapshot = ?',
    )
    .get(payload.accountId, ipoNameSnapshot)

  if (existing?.id) {
    db.prepare(
      `UPDATE account_ipo_records SET
        ipo_id = ?, is_allotted = 1, allotted_lots = ?, allotted_shares = ?, allotted_qty = ?,
        is_sold = ?, updated_at = ?
      WHERE id = ?`,
    ).run(payload.ipoId, lots, shares, shares, normalizedIsSold ? 1 : 0, now, existing.id)
    return existing.id
  }

  db.prepare(
    `INSERT INTO account_ipo_records (
      account_id, ipo_id, ipo_name_snapshot, is_allotted, allotted_lots, allotted_shares, allotted_qty,
      is_sold, grey_open_price, first_day_price, created_at, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
  ).run(
    payload.accountId,
    payload.ipoId,
    ipoNameSnapshot,
    lots,
    shares,
    shares,
    normalizedIsSold ? 1 : 0,
    now,
    now,
  )
  return lastInsertId(db)
}

export function createIpoRoundRecords(db, payload) {
  const ipoNameSnapshot = String(payload.ipoNameSnapshot ?? '').trim()
  if (!ipoNameSnapshot) return

  const accounts = listAccounts(db)
  const ipoId = upsertIpoByName(db, ipoNameSnapshot)
  const winnerMap = new Map(
    (payload.winners ?? []).map((item) => [item.accountId, Math.max(0, item.allottedQty)]),
  )

  db.exec('BEGIN IMMEDIATE')
  try {
    for (const account of accounts) {
      if (!account.id) continue
      const isAllotted = winnerMap.has(account.id)
      const allottedQty = isAllotted ? winnerMap.get(account.id) ?? 0 : 0
      const now = nowIso()
      const existing = db
        .prepare(
          'SELECT * FROM account_ipo_records WHERE account_id = ? AND ipo_name_snapshot = ?',
        )
        .get(account.id, ipoNameSnapshot)

      if (existing?.id) {
        db.prepare(
          `UPDATE account_ipo_records SET
            ipo_id = ?, is_allotted = ?, allotted_qty = ?, is_sold = ?,
            grey_open_price = ?, first_day_price = ?, updated_at = ?
          WHERE id = ?`,
        ).run(
          ipoId,
          isAllotted ? 1 : 0,
          allottedQty,
          isAllotted ? (existing.is_sold ? 1 : 0) : 0,
          payload.greyOpenPrice ?? null,
          payload.firstDayPrice ?? null,
          now,
          existing.id,
        )
      } else {
        db.prepare(
          `INSERT INTO account_ipo_records (
            account_id, ipo_id, ipo_name_snapshot, is_allotted, allotted_qty, is_sold,
            grey_open_price, first_day_price, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        ).run(
          account.id,
          ipoId,
          ipoNameSnapshot,
          isAllotted ? 1 : 0,
          allottedQty,
          payload.greyOpenPrice ?? null,
          payload.firstDayPrice ?? null,
          now,
          now,
        )
      }
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function seedAccountsIfEmpty(db, ownerNames) {
  const c = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n
  if (c > 0) return 0
  const now = nowIso()
  const rows = ownerNames
    .map((ownerName, index) => ({
      accountNo: String(index + 1),
      ownerName: String(ownerName).trim(),
    }))
    .filter((item) => item.ownerName)
  if (!rows.length) return 0
  const ins = db.prepare(
    `INSERT INTO accounts (account_no, owner_name, email, broker, balance, initial_capital, created_at, updated_at)
     VALUES (?, ?, '', '', NULL, NULL, ?, ?)`,
  )
  for (const row of rows) {
    ins.run(row.accountNo, row.ownerName, now, now)
  }
  return rows.length
}

export function listUserAuditLogs(db, limit = 200) {
  return db
    .prepare('SELECT * FROM user_audit_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit)
    .map(rowAudit)
}

function getFullUserById(db, id) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  return row ? rowUser(row) : null
}

export function getSafeUserById(db, id) {
  const u = getFullUserById(db, id)
  return u ? toSafeUser(u) : null
}

export function listUsers(db) {
  return db
    .prepare('SELECT * FROM users ORDER BY username')
    .all()
    .map(rowUser)
    .map(toSafeUser)
}

export function createUser(db, payload) {
  const username = normalizeUsername(payload.username)
  if (!username) throw new Error('用户名不能为空')
  const displayName = String(payload.displayName ?? '').trim()
  if (!displayName) throw new Error('显示名称不能为空')
  const existing = findUserByUsername(db, username)
  if (existing?.id) throw new Error('用户名已存在')
  const password = assertPassword(payload.password)
  const salt = randomBytes(16).toString('hex')
  const passwordHash = createPasswordHash(password, salt)
  const now = nowIso()
  db.prepare(
    `INSERT INTO users (
      username, display_name, password_salt, password_hash, role, is_active, must_change_password,
      failed_login_attempts, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, 1, 0, ?, ?)`,
  ).run(username, displayName, salt, passwordHash, payload.role, now, now)
  const id = lastInsertId(db)
  const created = getFullUserById(db, id)
  const actor = payload.actorUserId ? getFullUserById(db, payload.actorUserId) : null
  insertAuditLog(db, {
    action: 'user_created',
    actorUserId: actor?.id,
    actorUsername: actor?.username,
    targetUserId: created?.id,
    targetUsername: created?.username,
    detail: `角色=${created?.role}`,
  })
  return toSafeUser(created)
}

export function setUserActiveStatus(db, id, isActive, actorUserId) {
  const target = getFullUserById(db, id)
  if (!target?.id) throw new Error('用户不存在')
  db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?').run(
    isActive ? 1 : 0,
    nowIso(),
    id,
  )
  const actor = actorUserId ? getFullUserById(db, actorUserId) : null
  insertAuditLog(db, {
    action: 'user_status_changed',
    actorUserId: actor?.id,
    actorUsername: actor?.username,
    targetUserId: target.id,
    targetUsername: target.username,
    detail: isActive ? '启用' : '停用',
  })
}

export function updateUserRole(db, id, role, actorUserId) {
  const target = getFullUserById(db, id)
  if (!target?.id) throw new Error('用户不存在')
  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, nowIso(), id)
  const actor = actorUserId ? getFullUserById(db, actorUserId) : null
  insertAuditLog(db, {
    action: 'user_role_changed',
    actorUserId: actor?.id,
    actorUsername: actor?.username,
    targetUserId: target.id,
    targetUsername: target.username,
    detail: `角色=${role}`,
  })
}

export function resetUserPasswordByAdmin(db, id, newPassword, actorUserId) {
  const target = getFullUserById(db, id)
  if (!target?.id) throw new Error('用户不存在')
  const password = assertPassword(newPassword)
  const salt = randomBytes(16).toString('hex')
  const passwordHash = createPasswordHash(password, salt)
  db.prepare(
    `UPDATE users SET password_salt = ?, password_hash = ?, must_change_password = 1,
      failed_login_attempts = 0, lock_until = NULL, updated_at = ? WHERE id = ?`,
  ).run(salt, passwordHash, nowIso(), id)
  const actor = actorUserId ? getFullUserById(db, actorUserId) : null
  insertAuditLog(db, {
    action: 'password_reset',
    actorUserId: actor?.id,
    actorUsername: actor?.username,
    targetUserId: target.id,
    targetUsername: target.username,
    detail: '管理员重置密码',
  })
}

export function changeMyPassword(db, id, currentPassword, newPassword) {
  const target = getFullUserById(db, id)
  if (!target?.id) throw new Error('用户不存在')
  const currentHash = createPasswordHash(String(currentPassword).trim(), target.passwordSalt)
  if (currentHash !== target.passwordHash) throw new Error('当前密码错误')
  const password = assertPassword(newPassword)
  const salt = randomBytes(16).toString('hex')
  const passwordHash = createPasswordHash(password, salt)
  db.prepare(
    `UPDATE users SET password_salt = ?, password_hash = ?, must_change_password = 0,
      failed_login_attempts = 0, lock_until = NULL, updated_at = ? WHERE id = ?`,
  ).run(salt, passwordHash, nowIso(), id)
  insertAuditLog(db, {
    action: 'password_changed',
    actorUserId: target.id,
    actorUsername: target.username,
    targetUserId: target.id,
    targetUsername: target.username,
    detail: '用户自主修改密码',
  })
}

export function verifyUserCredentials(db, username, password) {
  const normalizedUsername = normalizeUsername(username)
  if (!normalizedUsername) throw new Error('请输入用户名')
  const user = findUserByUsername(db, normalizedUsername)
  if (!user) throw new Error('用户名或密码错误')
  if (!user.isActive) throw new Error('该用户已停用，请联系管理员')

  if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
    insertAuditLog(db, {
      action: 'login_locked',
      targetUserId: user.id,
      targetUsername: user.username,
      detail: '锁定期间尝试登录',
    })
    throw new Error(lockUntilText(user.lockUntil))
  }

  const passwordHash = createPasswordHash(String(password).trim(), user.passwordSalt)
  if (passwordHash !== user.passwordHash) {
    const nextAttempts = (user.failedLoginAttempts ?? 0) + 1
    if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
      db.prepare('UPDATE users SET failed_login_attempts = 0, lock_until = ?, updated_at = ? WHERE id = ?').run(
        lockUntil,
        nowIso(),
        user.id,
      )
      insertAuditLog(db, {
        action: 'login_locked',
        targetUserId: user.id,
        targetUsername: user.username,
        detail: `连续失败${MAX_LOGIN_ATTEMPTS}次，已锁定`,
      })
      throw new Error(lockUntilText(lockUntil))
    }
    db.prepare('UPDATE users SET failed_login_attempts = ?, updated_at = ? WHERE id = ?').run(
      nextAttempts,
      nowIso(),
      user.id,
    )
    insertAuditLog(db, {
      action: 'login_failed',
      targetUserId: user.id,
      targetUsername: user.username,
      detail: `密码错误，第${nextAttempts}次`,
    })
    throw new Error(`用户名或密码错误，还可尝试${MAX_LOGIN_ATTEMPTS - nextAttempts}次`)
  }

  if ((user.failedLoginAttempts ?? 0) > 0 || user.lockUntil) {
    db.prepare(
      'UPDATE users SET failed_login_attempts = 0, lock_until = NULL, updated_at = ? WHERE id = ?',
    ).run(nowIso(), user.id)
  }
  return toSafeUser(user)
}

export function markUserLoginSuccess(db, id) {
  const now = nowIso()
  const user = getFullUserById(db, id)
  db.prepare(
    'UPDATE users SET last_login_at = ?, failed_login_attempts = 0, lock_until = NULL, updated_at = ? WHERE id = ?',
  ).run(now, now, id)
  insertAuditLog(db, {
    action: 'login_success',
    actorUserId: user?.id,
    actorUsername: user?.username,
    targetUserId: user?.id,
    targetUsername: user?.username,
    detail: '登录成功',
  })
  return getSafeUserById(db, id)
}
