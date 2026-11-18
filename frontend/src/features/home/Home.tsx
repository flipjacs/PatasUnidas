import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import heroArt from '../../assets/amazon-scarlet-macaw.jpg'
import { AnimalCard } from '../animals/AnimalPages'
import { listPublicAnimals, type PublicAnimalsPage } from '../animals/catalog'
import { profileHome, useAuth } from '../auth/auth'
import { Brand, Button } from '../../shared/components/Ui'
import '../../styles/landing.css'

let pendingPreview: Promise<PublicAnimalsPage> | null = null
const currentYear = new Date().getFullYear()
function previewAnimals() {
  if (!pendingPreview) pendingPreview = listPublicAnimals().finally(() => { pendingPreview = null })
  return pendingPreview
}

function LandingNav() {
  const { status, user } = useAuth()
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const firstLink = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (!open) return
    firstLink.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])
  const close = () => setOpen(false)
  return <header className="landing-header">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <nav className="landing-nav" aria-label="Navegação principal">
      <Link className="landing-brand" to="/" onClick={close} aria-label="Patas Unidas, início"><Brand /></Link>
      <button ref={menuButton} type="button" className="landing-menu-toggle" aria-controls="landing-links" aria-expanded={open} aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen(value => !value)}><span /><span /><span /></button>
      <div className={`landing-links ${open ? 'is-open' : ''}`} id="landing-links">
        <a ref={firstLink} href="#inicio" onClick={close}>Início</a>
        <Link to="/animais" onClick={close}>Animais</Link>
        <a href="#como-funciona" onClick={close}>Como funciona</a>
        <a href="#ongs" onClick={close}>ONGs</a>
        <a href="#transparencia" onClick={close}>Transparência</a>
      </div>
      <Link className="landing-account" to={status === 'authenticated' && user ? profileHome(user.perfil) : '/login'}>{status === 'authenticated' ? 'Minha área' : 'Entrar'}</Link>
    </nav>
  </header>
}

function AnimalPreview() {
  const [page, setPage] = useState<PublicAnimalsPage | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    previewAnimals().then(result => {
      if (active) { setPage(result); setError(false); setLoading(false) }
    }).catch(() => {
      if (active) { setError(true); setLoading(false) }
    })
    return () => { active = false }
  }, [attempt])

  return <section className="landing-section landing-animals" aria-labelledby="animais-titulo" data-reveal>
    <div className="landing-section-head">
      <div><p className="section-label">Encontre um novo amigo</p><h2 id="animais-titulo">Histórias que podem encontrar um lar.</h2></div>
      <Link className="landing-inline-link" to="/animais">Ver todos os animais</Link>
    </div>
    {loading && <div className="landing-animals-state" role="status">Carregando animais disponíveis…</div>}
    {!loading && error && <div className="landing-animals-state" role="alert"><p>Não foi possível carregar os animais agora.</p><Button secondary onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</Button></div>}
    {!loading && !error && page?.data.length === 0 && <div className="landing-animals-state"><p>As ONGs ainda não publicaram animais disponíveis para adoção.</p></div>}
    {!loading && !error && !!page?.data.length && <div className={`landing-animal-grid landing-animal-grid--${Math.min(page.data.length, 3)}`}>{page.data.slice(0, 3).map(animal => <AnimalCard key={animal.id} animal={animal} compact />)}</div>}
  </section>
}

