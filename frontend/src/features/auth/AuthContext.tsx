import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AuthContext, requireUsuario, type AuthStatus, type Usuario } from './auth'
import { ApiError, apiUrl, errorMessage, initializeCsrf, request } from '../../shared/api/client'

let pendingSession: Promise<Usuario> | null = null
function getSession(): Promise<Usuario> {
  if (!pendingSession) pendingSession = request<unknown>(apiUrl('/auth/me')).then(requireUsuario).finally(() => { pendingSession = null })
  return pendingSession
}

export function AuthProvider({children}:{children:ReactNode}) {
  const [status,setStatus] = useState<AuthStatus>('loading')
  const [user,setUser] = useState<Usuario | null>(null)
  const [sessionError,setSessionError] = useState('')
  const [attempt,setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getSession().then(current => { if (active) { setUser(current); setStatus('authenticated') } }).catch(error => {
      if (!active) return
      if (error instanceof ApiError && error.status === 401) { setUser(null); setStatus('unauthenticated') }
      else { setSessionError(errorMessage(error, 'sessao')); setStatus('error') }
    })
    return () => { active = false }
  }, [attempt])
  const refresh = useCallback(() => { setStatus('loading'); setSessionError(''); setAttempt(value => value + 1) }, [])
  const login = useCallback(async (email:string, senha:string) => {
    await initializeCsrf()
    const current = requireUsuario(await request<unknown>(apiUrl('/auth/login'), {method:'POST',body:{email,senha},expectedStatus:200}))
    setUser(current); setStatus('authenticated')
  }, [])
  const logout = useCallback(async () => {
    try {
      await initializeCsrf()
      await request(apiUrl('/auth/logout'), {method:'POST',body:{}})
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    setUser(null); setStatus('unauthenticated')
  }, [])
  return <AuthContext.Provider value={{status,user,sessionError,refresh,login,logout}}>{children}</AuthContext.Provider>
}

