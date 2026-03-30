/**
 * 一次性：将所有账号的券商字段更新为指定值（默认「卓锐」）
 * 用法: node scripts/set-all-broker.mjs
 *      BROKER_NAME=其他券商 node scripts/set-all-broker.mjs
 *      SQLITE_PATH=... node scripts/set-all-broker.mjs
 */
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQLITE_PATH = process.env.SQLITE_PATH ?? path.join(__dirname, '..', 'data', 'hk-ipo.sqlite')
const BROKER = process.env.BROKER_NAME ?? '卓锐'

if (!fs.existsSync(SQLITE_PATH)) {
  console.error('找不到数据库文件:', SQLITE_PATH)
  console.error('若库在其他路径，请设置环境变量 SQLITE_PATH')
  process.exit(1)
}

const db = new DatabaseSync(SQLITE_PATH)
const now = new Date().toISOString()
const stmt = db.prepare('UPDATE accounts SET broker = ?, updated_at = ?')
const result = stmt.run(BROKER, now)

const countRow = db.prepare('SELECT COUNT(*) AS n FROM accounts').get()
console.log('库路径:', SQLITE_PATH)
console.log('券商已设为:', BROKER)
console.log('本次影响行数:', result.changes ?? '(见 driver)')
console.log('账号总数:', countRow?.n ?? '?')
