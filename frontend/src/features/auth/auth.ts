import { createContext, useContext } from 'react'
import { ApiError, apiUrl, initializeCsrf, request } from '../../shared/api/client'

export type Perfil = 'USUARIO' | 'ADMINISTRADOR' | 'VOLUNTARIO' | 'VETERINARIO' | 'CRIADOR_PLATAFORMA'
export type Usuario = { id: number; nome: string; email: string; perfil: Perfil; ongId: number | null; ong?: { id: number; nome: string; status: 'ATIVA' | 'SUSPENSA' } | null }
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'expired' | 'error'
export type AuthContextValue = { status: AuthStatus; user: Usuario | null; sessionError: string; refresh: () => void; login: (email:string, senha:string) => Promise<Usuario>; logout: () => Promise<void> }
export const AuthContext = createContext<AuthContextValue | null>(null)

export function profileHome(perfil: Perfil): string {
  if (perfil === 'USUARIO') return '/minha-area'
  if (perfil === 'CRIADOR_PLATAFORMA') return '/plataforma'
  return '/ong'
}

export function allowedPrivateDestination(perfil: Perfil, path: string): boolean {
  if (path === profileHome(perfil)) return true
  if (perfil === 'ADMINISTRADOR') return /^\/ong\/(?:animais|funcionarios)(?:\/(?:novo|\d+(?:\/editar)?))?(?:\?[^#]*)?$/.test(path)
  if (perfil === 'VOLUNTARIO') return /^\/ong\/animais(?:\/(?:novo|\d+))?(?:\?[^#]*)?$/.test(path)
  if (perfil === 'VETERINARIO') return /^\/ong\/animais(?:\/\d+)?(?:\?[^#]*)?$/.test(path)
  if (perfil !== 'USUARIO') return false
  return /^\/minha-area(?:\/(?:solicitacoes|doacoes|apadrinhamentos(?:\/\d+)?|adotados(?:\/\d+\/prontuarios(?:\/\d+)?)?))?(?:\?[^#]*)?$/.test(path)
    || /^\/animais\/\d+\/(?:solicitar|doar|apadrinhar)$/.test(path)
}

export function requireUsuario(value: unknown): Usuario {
  if (!value || typeof value !== 'object') throw new ApiError(0, 'Resposta inválida do servidor. Tente novamente.')
  const user = value as Record<string, unknown>
  if (typeof user.id !== 'number' || typeof user.nome !== 'string' || typeof user.email !== 'string' ||
      !['USUARIO', 'ADMINISTRADOR', 'VOLUNTARIO', 'VETERINARIO', 'CRIADOR_PLATAFORMA'].includes(String(user.perfil)) ||
      !(user.ongId === null || typeof user.ongId === 'number')) {
    throw new ApiError(0, 'Resposta inválida do servidor. Tente novamente.')
  }
  if (user.ong !== undefined && user.ong !== null && (typeof user.ong !== 'object' ||
      typeof (user.ong as Record<string, unknown>).id !== 'number' ||
      typeof (user.ong as Record<string, unknown>).nome !== 'string' ||
      !['ATIVA', 'SUSPENSA'].includes(String((user.ong as Record<string, unknown>).status)))) {
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
