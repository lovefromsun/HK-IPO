/**
 * 一次性：将所有账号的初始资金设为同一数值（默认 11500）
 * 用法: node scripts/set-all-initial-capital.mjs
 *      INITIAL_CAPITAL=20000 node scripts/set-all-initial-capital.mjs
 */
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQLITE_PATH = process.env.SQLITE_PATH ?? path.join(__dirname, '..', 'data', 'hk-ipo.sqlite')
const INITIAL = Number(process.env.INITIAL_CAPITAL ?? '11500')

if (!Number.isFinite(INITIAL)) {
  console.error('INITIAL_CAPITAL 需为数字')
  process.exit(1)
}

if (!fs.existsSync(SQLITE_PATH)) {
  console.error('找不到数据库文件:', SQLITE_PATH)
  process.exit(1)
}

const db = new DatabaseSync(SQLITE_PATH)
const now = new Date().toISOString()
const stmt = db.prepare('UPDATE accounts SET initial_capital = ?, updated_at = ?')
const result = stmt.run(INITIAL, now)
const countRow = db.prepare('SELECT COUNT(*) AS n FROM accounts').get()

console.log('库路径:', SQLITE_PATH)
console.log('初始资金已设为:', INITIAL)
console.log('本次影响行数:', result.changes ?? '(见 driver)')
console.log('账号总数:', countRow?.n ?? '?')
