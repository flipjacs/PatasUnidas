import { createContext, useContext } from 'react'
import { ApiError, apiUrl, initializeCsrf, request } from '../../shared/api/client'

export type Usuario = { id: number; nome: string; email: string; perfil: 'USUARIO' | 'ADMINISTRADOR' | 'VOLUNTARIO' | 'VETERINARIO' | 'CRIADOR_PLATAFORMA'; ongId: number | null }
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
export type AuthContextValue = { status: AuthStatus; user: Usuario | null; sessionError: string; refresh: () => void; login: (email:string, senha:string) => Promise<void>; logout: () => Promise<void> }
export const AuthContext = createContext<AuthContextValue | null>(null)

export function requireUsuario(value: unknown): Usuario {
  if (!value || typeof value !== 'object') throw new ApiError(0, 'Resposta inválida do servidor. Tente novamente.')
  const user = value as Record<string, unknown>
  if (typeof user.id !== 'number' || typeof user.nome !== 'string' || typeof user.email !== 'string' ||
      !['USUARIO', 'ADMINISTRADOR', 'VOLUNTARIO', 'VETERINARIO', 'CRIADOR_PLATAFORMA'].includes(String(user.perfil)) ||
      !(user.ongId === null || typeof user.ongId === 'number')) {
    throw new ApiError(0, 'Resposta inválida do servidor. Tente novamente.')
  }
  return value as Usuario
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider ausente')
  return context
}

export async function registerUser(nome:string,email:string,senha:string): Promise<void> {
  await initializeCsrf()
  await request(apiUrl('/usuarios/cadastro'), {method:'POST',body:{nome,email,senha},expectedStatus:201})
}
