import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice } from '../../shared/components/Ui'
import { useAuth } from '../auth/auth'
import { correctMedicalRecord, createMedicalRecord, getAnimal, getMedicalRecord, institutionalError, listAnimals, listMedicalCorrections, listMedicalRecords, type Animal, type MedicalCorrection, type MedicalInput, type MedicalRecord, type MedicalType, type Page } from './api'
import { Empty, LoadState, PageHeading, Pager, Status } from './InstitutionalUi'

const kinds: MedicalType[] = ['CONSULTA', 'VACINA', 'VERMIFUGACAO', 'EXAME', 'CIRURGIA', 'TRATAMENTO', 'MEDICACAO', 'OBSERVACAO']
const today = new Date().toLocaleDateString('sv-SE')
const names: Record<MedicalType, string> = { CONSULTA: 'Consulta', VACINA: 'Vacina', VERMIFUGACAO: 'Vermifugação', EXAME: 'Exame', CIRURGIA: 'Cirurgia', TRATAMENTO: 'Tratamento', MEDICACAO: 'Medicação', OBSERVACAO: 'Observação' }
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)) : '—'
const canWrite = (profile: string | undefined) => profile === 'ADMINISTRADOR' || profile === 'VETERINARIO'
const fieldError = (id: string, message?: string) => message ? <span id={`${id}-error`} className="institutional-field-error">{message}</span> : null

