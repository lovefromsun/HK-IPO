import { createContext } from 'react'
import type { SafeUser } from '../types'

export interface AuthContextValue {
  user: SafeUser | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshCurrentUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
