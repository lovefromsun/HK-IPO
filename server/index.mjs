/**
 * 港股中签查询 — HTTP API + SQLite（Node >= 22.5）
 */
import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import {
  createStore,
  readFullSnapshot,
  writeFullSnapshot,
  seedDefaultAdmin,
  BACKUP_FORMAT_VERSION,
} from './sqlite-store.mjs'
import * as logic from './business-logic.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 3001)
const JWT_SECRET = process.env.JWT_SECRET
const SQLITE_PATH = process.env.SQLITE_PATH ?? path.join(__dirname, 'data', 'hk-ipo.sqlite')
const LEGACY_DATA_FILE = process.env.DATA_FILE ?? path.join(__dirname, 'data', 'snapshot.json')
const ADMIN_PASSWORD = process.env.HK_IPO_ADMIN_PASSWORD ?? 'admin123456'

let store = null

async function getDb() {
  if (!store) {
    store = await createStore(SQLITE_PATH, LEGACY_DATA_FILE)
    if (store.needsSeed) {
      seedDefaultAdmin(store.db, ADMIN_PASSWORD)
      console.log('[hk-ipo-api] 已初始化 SQLite 与默认管理员 admin（密码见 HK_IPO_ADMIN_PASSWORD）')
    }
  }
  return store.db
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' })
  }
  try {
    req.auth = jwt.verify(h.slice(7), JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: '令牌无效' })
  }
}

function adminMiddleware(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' })
  }
  next()
}

function handleError(res, e) {
  const msg = e instanceof Error ? e.message : '操作失败'
  res.status(400).json({ error: msg })
}

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '32mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: 'sqlite' })
})

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}
    const db = await getDb()
    const safe = logic.verifyUserCredentials(db, username, password)
    const fresh = logic.markUserLoginSuccess(db, safe.id)
    if (!fresh) {
      return res.status(500).json({ error: '登录状态异常' })
    }
    const token = jwt.sign(
      { sub: fresh.id, username: fresh.username, role: fresh.role },
      JWT_SECRET,
      { expiresIn: '30d' },
    )
    res.json({ token, user: fresh })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('密码') || e.message.includes('用户') || e.message.includes('锁定') || e.message.includes('停用'))) {
      return res.status(401).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: '登录失败' })
  }
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const id = Number(req.auth.sub)
    const user = logic.getSafeUserById(db, id)
    if (!user?.isActive) {
      return res.status(401).json({ error: '用户无效' })
    }
    res.json(user)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.get('/api/accounts', authMiddleware, async (_req, res) => {
  try {
    const db = await getDb()
    res.json(logic.listAccounts(db))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const id = logic.createAccount(db, req.body)
    res.status(201).json({ id })
  } catch (e) {
    handleError(res, e)
  }
})

app.post('/api/accounts/seed-defaults', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const names = req.body?.ownerNames
    if (!Array.isArray(names)) {
      return res.status(400).json({ error: 'ownerNames 需为数组' })
    }
    const n = logic.seedAccountsIfEmpty(db, names)
    res.json({ added: n })
  } catch (e) {
    handleError(res, e)
  }
})

app.patch('/api/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.updateAccount(db, Number(req.params.id), req.body)
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.delete('/api/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const withRecords = String(req.query.withRecords ?? '') === '1'
    logic.deleteAccount(db, Number(req.params.id), withRecords)
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.get('/api/accounts/:id/record-count', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    res.json({ count: logic.countAccountRecords(db, Number(req.params.id)) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.get('/api/ipos', authMiddleware, async (_req, res) => {
  try {
    const db = await getDb()
    res.json(logic.listIpos(db))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.post('/api/ipos', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const id = logic.createIpo(db, req.body)
    res.status(201).json({ id })
  } catch (e) {
    handleError(res, e)
  }
})

app.patch('/api/ipos/:id/participant-count', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.updateIpoParticipantAccountCount(db, Number(req.params.id), req.body?.participantAccountCount ?? null)
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.delete('/api/ipos/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.deleteIpo(db, Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.get('/api/records', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const raw = req.query.accountId
    const num = raw !== undefined && raw !== '' ? Number(raw) : NaN
    const accountId = Number.isFinite(num) ? num : undefined
    res.json(logic.listRecords(db, accountId))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.get('/api/records/with-accounts', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const raw = req.query.accountId
    const num = raw !== undefined && raw !== '' ? Number(raw) : NaN
    const accountId = Number.isFinite(num) ? num : undefined
    res.json(logic.listRecordsWithAccount(db, accountId))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.post('/api/records', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const id = logic.createRecord(db, req.body)
    res.status(201).json({ id })
  } catch (e) {
    handleError(res, e)
  }
})

app.patch('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.updateRecord(db, Number(req.params.id), req.body)
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.delete('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.deleteRecord(db, Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.post('/api/records/upsert-winner', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const id = logic.upsertIpoWinner(db, req.body)
    res.json({ id })
  } catch (e) {
    handleError(res, e)
  }
})

app.post('/api/records/batch-round', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.createIpoRoundRecords(db, req.body)
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    if (req.auth.role === 'admin') {
      res.json(logic.listUsers(db))
      return
    }
    const self = logic.getSafeUserById(db, Number(req.auth.sub))
    res.json(self ? [self] : [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.post('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const body = req.body ?? {}
    const user = logic.createUser(db, {
      ...body,
      actorUserId: Number(req.auth.sub),
    })
    res.status(201).json(user)
  } catch (e) {
    handleError(res, e)
  }
})

app.patch('/api/users/:id/active', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.setUserActiveStatus(db, Number(req.params.id), Boolean(req.body?.isActive), Number(req.auth.sub))
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.patch('/api/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.updateUserRole(db, Number(req.params.id), req.body?.role, Number(req.auth.sub))
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.post('/api/users/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    logic.resetUserPasswordByAdmin(db, Number(req.params.id), req.body?.newPassword, Number(req.auth.sub))
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.get('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const user = logic.getSafeUserById(db, Number(req.params.id))
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json(user)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.get('/api/audit-logs', authMiddleware, async (req, res) => {
  try {
    if (req.auth.role !== 'admin') {
      res.json([])
      return
    }
    const db = await getDb()
    const limit = req.query.limit ? Number(req.query.limit) : 200
    res.json(logic.listUserAuditLogs(db, limit))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.post('/api/me/change-password', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const body = req.body ?? {}
    logic.changeMyPassword(db, Number(req.auth.sub), body.currentPassword, body.newPassword)
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

app.get('/api/data', authMiddleware, async (_req, res) => {
  try {
    const db = await getDb()
    res.json(readFullSnapshot(db))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '读取失败' })
  }
})

app.put('/api/data', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const body = req.body
    if (!body || body.formatVersion !== BACKUP_FORMAT_VERSION) {
      return res.status(400).json({ error: '数据格式无效' })
    }
    if (!Array.isArray(body.accounts) || !Array.isArray(body.ipos) || !Array.isArray(body.accountIpoRecords)) {
      return res.status(400).json({ error: '缺少必要字段' })
    }
    const db = await getDb()
    writeFullSnapshot(db, body)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '保存失败' })
  }
})

async function main() {
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    console.error('请设置环境变量 JWT_SECRET（至少 16 位随机字符串）')
    process.exit(1)
  }
  await getDb()
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[hk-ipo-api] SQLite: ${SQLITE_PATH}`)
    console.log(`[hk-ipo-api] listening http://127.0.0.1:${PORT}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