export function ClinicalAnimalSelect() {
  const [search, setSearch] = useSearchParams()
  const [term, setTerm] = useState(search.get('busca') ?? '')
  const [result, setResult] = useState<Page<Animal> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const key = search.toString()
  useEffect(() => { let active = true; listAnimals({ page: search.get('page') || 1, busca: search.get('busca') || undefined }).then(data => { if (active) { setResult(data); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [key, attempt, search])
  function change(next: URLSearchParams) { setSearch(next); setLoading(true) }
  return <><PageHeading title="Prontuários veterinários" description="Selecione um animal da sua ONG para consultar o histórico clínico." /><form className="institutional-toolbar institutional-search" role="search" onSubmit={event => { event.preventDefault(); const next = new URLSearchParams(); if (term.trim()) next.set('busca', term.trim()); change(next) }}><div><label htmlFor="clinical-animal-search">Buscar animal pelo nome</label><input id="clinical-animal-search" type="search" minLength={2} maxLength={100} value={term} onChange={event => setTerm(event.target.value)} placeholder="Nome do animal" /></div><button type="submit" className="button button-secondary">Buscar</button>{search.has('busca') && <button type="button" className="institutional-clear" onClick={() => { setTerm(''); change(new URLSearchParams()) }}>Limpar busca</button>}</form><LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />{!loading && !error && result && (result.data.length ? <><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th scope="col">Animal</th><th scope="col">Situação</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead><tbody>{result.data.map(item => <tr key={item.id}><td data-label="Animal"><strong>{item.nome}</strong><small className="institutional-muted">#{item.id}</small></td><td data-label="Situação"><Status value={item.situacao} /></td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/animais/${item.id}/prontuarios`}>Ver prontuário →</Link></td></tr>)}</tbody></table></div><Pager page={result.meta.current_page} last={result.meta.last_page} total={result.meta.total} onPage={page => { const next = new URLSearchParams(search); next.set('page', String(page)); change(next) }} /></> : <Empty title="Nenhum animal encontrado">{search.size ? 'Tente outro nome.' : 'Os animais da ONG aparecerão aqui.'}</Empty>)}</>
}

export function MedicalHistory() {
  const animalId = Number(useParams().animalId)
  const { user } = useAuth()
  const [search, setSearch] = useSearchParams()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [result, setResult] = useState<Page<MedicalRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const key = search.toString()
  useEffect(() => { let active = true; Promise.all([getAnimal(animalId), listMedicalRecords(animalId, { page: search.get('page') || 1, tipo: search.get('tipo') || undefined, de: search.get('de') || undefined, ate: search.get('ate') || undefined })]).then(([a, data]) => { if (active) { setAnimal(a); setResult(data); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [animalId, key, attempt, search])
  function filter(name: string, value: string) { const next = new URLSearchParams(search); if (value) next.set(name, value); else next.delete(name); next.delete('page'); setSearch(next); setLoading(true) }
  return <><PageHeading title={animal ? `Prontuário de ${animal.nome}` : 'Prontuário veterinário'} description={animal ? `Histórico clínico do animal #${animal.id}` : undefined} back="/ong/prontuarios" action={animal && canWrite(user?.perfil) && !['ADOTADO', 'FALECIDO'].includes(animal.situacao) ? <Link className="button button-primary" to={`/ong/animais/${animalId}/prontuarios/novo`}>Novo registro</Link> : undefined} />{animal && ['ADOTADO', 'FALECIDO'].includes(animal.situacao) && <p className="institutional-help">O histórico permanece consultável. Novos procedimentos comuns não podem ser registrados para este animal.</p>}<div className="institutional-toolbar institutional-filters" aria-label="Filtrar prontuário"><div><label htmlFor="medical-type">Tipo</label><select id="medical-type" value={search.get('tipo') ?? ''} onChange={event => filter('tipo', event.target.value)}><option value="">Todos</option>{kinds.map(kind => <option key={kind} value={kind}>{names[kind]}</option>)}</select></div><div><label htmlFor="medical-from">Data inicial</label><input id="medical-from" type="date" value={search.get('de') ?? ''} onChange={event => filter('de', event.target.value)} /></div><div><label htmlFor="medical-to">Data final</label><input id="medical-to" type="date" value={search.get('ate') ?? ''} onChange={event => filter('ate', event.target.value)} /></div>{search.size > 0 && <button type="button" className="institutional-clear" onClick={() => { setSearch(new URLSearchParams()); setLoading(true) }}>Limpar filtros</button>}</div><LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />{!loading && !error && result && (result.data.length ? <><ol className="clinical-history">{result.data.map(item => <li key={item.id}><article className="institutional-section clinical-entry"><div><span className="clinical-kind">{names[item.tipo]}</span><time dateTime={item.dataProcedimento}>{date(item.dataProcedimento)}</time></div><h2>{item.titulo}</h2><p>{item.descricao}</p><p className="institutional-help">Registrado por {item.registradoPor.nome}</p><Link className="institutional-row-link" to={`/ong/animais/${animalId}/prontuarios/${item.id}`}>Abrir registro →</Link></article></li>)}</ol><Pager page={result.meta.current_page} last={result.meta.last_page} total={result.meta.total} onPage={page => { const next = new URLSearchParams(search); next.set('page', String(page)); setSearch(next); setLoading(true) }} /></> : <Empty title="Nenhum registro clínico encontrado">{search.size ? 'Ajuste os filtros para consultar outras datas ou tipos.' : 'O histórico deste animal aparecerá aqui após o primeiro registro.'}</Empty>)}</>
}

function MedicalForm({ initial, correction, busy, errors, onSubmit }: { initial?: MedicalRecord; correction?: boolean; busy: boolean; errors: Record<string, string[]>; onSubmit: (value: MedicalInput & { justificativa?: string }) => void }) {
  const [tipo, setTipo] = useState<MedicalType>(initial?.tipo ?? 'CONSULTA')
  const [titulo, setTitulo] = useState(initial?.titulo ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [dataProcedimento, setData] = useState(initial?.dataProcedimento ?? '')
  const [profissionalResponsavel, setProfessional] = useState(initial?.profissionalResponsavel ?? '')
  const [medicamentos, setMedicines] = useState(initial?.medicamentos ?? '')
  const [observacoes, setNotes] = useState(initial?.observacoes ?? '')
  const [justificativa, setReason] = useState('')
  function submit(event: FormEvent) { event.preventDefault(); if (busy) return; onSubmit({ tipo, titulo: titulo.trim(), descricao: descricao.trim(), dataProcedimento, profissionalResponsavel: profissionalResponsavel.trim() || null, medicamentos: medicamentos.trim() || null, observacoes: observacoes.trim() || null, ...(correction ? { justificativa: justificativa.trim() } : {}) }) }
  return <form className="institutional-form" onSubmit={submit}><div className="institutional-form-grid"><div className="institutional-field"><label htmlFor="medical-kind">Tipo</label><select id="medical-kind" value={tipo} onChange={event => setTipo(event.target.value as MedicalType)}>{kinds.map(kind => <option value={kind} key={kind}>{names[kind]}</option>)}</select></div><div className="institutional-field"><label htmlFor="medical-date">Data do procedimento</label><input id="medical-date" type="date" required max={today} value={dataProcedimento} onChange={event => setData(event.target.value)} aria-invalid={Boolean(errors.dataProcedimento)} aria-describedby={errors.dataProcedimento ? 'medical-date-error' : undefined} />{fieldError('medical-date', errors.dataProcedimento?.[0])}</div></div><div className="institutional-field"><label htmlFor="medical-title">Título</label><input id="medical-title" required maxLength={120} value={titulo} onChange={event => setTitulo(event.target.value)} aria-invalid={Boolean(errors.titulo)} aria-describedby={errors.titulo ? 'medical-title-error' : undefined} />{fieldError('medical-title', errors.titulo?.[0])}</div><div className="institutional-field"><label htmlFor="medical-description">Descrição clínica</label><textarea id="medical-description" required maxLength={10000} rows={5} value={descricao} onChange={event => setDescricao(event.target.value)} aria-invalid={Boolean(errors.descricao)} aria-describedby={errors.descricao ? 'medical-description-error' : undefined} />{fieldError('medical-description', errors.descricao?.[0])}</div><div className="institutional-field"><label htmlFor="medical-professional">Profissional responsável (opcional)</label><input id="medical-professional" maxLength={120} value={profissionalResponsavel} onChange={event => setProfessional(event.target.value)} /></div><div className="institutional-field"><label htmlFor="medical-medicines">Medicamentos (opcional)</label><textarea id="medical-medicines" maxLength={5000} rows={3} value={medicamentos} onChange={event => setMedicines(event.target.value)} /></div><div className="institutional-field"><label htmlFor="medical-notes">Observações (opcional)</label><textarea id="medical-notes" maxLength={5000} rows={3} value={observacoes} onChange={event => setNotes(event.target.value)} /></div>{correction && <div className="institutional-field"><label htmlFor="medical-reason">Justificativa da correção</label><textarea id="medical-reason" required maxLength={2000} rows={3} value={justificativa} onChange={event => setReason(event.target.value)} aria-invalid={Boolean(errors.justificativa)} aria-describedby={errors.justificativa ? 'medical-reason-error' : undefined} />{fieldError('medical-reason', errors.justificativa?.[0])}</div>}{errors.campos && <Notice variant="error">{errors.campos[0]}</Notice>}<div className="institutional-form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : correction ? 'Salvar correção' : 'Registrar procedimento'}</button></div></form>
}

export function MedicalCreate() {
  const animalId = Number(useParams().animalId)
  const navigate = useNavigate()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { getAnimal(animalId).then(setAnimal).catch(cause => setError(institutionalError(cause))).finally(() => setLoading(false)) }, [animalId])
  async function save(value: MedicalInput) { setBusy(true); setError(''); setErrors({}); try { const record = await createMedicalRecord(animalId, value); navigate(`/ong/animais/${animalId}/prontuarios/${record.id}`, { replace: true, state: { notice: 'Registro clínico criado.' } }) } catch (cause) { if (cause instanceof ApiError && cause.errors) setErrors(cause.errors); setError(institutionalError(cause)) } finally { setBusy(false) } }
  return <><PageHeading title="Novo registro clínico" description={animal ? `Prontuário de ${animal.nome}` : undefined} back={`/ong/animais/${animalId}/prontuarios`} /><LoadState loading={loading} error={!animal ? error : ''} retry={() => window.location.reload()} />{animal && !['ADOTADO', 'FALECIDO'].includes(animal.situacao) && <section className="institutional-section institutional-form-panel">{error && <Notice variant="error">{error}</Notice>}<MedicalForm busy={busy} errors={errors} onSubmit={save} /></section>}{animal && ['ADOTADO', 'FALECIDO'].includes(animal.situacao) && <Notice variant="error">Este animal não pode receber novos procedimentos clínicos.</Notice>}</>
}

export function MedicalDetails() {
  const animalId = Number(useParams().animalId)
  const id = Number(useParams().recordId)
  const { user } = useAuth()
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  useEffect(() => { let active = true; getMedicalRecord(animalId, id).then(value => { if (active) { setRecord(value); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [animalId, id, attempt])
  return <><PageHeading title={record?.titulo ?? 'Registro clínico'} description={record ? `${names[record.tipo]} · ${date(record.dataProcedimento)}` : undefined} back={`/ong/animais/${animalId}/prontuarios`} action={record && canWrite(user?.perfil) ? <Link className="button button-secondary" to={`/ong/animais/${animalId}/prontuarios/${id}/corrigir`}>Corrigir registro</Link> : undefined} />{notice && <Notice variant="success">{notice}</Notice>}<LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />{!loading && record && <div className="institutional-detail-grid"><section className="institutional-section"><p className="section-label">{names[record.tipo]} · {date(record.dataProcedimento)}</p><h2>{record.titulo}</h2><p className="clinical-description">{record.descricao}</p><dl className="institutional-facts"><div><dt>Animal</dt><dd><Link to={`/ong/animais/${animalId}`}>{record.animal.nome}</Link></dd></div><div><dt>Profissional responsável</dt><dd>{record.profissionalResponsavel || 'Não informado'}</dd></div><div><dt>Medicamentos</dt><dd>{record.medicamentos || 'Não informado'}</dd></div><div><dt>Observações</dt><dd>{record.observacoes || 'Não informado'}</dd></div></dl></section><aside className="institutional-section institutional-detail-side"><h2>Rastreabilidade</h2><p>Registro original de {record.registradoPor.nome}, criado em {date(record.createdAt)}.</p><p>Última atualização em {date(record.updatedAt)}.</p><Link className="institutional-row-link" to={`/ong/animais/${animalId}/prontuarios/${id}/correcoes`}>Ver histórico de correções →</Link></aside></div>}</>
}

export function MedicalCorrect() {
  const animalId = Number(useParams().animalId)
  const id = Number(useParams().recordId)
  const navigate = useNavigate()
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { getMedicalRecord(animalId, id).then(setRecord).catch(cause => setError(institutionalError(cause))).finally(() => setLoading(false)) }, [animalId, id])
  async function save(value: MedicalInput & { justificativa?: string }) {
    if (!record || busy) return
    const fields = ['tipo', 'titulo', 'descricao', 'dataProcedimento', 'profissionalResponsavel', 'medicamentos', 'observacoes'] as const
    const changes = Object.fromEntries(fields.filter(field => value[field] !== record[field]).map(field => [field, value[field]])) as Partial<MedicalInput>
    if (!Object.keys(changes).length) { setError('Altere ao menos um campo clínico antes de salvar.'); return }
    setBusy(true); setError(''); setErrors({})
    try {
      const latest = await getMedicalRecord(animalId, id)
      if (latest.updatedAt !== record.updatedAt) { setError('Este registro mudou desde que foi aberto. Volte aos detalhes e revise os dados atuais.'); return }
      await correctMedicalRecord(animalId, id, { ...changes, justificativa: value.justificativa?.trim() ?? '' })
      navigate(`/ong/animais/${animalId}/prontuarios/${id}`, { replace: true, state: { notice: 'Correção salva com justificativa. O histórico anterior foi preservado.' } })
    } catch (cause) { if (cause instanceof ApiError && cause.errors) setErrors(cause.errors); setError(institutionalError(cause)) } finally { setBusy(false) }
  }
  return <><PageHeading title="Corrigir registro clínico" description={record ? `${record.animal.nome} · ${record.titulo}` : undefined} back={`/ong/animais/${animalId}/prontuarios/${id}`} /><LoadState loading={loading} error={!record ? error : ''} retry={() => window.location.reload()} />{record && <section className="institutional-section institutional-form-panel"><p className="institutional-help">A correção atualiza os dados clínicos e preserva os valores anteriores no histórico. O autor original permanece identificado.</p>{error && <Notice variant="error">{error}</Notice>}<MedicalForm initial={record} correction busy={busy} errors={errors} onSubmit={save} /></section>}</>
}

export function MedicalCorrections() {
  const animalId = Number(useParams().animalId)
  const id = Number(useParams().recordId)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Page<MedicalCorrection> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; listMedicalCorrections(animalId, id, page).then(value => { if (active) { setResult(value); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [animalId, id, page, attempt])
  return <><PageHeading title="Histórico de correções" description="Versões anteriores preservadas em ordem cronológica." back={`/ong/animais/${animalId}/prontuarios/${id}`} /><LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />{!loading && !error && result && (result.data.length ? <><ol className="clinical-history">{result.data.map(item => <li key={item.id}><article className="institutional-section clinical-entry"><p className="section-label">Correção #{item.id} · {date(item.createdAt)}</p><h2>{item.corrigidoPor.nome}</h2><p><strong>Justificativa:</strong> {item.justificativa}</p><div className="clinical-versions"><div><h3>Antes</h3><ClinicalVersion value={item.dadosAnteriores} /></div><div><h3>Depois</h3><ClinicalVersion value={item.dadosNovos} /></div></div></article></li>)}</ol><Pager page={result.meta.current_page} last={result.meta.last_page} total={result.meta.total} onPage={value => { setPage(value); setLoading(true) }} /></> : <Empty title="Nenhuma correção registrada">O conteúdo atual corresponde ao registro original.</Empty>)}</>
}

function ClinicalVersion({ value }: { value: MedicalInput }) {
  return <dl className="clinical-version"><div><dt>Tipo</dt><dd>{names[value.tipo]}</dd></div><div><dt>Título</dt><dd>{value.titulo}</dd></div><div><dt>Descrição</dt><dd>{value.descricao}</dd></div><div><dt>Data</dt><dd>{date(value.dataProcedimento)}</dd></div>{value.profissionalResponsavel && <div><dt>Profissional</dt><dd>{value.profissionalResponsavel}</dd></div>}{value.medicamentos && <div><dt>Medicamentos</dt><dd>{value.medicamentos}</dd></div>}{value.observacoes && <div><dt>Observações</dt><dd>{value.observacoes}</dd></div>}</dl>
}
