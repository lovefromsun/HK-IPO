import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SafeUser } from '../types'
import { apiFetch, apiLogin } from '../lib/http'
import { AuthContext, type AuthContextValue } from './context'
import { JWT_STORAGE_KEY } from '../lib/apiConfig'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      try {
        const jwt = localStorage.getItem(JWT_STORAGE_KEY)
        if (jwt) {
          try {
            const me = await apiFetch<SafeUser>('/auth/me')
            if (cancelled) return
            if (!me?.isActive) {
              localStorage.removeItem(JWT_STORAGE_KEY)
              setUser(null)
            } else {
              setUser(me)
            }
          } catch {
            if (cancelled) return
            localStorage.removeItem(JWT_STORAGE_KEY)
            setUser(null)
          }
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    bootstrap().catch(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(JWT_STORAGE_KEY)
    setUser(null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const body = await apiLogin(username, password)
    localStorage.setItem(JWT_STORAGE_KEY, body.token)
    setUser(body.user)
  }, [])

  const refreshCurrentUser = useCallback(async () => {
    if (!user?.id) return
    try {
      const me = await apiFetch<SafeUser>('/auth/me')
      if (!me || !me.isActive) {
        logout()
        return
      }
      setUser(me)
    } catch {
      logout()
    }
  }, [logout, user?.id])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      logout,
      refreshCurrentUser,
    }),
    [ready, user, login, logout, refreshCurrentUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
