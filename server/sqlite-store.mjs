/**
 * SQLite persistence for HK IPO snapshot (same shape as IndexedDB export)
 * Uses built-in node:sqlite (Node >= 22.5), no native addons.
 */
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash } from 'node:crypto'

export const BACKUP_FORMAT_VERSION = 1

const nowIso = () => new Date().toISOString()

export function createPasswordHash(password, salt) {
  return createHash('sha256').update(`${salt}:${password}`, 'utf8').digest('hex')
}

function openSqlite(filePath) {
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new DatabaseSync(filePath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY,
      account_no TEXT NOT NULL UNIQUE,
      owner_name TEXT NOT NULL,
      email TEXT,
      broker TEXT,
      balance REAL,
      initial_capital REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ipos (
      id INTEGER PRIMARY KEY,
      ipo_name TEXT NOT NULL UNIQUE,
      stock_code TEXT,
      grey_market_date TEXT,
      list_date TEXT,
      participant_account_count INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_ipo_records (
      id INTEGER PRIMARY KEY,
      account_id INTEGER NOT NULL,
      ipo_id INTEGER,
      ipo_name_snapshot TEXT NOT NULL,
      is_allotted INTEGER NOT NULL,
      allotted_lots INTEGER,
      allotted_shares INTEGER,
      allotted_qty INTEGER NOT NULL,
      is_sold INTEGER NOT NULL,
      grey_open_price REAL,
      first_day_price REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      must_change_password INTEGER NOT NULL,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      lock_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_audit_logs (
      id INTEGER PRIMARY KEY,
      action TEXT NOT NULL,
      actor_user_id INTEGER,
      actor_username TEXT,
      target_user_id INTEGER,
      target_username TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
  `)
}

export function rowAccount(r) {
  return {
    id: r.id,
    accountNo: r.account_no,
    ownerName: r.owner_name,
    ...(r.email != null && r.email !== '' ? { email: r.email } : {}),
    ...(r.broker != null && r.broker !== '' ? { broker: r.broker } : {}),
    balance: r.balance,
    initialCapital: r.initial_capital,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function rowIpo(r) {
  return {
    id: r.id,
    ipoName: r.ipo_name,
    ...(r.stock_code != null && r.stock_code !== '' ? { stockCode: r.stock_code } : {}),
    ...(r.grey_market_date ? { greyMarketDate: r.grey_market_date } : {}),
    ...(r.list_date ? { listDate: r.list_date } : {}),
    participantAccountCount: r.participant_account_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function rowRecord(r) {
  return {
    id: r.id,
    accountId: r.account_id,
    ...(r.ipo_id != null ? { ipoId: r.ipo_id } : {}),
    ipoNameSnapshot: r.ipo_name_snapshot,
    isAllotted: Boolean(r.is_allotted),
    ...(r.allotted_lots != null ? { allottedLots: r.allotted_lots } : {}),
    ...(r.allotted_shares != null ? { allottedShares: r.allotted_shares } : {}),
    allottedQty: r.allotted_qty,
    isSold: Boolean(r.is_sold),
    greyOpenPrice: r.grey_open_price,
    firstDayPrice: r.first_day_price,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function rowUser(r) {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    passwordSalt: r.password_salt,
    passwordHash: r.password_hash,
    role: r.role,
    isActive: Boolean(r.is_active),
    mustChangePassword: Boolean(r.must_change_password),
    failedLoginAttempts: r.failed_login_attempts ?? 0,
    ...(r.lock_until ? { lockUntil: r.lock_until } : {}),
    ...(r.last_login_at ? { lastLoginAt: r.last_login_at } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function toSafeUser(u) {
  return {
    id: u.id ?? 0,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    failedLoginAttempts: u.failedLoginAttempts ?? 0,
    lockUntil: u.lockUntil,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}

export function rowAudit(r) {
  return {
    id: r.id,
    action: r.action,
    ...(r.actor_user_id != null ? { actorUserId: r.actor_user_id } : {}),
    ...(r.actor_username ? { actorUsername: r.actor_username } : {}),
    ...(r.target_user_id != null ? { targetUserId: r.target_user_id } : {}),
    ...(r.target_username ? { targetUsername: r.target_username } : {}),
    ...(r.detail ? { detail: r.detail } : {}),
    createdAt: r.created_at,
  }
}

export function readFullSnapshot(db) {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY id').all().map(rowAccount)
  const ipos = db.prepare('SELECT * FROM ipos ORDER BY ipo_name').all().map(rowIpo)
  const accountIpoRecords = db
    .prepare('SELECT * FROM account_ipo_records ORDER BY created_at DESC')
    .all()
    .map(rowRecord)
  const users = db.prepare('SELECT * FROM users ORDER BY username').all().map(rowUser)
  const userAuditLogs = db
    .prepare('SELECT * FROM user_audit_logs ORDER BY created_at DESC')
    .all()
    .map(rowAudit)

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(),
    appDbName: 'hk-ipo-tracker-db',
    accounts,
    ipos,
    accountIpoRecords,
    users,
    userAuditLogs,
  }
}

export function writeFullSnapshot(db, body) {
  const accounts = body.accounts ?? []
  const ipos = body.ipos ?? []
  const accountIpoRecords = body.accountIpoRecords ?? []
  const users = body.users ?? []
  const userAuditLogs = body.userAuditLogs ?? []

  const insAccount = db.prepare(`
    INSERT INTO accounts (id, account_no, owner_name, email, broker, balance, initial_capital, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insIpo = db.prepare(`
    INSERT INTO ipos (id, ipo_name, stock_code, grey_market_date, list_date, participant_account_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insRecord = db.prepare(`
    INSERT INTO account_ipo_records (
      id, account_id, ipo_id, ipo_name_snapshot, is_allotted, allotted_lots, allotted_shares, allotted_qty,
      is_sold, grey_open_price, first_day_price, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insUser = db.prepare(`
    INSERT INTO users (
      id, username, display_name, password_salt, password_hash, role, is_active, must_change_password,
      failed_login_attempts, lock_until, last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insAudit = db.prepare(`
    INSERT INTO user_audit_logs (
      id, action, actor_user_id, actor_username, target_user_id, target_username, detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(`
      DELETE FROM user_audit_logs;
      DELETE FROM account_ipo_records;
      DELETE FROM ipos;
      DELETE FROM accounts;
      DELETE FROM users;
    `)
    for (const a of accounts) {
      insAccount.run(
        a.id,
        a.accountNo,
        a.ownerName,
        a.email ?? null,
        a.broker ?? null,
        a.balance ?? null,
        a.initialCapital ?? null,
        a.createdAt,
        a.updatedAt,
      )
    }
    for (const i of ipos) {
      insIpo.run(
        i.id,
        i.ipoName,
        i.stockCode ?? null,
        i.greyMarketDate ?? null,
        i.listDate ?? null,
        i.participantAccountCount ?? null,
        i.createdAt,
        i.updatedAt,
      )
    }
    for (const r of accountIpoRecords) {
      insRecord.run(
        r.id,
        r.accountId,
        r.ipoId ?? null,
        r.ipoNameSnapshot,
        r.isAllotted ? 1 : 0,
        r.allottedLots ?? null,
        r.allottedShares ?? null,
        r.allottedQty,
        r.isSold ? 1 : 0,
        r.greyOpenPrice ?? null,
        r.firstDayPrice ?? null,
        r.createdAt,
        r.updatedAt,
      )
    }
    for (const u of users) {
      insUser.run(
        u.id,
        u.username,
        u.displayName,
        u.passwordSalt,
        u.passwordHash,
        u.role,
        u.isActive ? 1 : 0,
        u.mustChangePassword ? 1 : 0,
        u.failedLoginAttempts ?? 0,
        u.lockUntil ?? null,
        u.lastLoginAt ?? null,
        u.createdAt,
        u.updatedAt,
      )
    }
    for (const l of userAuditLogs) {
      insAudit.run(
        l.id,
        l.action,
        l.actorUserId ?? null,
        l.actorUsername ?? null,
        l.targetUserId ?? null,
        l.targetUsername ?? null,
        l.detail ?? null,
        l.createdAt,
      )
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function userCount(db) {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c
}

export function findUserByUsername(db, username) {
  const u = String(username ?? '')
    .trim()
    .toLowerCase()
  if (!u) return null
  const row = db.prepare('SELECT * FROM users WHERE lower(username) = ?').get(u)
  return row ? rowUser(row) : null
}

export function seedDefaultAdmin(db, adminPassword) {
  const salt = randomBytes(16).toString('hex')
  const passwordHash = createPasswordHash(adminPassword, salt)
  const t = nowIso()
  db.prepare(
    `INSERT INTO users (
      id, username, display_name, password_salt, password_hash, role, is_active, must_change_password,
      failed_login_attempts, lock_until, last_login_at, created_at, updated_at
    ) VALUES (1, 'admin', '系统管理员', ?, ?, 'admin', 1, 1, 0, NULL, NULL, ?, ?)`,
  ).run(salt, passwordHash, t, t)
}

async function tryImportLegacyJson(db, jsonPath) {
  try {
    const raw = await fs.readFile(jsonPath, 'utf8')
    const data = JSON.parse(raw)
    if (data?.formatVersion !== BACKUP_FORMAT_VERSION || !Array.isArray(data.users)) return false
    if (data.users.length === 0) return false
    if (userCount(db) > 0) return false
    writeFullSnapshot(db, data)
    return true
  } catch {
    return false
  }
}

export async function createStore(sqliteDbPath, legacyJsonPath) {
  const db = openSqlite(sqliteDbPath)
  initSchema(db)

  if (userCount(db) === 0) {
    const imported = await tryImportLegacyJson(db, legacyJsonPath)
    if (!imported) {
      return { db, needsSeed: true }
    }
  }
  return { db, needsSeed: false }
}
