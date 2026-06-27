import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, clearToken, getToken, setToken } from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await api.me()
      setUser(me)
      setError(null)
    } catch {
      clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const { access_token } = await api.login(email, password)
      setToken(access_token)
      const me = await api.me()
      setUser(me)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error: string }).error)
          : 'Login failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refresh }),
    [user, loading, error, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
