import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { profileHome, useAuth, type Usuario } from '../auth/auth'
import { errorMessage } from '../../shared/api/client'
import { Brand, Notice } from '../../shared/components/Ui'
import '../../styles/workspace.css'

type Area = 'personal' | 'institutional' | 'platform'

const profileNames: Record<Usuario['perfil'], string> = {
  USUARIO: 'Usuário',
  ADMINISTRADOR: 'Administrador',
  VOLUNTARIO: 'Voluntário',
  VETERINARIO: 'Veterinário',
  CRIADOR_PLATAFORMA: 'Criador da plataforma',
}

function OverviewIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
}

function AnimalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 18c0-3 2-5 5-5l1-4 3 2 3-2 1 4c2 1 3 2.5 3 5-2 1.5-5 2-8 2s-6-.5-8-2Z"/><path d="M9 16h.01M15 16h.01"/></svg>
}

function TeamIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Z"/><path d="M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/></svg>
}

function RecordIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg> }

function ContextLabel({ area, user }: { area: Area; user: Usuario }) {
  if (area === 'platform') return <>Administração da plataforma</>
  if (area === 'personal') return <>Espaço pessoal</>
  return <>{user.ong?.nome ?? 'Organização indisponível'}{user.ong?.status === 'SUSPENSA' && <span className="workspace-ong-status">Suspensa</span>}</>
}

