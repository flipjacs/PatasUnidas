import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const hadSession = useRef(false)
  useEffect(() => {
    let active = true
    getSession().then(current => { if (active) { hadSession.current = true; setUser(current); setSessionError(''); setStatus('authenticated') } }).catch(error => {
      if (!active) return
      if (error instanceof ApiError && error.status === 401) { setUser(null); setStatus(hadSession.current ? 'expired' : 'unauthenticated') }
      else { setSessionError(errorMessage(error, 'sessao')); setStatus('error') }
    })
    return () => { active = false }
  }, [attempt])
  useEffect(() => {
    const expire = () => { hadSession.current = true; setUser(null); setSessionError('Sua sessão expirou. Entre novamente.'); setStatus('expired') }
    window.addEventListener('patas:session-expired', expire)
    return () => window.removeEventListener('patas:session-expired', expire)
  }, [])
  const refresh = useCallback(() => { setStatus('loading'); setSessionError(''); setAttempt(value => value + 1) }, [])
  const login = useCallback(async (email:string, senha:string) => {
    await initializeCsrf()
    const current = requireUsuario(await request<unknown>(apiUrl('/auth/login'), {method:'POST',body:{email,senha},expectedStatus:200}))
    hadSession.current = true; setUser(current); setSessionError(''); setStatus('authenticated')
    return current
  }, [])
  const logout = useCallback(async () => {
    try {
      await initializeCsrf()
      await request(apiUrl('/auth/logout'), {method:'POST',body:{}})
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    hadSession.current = false; setUser(null); setSessionError(''); setStatus('unauthenticated')
  }, [])
  return <AuthContext.Provider value={{status,user,sessionError,refresh,login,logout}}>{children}</AuthContext.Provider>
}