export function Home() {
  const { status, user } = useAuth()
  const landingRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = landingRef.current
    if (!root) return

    const anchor = document.getElementById(window.location.hash.slice(1))
    if (anchor && root.contains(anchor)) {
      const previousBehavior = document.documentElement.style.scrollBehavior
      document.documentElement.style.scrollBehavior = 'auto'
      anchor.scrollIntoView()
      document.documentElement.style.scrollBehavior = previousBehavior
    }

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        (entry.target as HTMLElement).dataset.revealState = 'shown'
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    for (const element of root.querySelectorAll<HTMLElement>('[data-reveal]')) {
      if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
        element.dataset.revealState = 'shown'
      } else {
        element.dataset.revealState = 'pending'
        observer.observe(element)
      }
    }

    return () => observer.disconnect()
  }, [])

  return <div className="landing" ref={landingRef}>
    <LandingNav />
    <main id="conteudo">
      <section className="landing-hero" id="inicio" aria-labelledby="hero-title">
        <div className="landing-hero-copy">
          <p className="landing-hero-label">Proteção animal em rede</p>
          <h1 id="hero-title">Cada vida merece um novo começo.</h1>
          <p className="landing-hero-description">O Patas Unidas aproxima pessoas e ONGs de proteção animal para transformar histórias por meio da adoção e do cuidado.</p>
          <div className="landing-hero-actions">
            <Link className="button landing-hero-primary" to="/animais">Conhecer animais</Link>
            <a className="landing-hero-secondary" href="#como-funciona">Como funciona</a>
          </div>
        </div>
        <div className="landing-hero-media">
          <img src={heroArt} alt="Fotografia de uma arara-vermelha na região amazônica de Madre de Dios, no Peru" width="3679" height="2453" fetchPriority="high" />
          <a className="landing-image-credit" href="https://commons.wikimedia.org/wiki/File:Flickr_-_ggallice_-_Scarlet_macaw.jpg" target="_blank" rel="noreferrer">Foto: Geoff Gallice · CC BY 2.0</a>
        </div>
      </section>

      <div className="landing-bridge" data-reveal><p>Uma plataforma para aproximar cuidado e oportunidade.</p><span>Animais, pessoas e organizações no mesmo caminho.</span></div>
      <AnimalPreview />

      <section className="landing-section landing-steps" id="como-funciona" aria-labelledby="steps-title" data-reveal>
        <div className="landing-section-head"><div><p className="section-label">Como funciona</p><h2 id="steps-title">Um caminho simples, feito com responsabilidade.</h2></div></div>
        <ol className="landing-step-list">
          <li><span>01</span><h3>Encontre</h3><p>Explore o catálogo e conheça a história de cada animal disponível.</p></li>
          <li><span>02</span><h3>Solicite</h3><p>Crie sua conta para participar do processo de adoção junto à ONG responsável.</p></li>
          <li><span>03</span><h3>Transforme</h3><p>A adoção e o apadrinhamento ajudam a sustentar o cuidado ao longo do tempo.</p></li>
        </ol>
      </section>

      <section className="landing-section landing-care" id="ongs" aria-labelledby="care-title" data-reveal>
        <div className="landing-care-intro"><p className="section-label">Mais formas de cuidar</p><h2 id="care-title">O cuidado encontra muitos caminhos.</h2><p>As ONGs fazem cada recomeço acontecer. Você pode conhecer os animais e acompanhar o trabalho de quem os acolhe.</p></div>
        <ol className="landing-care-list">
          <li><span>01 / Adoção</span><p>Conheça os animais disponíveis e solicite uma adoção responsável à ONG que cuida de cada um.</p></li>
          <li><span>02 / Apadrinhamento</span><p>Apoie o cuidado de um animal por meio de contribuições acompanhadas pela ONG responsável.</p></li>
          <li><span>03 / Apoio às ONGs</span><p>Conheça a atuação das organizações e a proposta de transparência do Patas Unidas.</p></li>
        </ol>
      </section>

      <section className="landing-amazonia" aria-labelledby="amazonia-title" data-reveal>
        <div className="landing-amazonia-media"><img src={heroArt} alt="" width="3679" height="2453" loading="lazy" /><a href="https://commons.wikimedia.org/wiki/File:Flickr_-_ggallice_-_Scarlet_macaw.jpg" target="_blank" rel="noreferrer">Foto: Geoff Gallice · CC BY 2.0</a></div>
        <div className="landing-amazonia-copy"><p className="section-label">Amazônia contemporânea</p><h2 id="amazonia-title">Da Amazônia, uma rede de cuidado.</h2><p>Nossa identidade se inspira na riqueza natural da Amazônia. O propósito é aproximar pessoas e organizações que protegem vidas.</p></div>
      </section>

      <section className="landing-section landing-transparency" id="transparencia" aria-labelledby="transparency-title" data-reveal>
        <div><p className="section-label">Transparência</p><h2 id="transparency-title">Cuidado também pede clareza.</h2></div>
        <div><p>As ONGs podem publicar demonstrativos financeiros consolidados por período. As informações públicas ajudam a compreender o trabalho realizado sem expor dados pessoais de quem contribui.</p><Link className="landing-transparency-link" to="/transparencia">Consultar demonstrativos ↗</Link></div>
      </section>

      <section className="landing-final" aria-labelledby="final-title" data-reveal><div className="landing-final-inner"><div><p className="section-label">O próximo encontro</p><h2 id="final-title">Uma nova história pode começar com você.</h2></div><Link className="button landing-final-button" to="/animais">Conhecer animais</Link></div></section>
    </main>
    <footer className="landing-footer" data-reveal>
      <div className="landing-footer-inner">
        <div className="landing-footer-main">
          <div className="landing-footer-brand"><Brand /><p>Toda história merece continuar.</p><small>Uma rede de cuidado para animais e pessoas.</small></div>
          <nav className="landing-footer-column" aria-label="Explorar"><h2>Explorar</h2><a href="#inicio">Início</a><Link to="/animais">Animais</Link><a href="#como-funciona">Como funciona</a><a href="#ongs">ONGs</a><Link to="/transparencia">Transparência</Link></nav>
          <nav className="landing-footer-column" aria-label="Plataforma"><h2>Plataforma</h2>{status === 'authenticated' && user ? <Link to={profileHome(user.perfil)}>Minha área</Link> : <><Link to="/login">Entrar</Link><Link to="/cadastro">Criar conta</Link></>}</nav>
        </div>
        <div className="landing-footer-bottom"><small>© {currentYear} Patas Unidas · Projeto acadêmico</small><span>Adoção responsável e cuidado em rede.</span></div>
      </div>
    </footer>
  </div>
}
