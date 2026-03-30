import { apiUrl, JWT_STORAGE_KEY } from './apiConfig'

function errorMessageFromJsonBody(text: string, fallback: string): string {
  if (!text) return fallback
  try {
    const j = JSON.parse(text) as { error?: string }
    if (j.error) return j.error
  } catch {
    /* */
  }
  return fallback
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(JWT_STORAGE_KEY)
  const headers: Record<string, string> = {
    ...(typeof init.headers === 'object' && init.headers && !(init.headers instanceof Headers)
      ? (init.headers as Record<string, string>)
      : {}),
  }
  if (init.body !== undefined && typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const r = await fetch(apiUrl(path), { ...init, headers })
  const text = await r.text()
  if (r.status === 401) {
    localStorage.removeItem(JWT_STORAGE_KEY)
    throw new ApiError(errorMessageFromJsonBody(text, '未授权'), 401)
  }
  if (!r.ok) {
    throw new ApiError(errorMessageFromJsonBody(text, '请求失败'), r.status)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiLogin(username: string, password: string) {
  const r = await fetch(apiUrl('/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const text = await r.text()
  if (!r.ok) {
    throw new ApiError(errorMessageFromJsonBody(text, '登录失败'), r.status)
  }
  return JSON.parse(text) as { token: string; user: import('../types').SafeUser }
}
