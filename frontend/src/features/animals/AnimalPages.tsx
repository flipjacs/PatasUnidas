import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { BottomNav, Button, Header, Photo } from '../../shared/components/Ui'
import { useAuth } from '../auth/auth'
import {
  approximateAge,
  getPublicAnimal,
  listPublicAnimals,
  speciesLabel,
  type AnimalPhoto,
  type PublicAnimal,
  type PublicAnimalsPage,
  type Species,
} from './catalog'

const filters: { value: string; label: string; species?: Species }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'caes', label: 'Cães', species: 'CACHORRO' },
  { value: 'gatos', label: 'Gatos', species: 'GATO' },
  { value: 'outros', label: 'Outros', species: 'OUTRO' },
]

const sexLabel: Record<PublicAnimal['sexo'], string> = {
  MACHO: 'Macho',
  FEMEA: 'Fêmea',
  NAO_INFORMADO: 'Não informado',
}

const sizeLabel: Record<PublicAnimal['porte'], string> = {
  PEQUENO: 'Pequeno',
  MEDIO: 'Médio',
  GRANDE: 'Grande',
  NAO_INFORMADO: 'Não informado',
}

function catalogError(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return 'Este animal não está disponível no catálogo.'
  if (error instanceof ApiError && error.status === 0) return error.message
  return 'Não foi possível carregar os animais agora. Tente novamente.'
}

export function AnimalCard({ animal, compact = false }: { animal: PublicAnimal; compact?: boolean }) {
  const location = useLocation()
  const from = location.pathname === '/animais' ? location.pathname + location.search : '/animais'

  return <Link className={`animal-card ${compact ? 'compact' : ''}`} to={`/animais/${animal.id}`} state={{ from }}>
    <Photo name={animal.nome} species={speciesLabel[animal.especie]} src={animal.fotoPrincipal?.url} className="animal-card__media" />
    <div className="animal-card__body">
      <div className="animal-card__title">
        {compact ? <h3>{animal.nome}</h3> : <h2>{animal.nome}</h2>}
        <span>{approximateAge(animal.idadeAproximada)}</span>
      </div>
      <p className="animal-card__meta">{speciesLabel[animal.especie]} · {sizeLabel[animal.porte]}</p>
      {!compact && <p className="animal-card__ong">{animal.ong.nome} · {animal.ong.cidade}, {animal.ong.estado}</p>}
      <span className="animal-card__link">Conhecer {animal.nome}</span>
    </div>
  </Link>
}

function CatalogPagination({ page, lastPage, setPage }: { page: number; lastPage: number; setPage: (page: number) => void }) {
  if (lastPage <= 1) return null
  return <nav className="pagination" aria-label="Páginas do catálogo">
    <Button type="button" secondary disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
    <span aria-live="polite">Página {page} de {lastPage}</span>
    <Button type="button" secondary disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Próxima</Button>
  </nav>
}

export function Animals() {
  const [params, setParams] = useSearchParams()
  const filter = filters.find(item => item.value === params.get('filtro')) ?? filters[0]
  const requestedPage = Number(params.get('page') ?? '1')
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [result, setResult] = useState<PublicAnimalsPage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    listPublicAnimals({ especie: filter.species, page }).then(data => {
      if (!active) return
      setResult(data)
      setError('')
      setLoading(false)
    }).catch(cause => {
      if (!active) return
      setError(catalogError(cause))
      setResult(null)
      setLoading(false)
    })
    return () => { active = false }
  }, [filter.species, page, attempt])

  function selectFilter(value: string) {
    if (value === filter.value && page === 1) return
    setLoading(true)
    setParams(value === 'todos' ? {} : { filtro: value })
  }

  function selectPage(nextPage: number) {
    setLoading(true)
    setParams(filter.value === 'todos' ? { page: String(nextPage) } : { filtro: filter.value, page: String(nextPage) })
    window.scrollTo(0, 0)
  }

  return <div className="app-shell">
    <Header />
    <main className="page-content animals-page" id="conteudo">
      <div className="catalog-intro">
        <h1>Encontre uma companhia para a vida.</h1>
        <p>Conheça os animais disponíveis nas ONGs parceiras.</p>
      </div>
      <div className="catalog-toolbar">
        <div className="filters" role="group" aria-label="Filtrar por espécie">
          {filters.map(item => <button key={item.value} type="button" className={filter.value === item.value ? 'active' : ''} aria-pressed={filter.value === item.value} onClick={() => selectFilter(item.value)}>{item.label}</button>)}
        </div>
        {!loading && !error && <p className="results" role="status">{result?.meta.total ?? 0} {result?.meta.total === 1 ? 'animal encontrado' : 'animais encontrados'}</p>}
      </div>
      {loading && <p className="page-state" role="status">Carregando animais...</p>}
      {!loading && error && <div className="page-state" role="alert"><p>{error}</p><Button type="button" secondary onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</Button></div>}
      {!loading && !error && result?.data.length === 0 && <section className="empty-state"><h2>Nenhum animal encontrado</h2><p>{filter.value === 'todos' ? 'As ONGs ainda não publicaram animais disponíveis para adoção.' : 'Tente escolher outra espécie para ver os animais disponíveis.'}</p></section>}
      {!loading && !error && !!result?.data.length && <>
        <div className="animal-list">{result.data.map(animal => <AnimalCard key={animal.id} animal={animal} />)}</div>
        <CatalogPagination page={result.meta.current_page} lastPage={result.meta.last_page} setPage={selectPage} />
      </>}
    </main>
    <BottomNav />
  </div>
}

