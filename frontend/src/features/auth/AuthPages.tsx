import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Brand, Button, Field, TextLink } from '../../shared/components/Ui'
import { ApiError, apiUrl, errorMessage, initializeCsrf, request } from '../../shared/api/client'
import { allowedPrivateDestination, profileHome, registerUser, useAuth } from './auth'

function AuthStory() {
  return (
    <div className="auth-story">
      <Brand />
      <div className="auth-story-copy">
        <h2>Cuidado que cria novos caminhos.</h2>
        <p>Uma rede para acompanhar adoções e apoiar quem cuida dos animais.</p>
      </div>
    </div>
  )
}

export function Login() {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { login, status } = useAuth()
  const routeState = location.state as { registered?: boolean; firstAccess?: boolean; from?: string; sessionExpired?: boolean } | null
  const successMessage = routeState?.registered
    ? 'Conta criada com sucesso. Entre com seu e-mail e senha.'
    : routeState?.firstAccess ? 'Senha definida. Entre com seu e-mail e senha.'
    : routeState?.sessionExpired ? 'Sua sessão expirou. Entre novamente.' : ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || status === 'loading') return

    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') || '').trim()
    const senha = String(data.get('senha') || '')
    if (!email || !senha) {
      setMessage('Informe seu e-mail e sua senha.')
      return
    }

    setMessage('')
    setSubmitting(true)
    try {
      const current = await login(email, senha)
      const destination = routeState?.from && allowedPrivateDestination(current.perfil, routeState.from)
        ? routeState.from : profileHome(current.perfil)
      navigate(destination, { replace: true, state: null })
    } catch (error) {
      setMessage(errorMessage(error, 'login'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <AuthStory />
        <section className="auth-form-panel" aria-labelledby="login-heading">
          <div className="auth-form-header">
            <h1 id="login-heading">Entre na sua conta</h1>
            <p>Use o e-mail e a senha cadastrados no Patas Unidas.</p>
          </div>
          <form className="auth-form" onSubmit={submit} noValidate>
            <Field id="login-email" name="email" label="E-mail" type="email" placeholder="voce@email.com" autoComplete="email" required />
            <Field id="login-senha" name="senha" label="Senha" password autoComplete="current-password" required />
            {message && <p className="notice auth-feedback" role="alert">{message}</p>}
            {!message && successMessage && <p className="notice auth-feedback-success" role="status">{successMessage}</p>}
            <Button type="submit" disabled={submitting || status === 'loading'} aria-busy={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="auth-switch">Ainda não tem uma conta? <TextLink to="/cadastro">Cadastre-se</TextLink></p>
          <p className="auth-switch auth-switch-secondary">Recebeu um convite para administrar uma ONG? <TextLink to="/primeiro-acesso">Definir senha</TextLink></p>
        </section>
      </div>
    </main>
  )
}

export function Cadastro() {
  const [message, setMessage] = useState('')
  const [errorField, setErrorField] = useState<'nome' | 'email' | 'senha' | 'confirmacao' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  function validationError(field: 'nome' | 'email' | 'senha' | 'confirmacao', text: string) {
    setErrorField(field)
    setMessage(text)
  }

  function fieldError(field: 'nome' | 'email' | 'senha' | 'confirmacao') {
    return errorField === field ? <p className="field-error" id={`cadastro-${field}-erro`} role="alert">{message}</p> : null
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const data = new FormData(event.currentTarget)
    const nome = String(data.get('nome') || '').trim()
    const email = String(data.get('email') || '').trim()
    const senha = String(data.get('senha') || '')
    const confirmacao = String(data.get('confirmacao') || '')
    if (!nome || !email || !senha || !confirmacao) {
      setErrorField(null)
      setMessage('Preencha todos os campos para criar sua conta.')
      return
    }
    if (nome.length > 100) {
      validationError('nome', 'O nome deve ter até 100 caracteres.')
      return
    }
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationError('email', 'Informe um e-mail válido com até 120 caracteres.')
      return
    }
    const passwordLength = Array.from(senha).length
    if (passwordLength < 8 || passwordLength > 72 || new TextEncoder().encode(senha).length > 72 || !senha.trim()) {
      validationError('senha', 'A senha deve ter de 8 a 72 caracteres e no máximo 72 bytes.')
      return
    }
    if (senha !== confirmacao) {
      validationError('confirmacao', 'As senhas não coincidem.')
      return
    }

    setMessage('')
    setErrorField(null)
    setSubmitting(true)
    try {
      await registerUser(nome, email, senha)
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (error) {
      const backendField = error instanceof ApiError
        ? (['nome', 'email', 'senha'] as const).find(field => error.errors?.[field])
        : undefined
      setErrorField(backendField ?? (error instanceof ApiError && error.status === 409 ? 'email' : null))
      setMessage(errorMessage(error, 'cadastro'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <AuthStory />
        <section className="auth-form-panel" aria-labelledby="cadastro-heading">
          <div className="auth-form-header">
            <h1 id="cadastro-heading">Crie sua conta</h1>
            <p>Uma conta para acompanhar animais, adoções e apadrinhamentos.</p>
          </div>
          <form className="auth-form" onSubmit={submit} noValidate>
            <div>
              <Field id="cadastro-nome" label="Nome completo" name="nome" placeholder="Seu nome completo" autoComplete="name" maxLength={100} aria-invalid={errorField === 'nome'} aria-describedby={errorField === 'nome' ? 'cadastro-nome-erro' : undefined} required />
              {fieldError('nome')}
            </div>
            <div>
              <Field id="cadastro-email" label="E-mail" name="email" type="email" placeholder="voce@email.com" autoComplete="email" maxLength={120} aria-invalid={errorField === 'email'} aria-describedby={errorField === 'email' ? 'cadastro-email-erro' : undefined} required />
              {fieldError('email')}
            </div>
            <div>
              <Field id="cadastro-senha" label="Senha" name="senha" password autoComplete="new-password" aria-invalid={errorField === 'senha'} aria-describedby={errorField === 'senha' ? 'senha-ajuda cadastro-senha-erro' : 'senha-ajuda'} required />
              <p className="auth-form-note" id="senha-ajuda">Use pelo menos 8 caracteres.</p>
              {fieldError('senha')}
            </div>
            <div>
              <Field id="cadastro-confirmacao" label="Confirmar senha" name="confirmacao" password autoComplete="new-password" aria-invalid={errorField === 'confirmacao'} aria-describedby={errorField === 'confirmacao' ? 'cadastro-confirmacao-erro' : undefined} required />
              {fieldError('confirmacao')}
            </div>
            {message && !errorField && <p className="notice auth-feedback" role="alert">{message}</p>}
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>
          <p className="auth-switch">Já possui uma conta? <TextLink to="/login">Entrar</TextLink></p>
        </section>
      </div>
    </main>
  )
}

export function PrimeiroAcesso() {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') || '').trim()
    const token = String(data.get('token') || '').trim()
    const senha = String(data.get('senha') || '')
    const confirmacao = String(data.get('confirmacao') || '')
    if (!email || !token || !senha || !confirmacao) { setMessage('Preencha todos os campos.'); return }
    if (senha !== confirmacao) { setMessage('As senhas não coincidem.'); return }
    if (Array.from(senha).length < 8 || Array.from(senha).length > 72 || new TextEncoder().encode(senha).length > 72 || !senha.trim()) {
      setMessage('A senha deve ter de 8 a 72 caracteres e no máximo 72 bytes.'); return
    }
    setMessage('')
    setSubmitting(true)
    try {
      await initializeCsrf()
      await request(apiUrl('/auth/primeiro-acesso'), { method: 'POST', body: { email, token, senha }, expectedStatus: 200 })
      navigate('/login', { replace: true, state: { firstAccess: true } })
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 400 ? 'Convite inválido ou expirado.' : errorMessage(error, 'cadastro'))
    } finally { setSubmitting(false) }
  }

  return <main className="auth-shell"><div className="auth-panel"><AuthStory />
    <section className="auth-form-panel" aria-labelledby="primeiro-acesso-heading">
      <div className="auth-form-header"><h1 id="primeiro-acesso-heading">Defina sua senha</h1><p>Use o e-mail e o convite recebidos para ativar sua conta de administrador.</p></div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field id="primeiro-email" name="email" label="E-mail" type="email" autoComplete="email" required />
        <Field id="primeiro-token" name="token" label="Código do convite" autoComplete="off" required />
        <Field id="primeiro-senha" name="senha" label="Nova senha" password autoComplete="new-password" required />
        <Field id="primeiro-confirmacao" name="confirmacao" label="Confirmar nova senha" password autoComplete="new-password" required />
        {message && <p className="notice auth-feedback" role="alert">{message}</p>}
        <Button type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Salvando…' : 'Definir senha'}</Button>
      </form>
      <p className="auth-switch"><TextLink to="/login">Voltar para entrar</TextLink></p>
    </section>
  </div></main>
}
