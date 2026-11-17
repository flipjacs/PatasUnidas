import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice, Photo as AnimalPhoto } from '../../shared/components/Ui'
import { useAuth } from '../auth/auth'
import { changeSituation, createAnimal, deletePhoto, getAnimal, institutionalError, listAnimals, listPhotos, setPrimaryPhoto, setPublication, updateAnimal, uploadPhoto, type Animal, type AnimalInput, type Page, type Photo, type Situation } from './api'
import { Empty, LoadState, PageHeading, Pager, Status } from './InstitutionalUi'

const species = ['CACHORRO', 'GATO', 'OUTRO'] as const
const sexes = ['MACHO', 'FEMEA', 'NAO_INFORMADO'] as const
const sizes = ['PEQUENO', 'MEDIO', 'GRANDE', 'NAO_INFORMADO'] as const
const situations: Situation[] = ['DISPONIVEL', 'INDISPONIVEL', 'EM_PROCESSO_ADOCAO', 'ADOTADO', 'FALECIDO']
const labels: Record<string, string> = { CACHORRO: 'Cachorro', GATO: 'Gato', OUTRO: 'Outro', MACHO: 'Macho', FEMEA: 'Fêmea', NAO_INFORMADO: 'Não informado', PEQUENO: 'Pequeno', MEDIO: 'Médio', GRANDE: 'Grande' }

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={`${id}-error`} className="institutional-field-error">{message}</span> : null
}

function focusInvalidField() { requestAnimationFrame(() => document.querySelector<HTMLElement>('.institutional-form [aria-invalid="true"]')?.focus()) }

function Select({ id, label, value, options, onChange, error }: { id: string; label: string; value: string; options: readonly string[]; onChange: (value: string) => void; error?: string }) {
  return <div className="institutional-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={event => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>{options.map(option => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select><FieldError id={id} message={error} /></div>
}

function AnimalForm({ initial, onSubmit, busy, errors = {} }: { initial?: Animal; onSubmit: (value: AnimalInput) => Promise<void>; busy: boolean; errors?: Record<string, string[]> }) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [especie, setEspecie] = useState<AnimalInput['especie']>(initial?.especie ?? 'CACHORRO')
  const [sexo, setSexo] = useState<AnimalInput['sexo']>(initial?.sexo ?? 'NAO_INFORMADO')
  const [porte, setPorte] = useState<AnimalInput['porte']>(initial?.porte ?? 'NAO_INFORMADO')
  const [idade, setIdade] = useState(String(initial?.idadeAproximada ?? ''))
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    void onSubmit({ nome: nome.trim(), especie, sexo, porte, idade_aproximada: Number(idade), descricao: descricao.trim() || null })
  }
  return <form className="institutional-form" onSubmit={submit}>
    <div className="institutional-field"><label htmlFor="animal-nome">Nome</label><input id="animal-nome" value={nome} onChange={event => setNome(event.target.value)} required maxLength={100} aria-invalid={Boolean(errors.nome)} aria-describedby={errors.nome ? 'animal-nome-error' : undefined} /><FieldError id="animal-nome" message={errors.nome?.[0]} /></div>
    <div className="institutional-form-grid"><Select id="animal-especie" label="Espécie" value={especie} options={species} onChange={v => setEspecie(v as AnimalInput['especie'])} error={errors.especie?.[0]} /><Select id="animal-sexo" label="Sexo" value={sexo} options={sexes} onChange={v => setSexo(v as AnimalInput['sexo'])} error={errors.sexo?.[0]} /><Select id="animal-porte" label="Porte" value={porte} options={sizes} onChange={v => setPorte(v as AnimalInput['porte'])} error={errors.porte?.[0]} /><div className="institutional-field"><label htmlFor="animal-idade">Idade aproximada em meses</label><input id="animal-idade" type="number" min="0" max="1200" step="1" value={idade} onChange={event => setIdade(event.target.value)} required aria-invalid={Boolean(errors.idade_aproximada)} aria-describedby={errors.idade_aproximada ? 'animal-idade-error' : undefined} /><FieldError id="animal-idade" message={errors.idade_aproximada?.[0]} /></div></div>
    <div className="institutional-field"><label htmlFor="animal-descricao">Descrição</label><textarea id="animal-descricao" value={descricao} onChange={event => setDescricao(event.target.value)} maxLength={2000} rows={4} aria-invalid={Boolean(errors.descricao)} aria-describedby={errors.descricao ? 'animal-descricao-error' : undefined} /><FieldError id="animal-descricao" message={errors.descricao?.[0]} /></div>
    <div className="institutional-form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : initial ? 'Salvar alterações' : 'Cadastrar animal'}</button></div>
  </form>
}

