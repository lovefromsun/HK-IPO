/**
 * 按「账号管理」列表顺序（与 listAccounts 一致：account_no 数字序）将邮箱赋给前 47 个账号。
 * 用法: node scripts/set-account-emails-47.mjs
 */
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { DatabaseSync } from 'node:sqlite'
import * as logic from '../business-logic.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQLITE_PATH = process.env.SQLITE_PATH ?? path.join(__dirname, '..', 'data', 'hk-ipo.sqlite')

/** 自上而下非空行顺序，共 47 个；末尾多出的两行未纳入 */
const EMAILS = [
  'hcwwl04@sina.com',
  'hcwwl03@sina.com',
  '1397582421@qq.com',
  '582358011@qq.com',
  '51491089@qq.com',
  '1729787436@qq.com',
  'hcwwl01@sina.com',
  'hcwwl02@sina.com',
  'xu13585335535@163.com',
  'xu15961266308@163.com',
  'hcwwl06@sina.com',
  'hcwwl07@sina.com',
  'hcwwl05@sina.com',
  'hcwwl08@sina.com',
  'hcwwl10@sina.com',
  'hcwwl09@sina.com',
  'hcwwl11@sina.com',
  'hcwwl12@sina.com',
  'hcwwl13@sina.com',
  'hcwwl14@sina.com',
  'hcwwl15@sina.com',
  'hcwwl17@sina.com',
  'hcwwl18@sina.com',
  'hcwwl20@sina.com',
  'hcwwl21@sina.com',
  'hcwwl23@sina.com',
  'hcwwl24@sina.com',
  'hcwwl25@sina.com',
  'hcwwl26@sina.com',
  'hcwwl27@sina.com',
  'hcwwl16@sina.com',
  'hcwwl28@sina.com',
  'hcwwl29@sina.com',
  'hcwwl30@sina.com',
  'hcwwl31@sina.com',
  'hcwwl32@sina.com',
  'hcwwl33@sina.com',
  'hcwwl34@sina.com',
  'hcwwl35@sina.com',
  'hcwwl36@sina.com',
  'hcwwl38@sina.com',
  'hcwwl22@sina.com',
  'hcwwl39@sina.com',
  'hcwwl40@sina.com',
  'hcwwl41@sina.com',
  'hcwwl42@sina.com',
  'hcwwl43@sina.com',
]

if (!fs.existsSync(SQLITE_PATH)) {
  console.error('找不到数据库:', SQLITE_PATH)
  process.exit(1)
}

if (EMAILS.length !== 47) {
  console.error('脚本内邮箱数量应为 47，当前', EMAILS.length)
  process.exit(1)
}

const db = new DatabaseSync(SQLITE_PATH)
const accounts = logic.listAccounts(db)

if (accounts.length !== 47) {
  console.error(
    `当前账号数为 ${accounts.length}，与邮箱 47 条不一致；请先核对数据库或使用自定义脚本。`,
  )
  process.exit(1)
}

const now = new Date().toISOString()
const stmt = db.prepare('UPDATE accounts SET email = ?, updated_at = ? WHERE id = ?')

for (let i = 0; i < 47; i++) {
  const a = accounts[i]
  const email = EMAILS[i]
  stmt.run(email, now, a.id)
  console.log(`${i + 1}. id=${a.id} account_no=${a.accountNo} -> ${email}`)
}

console.log('完成：已更新 47 条 accounts.email')