export function Details() {
  const { user, status } = useAuth()
  const { id } = useParams()
  const location = useLocation()
  const back = typeof location.state?.from === 'string' && location.state.from.startsWith('/animais') ? location.state.from : '/animais'
  const animalId = Number(id)
  const validId = Number.isSafeInteger(animalId) && animalId > 0
  const [animal, setAnimal] = useState<PublicAnimal | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<AnimalPhoto | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!validId) return
    let active = true
    getPublicAnimal(animalId).then(data => {
      if (!active) return
      setAnimal(data)
      setSelectedPhoto(data.fotoPrincipal ?? data.fotos?.[0] ?? null)
      setError('')
      setLoading(false)
    }).catch(cause => {
      if (!active) return
      setError(catalogError(cause))
      setAnimal(null)
      setLoading(false)
    })
    return () => { active = false }
  }, [animalId, validId, attempt])

  const photos = animal?.fotos ?? []

  return <div className="app-shell">
    <Header />
    <main className="page-content details-page" id="conteudo">
      <div className="detail-header"><Link to={back} className="back">Voltar aos animais</Link></div>
      {!validId && <section className="empty-state"><h1>Animal não encontrado</h1><p>Volte ao catálogo para ver os animais disponíveis.</p></section>}
      {loading && validId && <p className="page-state" role="status">Carregando detalhes...</p>}
      {!loading && error && <div className="page-state" role="alert"><h1>{error === 'Este animal não está disponível no catálogo.' ? 'Animal indisponível' : 'Não foi possível carregar o animal'}</h1><p>{error}</p>{error !== 'Este animal não está disponível no catálogo.' && <Button type="button" secondary onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</Button>}</div>}
      {!loading && animal && <article className="detail-layout">
        <div className="detail-gallery">
          <Photo name={animal.nome} species={speciesLabel[animal.especie]} src={selectedPhoto?.url} className="detail-photo" eager />
          {photos.length > 1 && <div className="detail-thumbs" aria-label={`Fotografias de ${animal.nome}`}>{photos.map((photo, index) => <button type="button" key={photo.id} className={selectedPhoto?.id === photo.id ? 'selected' : ''} aria-label={`Ver fotografia ${index + 1} de ${animal.nome}`} aria-pressed={selectedPhoto?.id === photo.id} onClick={() => setSelectedPhoto(photo)}><Photo name={animal.nome} species={speciesLabel[animal.especie]} src={photo.url} /></button>)}</div>}
        </div>
        <div className="details-body">
          <p className="detail-status">Disponível para adoção</p>
          <h1>{animal.nome}</h1>
          <p className="detail-lead">{speciesLabel[animal.especie]} · {approximateAge(animal.idadeAproximada)}</p>
          {animal.descricao && <p className="description">{animal.descricao}</p>}
          <dl className="info-grid">
            <div><dt>Espécie</dt><dd>{speciesLabel[animal.especie]}</dd></div>
            <div><dt>Porte</dt><dd>{sizeLabel[animal.porte]}</dd></div>
            <div><dt>Idade aproximada</dt><dd>{approximateAge(animal.idadeAproximada)}</dd></div>
            <div><dt>Sexo</dt><dd>{sexLabel[animal.sexo]}</dd></div>
          </dl>
          <section className="detail-ong"><h2>ONG responsável</h2><p>{animal.ong.nome}</p><span>{animal.ong.cidade}, {animal.ong.estado}</span><p><Link to={`/transparencia/${animal.ong.id}`}>Ver transparência desta ONG</Link></p></section>
          {(status === 'unauthenticated' || status === 'expired' || user?.perfil === 'USUARIO') && <nav className="detail-actions" aria-label={`Apoiar ${animal.nome}`}>
            <Link className="button button-primary" to={`/animais/${animal.id}/solicitar`}>Solicitar adoção</Link>
            <Link className="detail-action-link" to={`/animais/${animal.id}/apadrinhar`}>Apadrinhar {animal.nome}</Link>
            <Link className="detail-action-link" to={`/animais/${animal.id}/doar`}>Doar para {animal.ong.nome}</Link>
          </nav>}
        </div>
      </article>}
    </main>
    <BottomNav />
  </div>
}