export function AnimalList() {
  const { user } = useAuth()
  const [search, setSearch] = useSearchParams()
  const [term, setTerm] = useState(search.get('busca') ?? '')
  const location = useLocation()
  const [page, setPage] = useState<Page<Animal> | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const current = Number(search.get('page') || 1)
  const key = `${search.toString()}:${attempt}`
  const loading = loadedKey !== key
  useEffect(() => {
    let active = true
    listAnimals({ page: Number.isInteger(current) && current > 0 ? current : 1, busca: search.get('busca') || undefined, especie: search.get('especie') || undefined, sexo: search.get('sexo') || undefined, porte: search.get('porte') || undefined, situacao: search.get('situacao') || undefined })
      .then(result => { if (active) { setPage(result); setError(''); setLoadedKey(key) } })
      .catch(cause => { if (active) { setError(institutionalError(cause)); setLoadedKey(key) } })
    return () => { active = false }
  }, [search, current, attempt, key])
  function filter(key: string, value: string) { const next = new URLSearchParams(search); if (value) next.set(key, value); else next.delete(key); next.delete('page'); setSearch(next) }
  function go(number: number) { const next = new URLSearchParams(search); next.set('page', String(number)); setSearch(next) }
  return <>
    <PageHeading title="Animais da ONG" description={user?.perfil === 'VETERINARIO' ? 'Consulte os registros dos animais da sua organização.' : 'Gerencie os registros, a situação e a publicação dos animais da sua organização.'} action={user?.perfil !== 'VETERINARIO' ? <Link className="button button-primary" to="/ong/animais/novo">Cadastrar animal</Link> : undefined} />
    <form className="institutional-toolbar institutional-search" role="search" onSubmit={event => { event.preventDefault(); filter('busca', term.trim()) }}><div><label htmlFor="animal-search">Buscar animal pelo nome</label><input id="animal-search" type="search" placeholder="Nome do animal" value={term} onChange={event => setTerm(event.target.value)} minLength={2} maxLength={100} /></div><button className="button button-secondary" type="submit">Buscar</button>{search.has('busca') && <button type="button" className="institutional-clear" onClick={() => { setTerm(''); filter('busca', '') }}>Limpar busca</button>}</form>
    <div className="institutional-toolbar institutional-filters" aria-label="Filtrar animais">
      <div><label htmlFor="filter-species">Espécie</label><select id="filter-species" value={search.get('especie') ?? ''} onChange={e => filter('especie', e.target.value)}><option value="">Todas</option>{species.map(v => <option value={v} key={v}>{labels[v]}</option>)}</select></div>
      <div><label htmlFor="filter-situation">Situação</label><select id="filter-situation" value={search.get('situacao') ?? ''} onChange={e => filter('situacao', e.target.value)}><option value="">Todas</option>{situations.map(v => <option value={v} key={v}>{v.replaceAll('_', ' ')}</option>)}</select></div>
      <div><label htmlFor="filter-sex">Sexo</label><select id="filter-sex" value={search.get('sexo') ?? ''} onChange={e => filter('sexo', e.target.value)}><option value="">Todos</option>{sexes.map(v => <option value={v} key={v}>{labels[v]}</option>)}</select></div>
      <div><label htmlFor="filter-size">Porte</label><select id="filter-size" value={search.get('porte') ?? ''} onChange={e => filter('porte', e.target.value)}><option value="">Todos</option>{sizes.map(v => <option value={v} key={v}>{labels[v]}</option>)}</select></div>
      {[...search.keys()].some(key => !['busca', 'page'].includes(key)) && <button type="button" className="institutional-clear" onClick={() => { const next = new URLSearchParams(); if (search.has('busca')) next.set('busca', search.get('busca') ?? ''); setSearch(next) }}>Limpar filtros</button>}
    </div>
    <LoadState loading={loading} error={error} retry={() => setAttempt(n => n + 1)} />
    {!loading && !error && page && (page.data.length ? <>
      <div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th scope="col">Animal</th><th scope="col">Espécie</th><th scope="col">Situação</th><th scope="col">Publicação</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead><tbody>{page.data.map(animal => <tr key={animal.id}><td data-label="Animal"><div className="institutional-animal-cell"><AnimalPhoto src={animal.fotoPrincipal?.url} name={animal.nome} species={labels[animal.especie]} /><span><strong>{animal.nome}</strong><small>#{animal.id}</small></span></div></td><td data-label="Espécie">{labels[animal.especie]}</td><td data-label="Situação"><Status value={animal.situacao} /></td><td data-label="Publicação">{animal.publicado ? 'Publicado' : 'Não publicado'}</td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/animais/${animal.id}`} state={{ from: location.pathname + location.search }}>Abrir detalhes →</Link></td></tr>)}</tbody></table></div>
      <Pager page={page.meta.current_page} last={page.meta.last_page} total={page.meta.total} onPage={go} />
    </> : <Empty title="Nenhum animal encontrado">{search.size ? 'Experimente remover algum filtro.' : 'Cadastre o primeiro animal da ONG para começar.'}</Empty>)}
  </>
}

export function AnimalCreate() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  async function save(value: AnimalInput) { setBusy(true); setError(''); setFieldErrors({}); try { const animal = await createAnimal(value); navigate(`/ong/animais/${animal.id}`, { replace: true, state: { notice: 'Animal cadastrado. A publicação pode ser definida abaixo.' } }) } catch (cause) { if (cause instanceof ApiError && cause.errors) { setFieldErrors(cause.errors); setError('Confira os campos indicados.'); focusInvalidField() } else setError(institutionalError(cause)) } finally { setBusy(false) } }
  return <><PageHeading title="Cadastrar animal" description="O animal será vinculado automaticamente à sua ONG e começará não publicado." back="/ong/animais" /><section className="institutional-section institutional-form-panel">{error && <Notice variant="error">{error}</Notice>}<AnimalForm onSubmit={save} busy={busy} errors={fieldErrors} /></section></>
}

export function AnimalDetails() {
  const { user } = useAuth()
  const readOnly = user?.perfil === 'VETERINARIO'
  const id = Number(useParams().id)
  const location = useLocation()
  const back = (location.state as { from?: string } | null)?.from ?? '/ong/animais'
  const notice = (location.state as { notice?: string } | null)?.notice
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loadedKey, setLoadedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [feedback, setFeedback] = useState(notice ?? '')
  const [attempt, setAttempt] = useState(0)
  const key = `${id}:${attempt}`
  const loading = loadedKey !== key
  useEffect(() => { let active = true; Promise.all([getAnimal(id), listPhotos(id)]).then(([record, images]) => { if (active) { setAnimal(record); setPhotos(images); setError(''); setLoadedKey(key) } }).catch(cause => { if (active) { setAnimal(null); setError(institutionalError(cause)); setLoadedKey(key) } }); return () => { active = false } }, [id, attempt, key])
  async function act(operation: () => Promise<unknown>, message: string) { if (busy) return; setBusy(true); setError(''); setFieldErrors({}); setFeedback(''); try { await operation(); const [record, images] = await Promise.all([getAnimal(id), listPhotos(id)]); setAnimal(record); setPhotos(images); setFeedback(message) } catch (cause) { if (cause instanceof ApiError && cause.errors) { setFieldErrors(cause.errors); setError('Confira os campos indicados.'); focusInvalidField() } else setError(institutionalError(cause)); if (cause instanceof ApiError && cause.status === 409) setAttempt(n => n + 1) } finally { setBusy(false) } }
  async function onUpload(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Use JPEG, PNG ou WebP com até 5 MB.'); return }
    await act(() => uploadPhoto(id, file), 'Fotografia enviada.')
  }
  const options = animal?.situacao === 'DISPONIVEL' ? ['INDISPONIVEL', 'FALECIDO'] as const : animal?.situacao === 'INDISPONIVEL' ? ['DISPONIVEL', 'FALECIDO'] as const : []
  return <>
    <PageHeading title={animal?.nome ?? 'Animal'} description={animal ? `Registro #${animal.id} · ${labels[animal.especie]} · ${animal.idadeAproximada} meses` : undefined} back={back} action={animal ? <Link className="button button-secondary" to={`/ong/animais/${id}/prontuarios`}>Ver prontuário</Link> : undefined} />
    <LoadState loading={loading} error={!animal ? error : ''} retry={() => setAttempt(n => n + 1)} />
    {!loading && animal && <>
      {error && <Notice variant="error">{error}</Notice>}{feedback && <Notice variant="success">{feedback}</Notice>}
      <div className="institutional-detail-grid">
        <section className="institutional-section" aria-labelledby="animal-data"><div className="institutional-section-head"><h2 id="animal-data">Dados cadastrais</h2></div>{readOnly ? <dl className="institutional-animal-readonly"><div><dt>Nome</dt><dd>{animal.nome}</dd></div><div><dt>Espécie</dt><dd>{labels[animal.especie]}</dd></div><div><dt>Sexo</dt><dd>{labels[animal.sexo]}</dd></div><div><dt>Porte</dt><dd>{labels[animal.porte]}</dd></div><div><dt>Idade aproximada</dt><dd>{animal.idadeAproximada} meses</dd></div><div><dt>Descrição</dt><dd>{animal.descricao || 'Não informada'}</dd></div></dl> : <AnimalForm key={animal.updatedAt} initial={animal} onSubmit={value => act(() => updateAnimal(id, value), 'Dados salvos.')} busy={busy} errors={fieldErrors} />}</section>
        <div className="institutional-detail-side">
          <section className="institutional-section" aria-labelledby="animal-status"><div className="institutional-section-head"><h2 id="animal-status">Situação</h2><Status value={animal.situacao} /></div><p className="institutional-help">Estados de adoção são controlados pelo processo de adoção.</p>{!readOnly && options.length > 0 && <div className="institutional-action-list">{options.map(option => <button key={option} type="button" className={`button ${option === 'FALECIDO' ? 'button-destructive' : 'button-secondary'}`} disabled={busy} onClick={() => { if (option !== 'FALECIDO' || window.confirm('Registrar falecimento? Esta situação não pode ser revertida por esta área.')) void act(() => changeSituation(id, option), 'Situação atualizada.') }}>{option === 'FALECIDO' ? 'Registrar falecimento' : option === 'DISPONIVEL' ? 'Marcar disponível' : 'Marcar indisponível'}</button>)}</div>}</section>
          <section className="institutional-section" aria-labelledby="animal-publication"><div className="institutional-section-head"><h2 id="animal-publication">Publicação</h2><span>{animal.publicado ? 'Publicado' : 'Não publicado'}</span></div><p className="institutional-help">A visibilidade no catálogo também depende da situação do animal e do estado da ONG.</p>{!readOnly && <button type="button" className="button button-secondary" disabled={busy} onClick={() => void act(() => setPublication(id, !animal.publicado), animal.publicado ? 'Animal despublicado.' : 'Publicação atualizada.')}>{animal.publicado ? 'Despublicar' : 'Publicar'}</button>}</section>
        </div>
      </div>
      <section className="institutional-section institutional-photos" aria-labelledby="animal-photos"><div className="institutional-section-head"><div><h2 id="animal-photos">Fotografias</h2><p>Até 8 imagens JPEG, PNG ou WebP, com no máximo 5 MB cada.</p></div><span>{photos.length}/8</span></div>
        {photos.length ? <ul className="institutional-photo-grid">{photos.map(photo => <li key={photo.id}><AnimalPhoto src={photo.url} name={animal.nome} species={labels[animal.especie]} /><div className="institutional-photo-actions"><span>{photo.principal ? 'Principal' : `Foto #${photo.id}`}</span>{!readOnly && !photo.principal && <button type="button" disabled={busy} onClick={() => void act(() => setPrimaryPhoto(id, photo.id), 'Fotografia principal atualizada.')}>Definir principal</button>}{!readOnly && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Remover esta fotografia?')) void act(() => deletePhoto(id, photo.id), 'Fotografia removida.') }}>Remover</button>}</div></li>)}</ul> : <div className="institutional-photo-empty"><AnimalPhoto name={animal.nome} species={labels[animal.especie]} /><p className="institutional-help">Nenhuma fotografia cadastrada.</p></div>}
        {!readOnly && photos.length < 8 && <div className="institutional-upload"><label className="button button-secondary" htmlFor="animal-upload">{busy ? 'Enviando…' : 'Adicionar fotografia'}</label><input id="animal-upload" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { void onUpload(event.target.files?.[0]); event.target.value = '' }} /></div>}
      </section>
    </>}
  </>
}
