/**
 * 数据全部在服务端 SQLite；默认走 Vite 代理 `/api/hk-ipo` -> `http://127.0.0.1:3001/api`
 * 部署时可设 `VITE_API_BASE_URL` 覆盖。
 */
export function getApiBase(): string {
  const v = import.meta.env.VITE_API_BASE_URL
  if (typeof v === 'string' && v.trim()) return v.trim()
  return '/api/hk-ipo'
}

/** 例如 base=/api/hk-ipo path=/data -> /api/hk-ipo/data */
export function apiUrl(path: string): string {
  const base = getApiBase()
  if (!base) return ''
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

export const JWT_STORAGE_KEY = 'hk-ipo-jwt'
