import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { profileHome, useAuth } from '../../features/auth/auth'
import { errorMessage } from '../api/client'

export function Paw() {
  return <svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="14" cy="46" rx="10" ry="13.5" transform="rotate(-25 14 46)"/><ellipse cx="37" cy="22" rx="10.5" ry="14" transform="rotate(-8 37 22)"/><ellipse cx="63" cy="22" rx="10.5" ry="14" transform="rotate(8 63 22)"/><ellipse cx="86" cy="46" rx="10" ry="13.5" transform="rotate(25 86 46)"/><ellipse cx="50" cy="70" rx="28" ry="22"/></svg>
}

export function Brand() {
  return <span className="brand"><span className="brand-mark"><Paw /></span><span className="brand-name">Patas <strong>Unidas</strong></span></span>
}

export function Header({ children }: { children?: ReactNode }) {
  const { status, user, logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signedIn = status === 'authenticated'

  async function signOut() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(errorMessage(cause, 'logout'))
    } finally {
      setBusy(false)
    }
  }

  return <header className="site-header">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <div className="site-header-inner">
      <Link className="brand-link" to="/" aria-label="Patas Unidas, ir para início"><Brand /></Link>
      <nav className="site-nav" aria-label="Navegação principal">
        <NavLink to="/" end>Início</NavLink>
        <NavLink to="/animais">Animais</NavLink>
        {signedIn && user && <NavLink to={profileHome(user.perfil)}>Minha área</NavLink>}
      </nav>
      <div className="header-action">
        {signedIn ? <button className="header-link" type="button" onClick={signOut} disabled={busy}>{busy ? 'Saindo…' : 'Sair'}</button> : <Link className="header-link" to="/login">Entrar</Link>}
      </div>
    </div>
    {error && <div className="header-feedback"><Notice variant="error">{error}</Notice></div>}
    {children && <div className="page-heading">{children}</div>}
  </header>
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  secondary?: boolean
  variant?: 'primary' | 'secondary' | 'text' | 'destructive'
}

export function Button({ children, secondary = false, variant, className = '', ...props }: ButtonProps) {
  const choice = variant ?? (secondary ? 'secondary' : 'primary')
  return <button className={`button button-${choice} ${className}`.trim()} {...props}>{children}</button>
}

export function Field({ label, password, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; password?: boolean }) {
  const [visible, setVisible] = useState(false)
  const id = props.id ?? props.name
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className="input-wrap">
      <input {...props} id={id} type={password ? (visible ? 'text' : 'password') : props.type} />
      {password && <button type="button" className="eye" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12 Q12 1 22 12 Q12 23 2 12Z"/><circle cx="12" cy="12" r="2.5"/>{!visible && <path d="M3 21 21 3"/>}</svg>
      </button>}
    </div>
  </div>
}

export function BottomNav() {
  const { status, user } = useAuth()
  return <nav className="bottom-nav" aria-label="Navegação móvel"><div>
    <NavLink to="/" end>Início</NavLink>
    <NavLink to="/animais">Animais</NavLink>
    {status === 'authenticated' && user && <NavLink to={profileHome(user.perfil)}>Minha área</NavLink>}
    {status !== 'authenticated' && <NavLink to="/login">Entrar</NavLink>}
  </div></nav>
}

export function Notice({ children, variant = 'info' }: { children: ReactNode; variant?: 'info' | 'error' | 'success' }) {
  return <p className={`notice notice-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>{children}</p>
}

export function Photo({ name, species, src, className = '', eager = false }: { name: string; species: string; src?: string | null; className?: string; eager?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = Boolean(src && failedSrc === src)
  return <div className={`photo ${className}`}>
    {src && !failed ? <img src={src} alt={`${name}, ${species.toLowerCase()}`} loading={eager ? 'eager' : 'lazy'} onLoad={event => { if (event.currentTarget.naturalWidth < 32 || event.currentTarget.naturalHeight < 32) setFailedSrc(src) }} onError={() => setFailedSrc(src)} /> : <span className="photo-placeholder" role="img" aria-label={`Fotografia de ${name} indisponível`}><Paw /><span>Fotografia indisponível</span></span>}
  </div>
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="text-link" to={to}>{children}</Link>
}