function WorkspaceLayout({ area, user, children }: { area: Area; user: Usuario; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const menuButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const home = profileHome(user.perfil)
  const clinicalRoute = location.pathname === '/ong/prontuarios' || /\/ong\/animais\/\d+\/prontuarios(?:\/|$)/.test(location.pathname)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    if (window.matchMedia('(max-width: 899px)').matches) document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => sidebar.current?.querySelector<HTMLAnchorElement>('a')?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
      if (event.key === 'Tab' && sidebar.current) {
        const links = Array.from(sidebar.current.querySelectorAll<HTMLElement>('a, button:not([disabled])'))
        const first = links[0]
        const last = links.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { cancelAnimationFrame(focusFrame); document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  async function signOut() {
    if (busy) return
    setBusy(true)
    setError('')
    try { await logout(); navigate('/login', { replace: true }) }
    catch (cause) { setError(errorMessage(cause, 'logout')) }
    finally { setBusy(false) }
  }

  return <div className={`workspace workspace--${area}`}>
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    {area !== 'personal' && <>
      {open && <button className="workspace-backdrop" type="button" aria-label="Fechar menu" onClick={() => { setOpen(false); menuButton.current?.focus() }} />}
      <aside ref={sidebar} id="workspace-navigation" className={`workspace-sidebar ${open ? 'is-open' : ''}`} aria-label="Navegação da área privada">
        <Link className="workspace-sidebar-brand" to="/" onClick={() => setOpen(false)} aria-label="Patas Unidas, site público"><Brand /></Link>
        <div className="workspace-sidebar-context"><span>{area === 'platform' ? 'Plataforma' : 'Organização'}</span><strong><ContextLabel area={area} user={user} /></strong></div>
        <nav className="workspace-sidebar-nav" aria-label="Páginas disponíveis">
          <span className="workspace-nav-caption">Espaço de trabalho</span>
          <NavLink to={home} end onClick={() => setOpen(false)}><OverviewIcon />Visão geral</NavLink>
          {area === 'institutional' && <Link className={location.pathname.startsWith('/ong/animais') && !clinicalRoute ? 'active' : undefined} aria-current={location.pathname.startsWith('/ong/animais') && !clinicalRoute ? 'page' : undefined} to="/ong/animais" onClick={() => setOpen(false)}><AnimalIcon />Animais da ONG</Link>}
          {area === 'institutional' && user.perfil !== 'VETERINARIO' && <NavLink to="/ong/adocoes" onClick={() => setOpen(false)}><TeamIcon />Adoções</NavLink>}
          {area === 'institutional' && <Link className={clinicalRoute ? 'active' : undefined} aria-current={clinicalRoute ? 'page' : undefined} to="/ong/prontuarios" onClick={() => setOpen(false)}><RecordIcon />Prontuários</Link>}
          {area === 'institutional' && user.perfil === 'ADMINISTRADOR' && <NavLink to="/ong/funcionarios" onClick={() => setOpen(false)}><TeamIcon />Funcionários</NavLink>}
          <span className="workspace-nav-caption workspace-nav-caption--secondary">Área pública</span>
          <NavLink to="/animais" onClick={() => setOpen(false)}><AnimalIcon />Catálogo de animais</NavLink>
        </nav>
        <div className="workspace-sidebar-bottom"><span>{profileNames[user.perfil]}</span><small>{area === 'platform' ? 'Acesso global' : area === 'institutional' ? user.ong?.nome ?? 'Organização indisponível' : 'Área pessoal'}</small></div>
      </aside>
    </>}
    <div className="workspace-main">
      <header className="workspace-topbar">
        {area === 'personal' ? <Link className="workspace-personal-brand" to="/" aria-label="Patas Unidas, site público"><Brand /></Link> : <><button ref={menuButton} className="workspace-menu-button" type="button" aria-controls="workspace-navigation" aria-expanded={open} aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen(value => !value)}><span /><span /><span /></button><Link className="workspace-mobile-brand" to="/" aria-label="Patas Unidas, site público"><Brand /></Link></>}
        <span className="workspace-topbar-context"><ContextLabel area={area} user={user} /></span>
        {area === 'personal' && <nav className="workspace-personal-nav" aria-label="Minha navegação">
          <NavLink to="/minha-area" end>Início</NavLink>
          <NavLink to="/minha-area/solicitacoes">Adoções</NavLink>
          <NavLink to="/minha-area/doacoes">Doações</NavLink>
          <NavLink to="/minha-area/apadrinhamentos">Apadrinhamentos</NavLink>
          <NavLink to="/minha-area/adotados">Adotados</NavLink>
        </nav>}
        <Link className="workspace-public-link" to="/">Site público</Link>
        <div className="workspace-account"><span className="workspace-avatar" aria-hidden="true">{user.nome.trim().charAt(0).toUpperCase()}</span><span className="workspace-account-name"><strong>{user.nome}</strong><small>{profileNames[user.perfil]}</small></span></div>
        <button className="workspace-logout" type="button" onClick={signOut} disabled={busy}>{busy ? 'Saindo…' : 'Sair'}</button>
      </header>
      {error && <div className="workspace-header-error"><Notice variant="error">{error}</Notice></div>}
      <main className="workspace-content" id="conteudo">{children}</main>
    </div>
  </div>
}

export function PersonalFrame({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return null
  return <WorkspaceLayout area="personal" user={user}>{children}</WorkspaceLayout>
}

export function InstitutionalFrame() {
  const { user } = useAuth()
  if (!user) return null
  return <WorkspaceLayout area="institutional" user={user}><Outlet /></WorkspaceLayout>
}

export function WorkspaceHome({ area }: { area: Area }) {
  const { user } = useAuth()
  if (!user) return null
  const isPersonal = area === 'personal'
  const isPlatform = area === 'platform'
  const title = isPersonal ? 'Um espaço para cuidar de perto.' : isPlatform ? 'Sua visão da plataforma.' : user.perfil === 'VETERINARIO' ? 'Seu espaço clínico.' : 'O cuidado da sua ONG começa aqui.'
  const description = isPersonal
    ? 'Sua conta conecta você aos animais disponíveis e às organizações que cuidam deles.'
    : isPlatform ? 'Este é o seu contexto global. A gestão das organizações será integrada a esta área.'
    : user.perfil === 'VETERINARIO' ? 'Sua conta está vinculada a uma ONG. Os registros clínicos serão acessados por este espaço nas próximas etapas.'
    : 'Sua conta está vinculada a uma ONG. As ferramentas de gestão serão reunidas neste espaço.'

  return <WorkspaceLayout area={area} user={user}>
    <div className="workspace-page-heading"><p className="section-label">{isPersonal ? 'Minha área' : isPlatform ? 'Plataforma' : 'Área institucional'}</p><p className="workspace-greeting">Olá, {user.nome}.</p></div>
    <section className="workspace-welcome" aria-labelledby="workspace-title">
      <div><span className="workspace-welcome-kicker">Patas Unidas</span><h1 id="workspace-title">{title}</h1><p>{description}</p>{isPersonal && <Link className="button workspace-welcome-cta" to="/animais">Explorar catálogo público</Link>}</div>
      <div className="workspace-welcome-mark" aria-hidden="true" />
    </section>
    <section className="workspace-details" aria-labelledby="account-title"><div><p className="section-label">Sua conta</p><h2 id="account-title">Dados de acesso</h2></div>
      <dl><div><dt>Nome</dt><dd>{user.nome}</dd></div><div><dt>E-mail</dt><dd>{user.email}</dd></div><div><dt>Perfil</dt><dd>{profileNames[user.perfil]}</dd></div><div><dt>Contexto</dt><dd>{isPlatform ? 'Plataforma' : isPersonal ? 'Conta pessoal' : `ONG #${user.ongId}`}</dd></div></dl>
    </section>
  </WorkspaceLayout>
}
