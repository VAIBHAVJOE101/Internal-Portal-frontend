import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, type ReactNode } from 'react'
import { get } from './api'
import type { Me, PublicInfo } from './types'

interface AuthState {
  me: Me
  info: PublicInfo
  isAdmin: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export function usePublicInfo() {
  return useQuery({ queryKey: ['public-info'], queryFn: () => get<PublicInfo>('/public/info'), staleTime: Infinity })
}

export function AuthProvider({ me, info, children }: { me: Me; info: PublicInfo; children: ReactNode }) {
  return <AuthContext.Provider value={{ me, info, isAdmin: me.admin }}>{children}</AuthContext.Provider>
}

/** Renders children only for ADMIN users, otherwise the optional fallback. */
export function AdminOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { isAdmin } = useAuth()
  return <>{isAdmin ? children : fallback}</>
}
