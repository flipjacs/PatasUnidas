import { useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Login, Cadastro } from '../features/auth/AuthPages'
import { AuthProvider } from '../features/auth/AuthContext'
import { useAuth } from '../features/auth/auth'
import { Home } from '../features/home/Home'
import { Animals, Details } from '../features/animals/AnimalPages'
import { Button, Notice } from '../shared/components/Ui'

function Protected({children}:{children:ReactNode}) {
 const {status, sessionError, refresh} = useAuth(); const location = useLocation()
 if (status === 'loading') return <main className="auth-state" role="status">Verificando sessão...</main>
 if (status === 'error') return <main className="auth-state"><Notice>{sessionError}</Notice><Button onClick={refresh}>Tentar novamente</Button></main>
 if (status === 'unauthenticated') return <Navigate to="/login" replace state={{from: location.pathname + location.search}} />
 return children
}
function AppRoutes() {
 const [message,setMessage]=useState('')
 const soon=()=>{setMessage('Funcionalidade ainda não disponível nesta demonstração.');window.setTimeout(()=>setMessage(''),4000)}
 return <><Routes><Route path="/login" element={<Login/>}/><Route path="/cadastro" element={<Cadastro/>}/><Route path="/" element={<Protected><Home onSoon={soon}/></Protected>}/><Route path="/animais" element={<Protected><Animals onSoon={soon}/></Protected>}/><Route path="/animais/:id" element={<Protected><Details onSoon={soon}/></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>{message && <div className="toast"><Notice>{message}</Notice></div>}</>
}
export function App() { return <AuthProvider><AppRoutes/></AuthProvider> }
