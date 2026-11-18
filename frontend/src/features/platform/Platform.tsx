import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice } from '../../shared/components/Ui'
import { Empty, LoadState, PageHeading, Pager, Status } from '../institutional/InstitutionalUi'
import { institutionalError, type Page } from '../institutional/api'
import { createFirstAdmin, createOng, getOng, listOngs, setOngActive, updateOng, type FirstAdmin, type Ong, type OngInput } from './api'
import './platform.css'

const blank: OngInput = { nome: '', email: '', cnpj_cpf: null, telefone: null, cidade: null, estado: null }
const fields: { key: keyof OngInput; label: string; max: number; type?: string }[] = [
  { key: 'nome', label: 'Nome da ONG', max: 120 }, { key: 'email', label: 'E-mail institucional', max: 120, type: 'email' },
  { key: 'cnpj_cpf', label: 'CNPJ ou CPF', max: 20 }, { key: 'telefone', label: 'Telefone', max: 20 },
  { key: 'cidade', label: 'Cidade', max: 80 }, { key: 'estado', label: 'Estado (UF)', max: 2 },
]

function OngForm({ initial, onSubmit, busy, error }: { initial: OngInput; onSubmit: (value: OngInput) => Promise<void>; busy: boolean; error: unknown }) {
  const [value, setValue] = useState(initial)
  const errors = error instanceof ApiError ? error.errors ?? {} : {}
  function submit(event: FormEvent) { event.preventDefault(); if (!busy) void onSubmit(value) }
  return <form className="institutional-form" onSubmit={submit}>
    {error != null && Object.keys(errors).length === 0 && <Notice variant="error">{institutionalError(error)}</Notice>}
    <div className="institutional-form-grid">{fields.map(field => <div className="institutional-field" key={field.key}>
      <label htmlFor={`ong-${field.key}`}>{field.label}</label>
      <input id={`ong-${field.key}`} name={field.key} type={field.type || 'text'} maxLength={field.max} required={field.key === 'nome' || field.key === 'email'} value={value[field.key] ?? ''} aria-invalid={!!errors[field.key]} aria-describedby={errors[field.key] ? `ong-${field.key}-error` : undefined} onChange={event => setValue(current => ({ ...current, [field.key]: event.target.value || (field.key === 'nome' || field.key === 'email' ? '' : null) }))} />
      {errors[field.key] && <small id={`ong-${field.key}-error`} className="platform-field-error">{errors[field.key].join(' ')}</small>}
    </div>)}</div>
    <div className="institutional-form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : initial.nome ? 'Salvar dados da ONG' : 'Cadastrar ONG'}</button></div>
  </form>
}

export function PlatformOverview() {
  const [search, setSearch] = useSearchParams()
  const requested = Number(search.get('page') || 1)
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1
  const [data, setData] = useState<Page<Ong> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; listOngs(page).then(result => { if (active) { setData(result); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [page, attempt])
  return <><PageHeading title="Organizações da plataforma" description="Cadastre e acompanhe as ONGs. Cada instituição começa suspensa até ter um administrador ativo." action={<Link className="button button-primary" to="/plataforma/ongs/nova">Cadastrar ONG</Link>} />
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(n => n + 1) }} />
    {!loading && !error && data && (data.data.length ? <><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>ONG</th><th>Localidade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{data.data.map(ong => <tr key={ong.id}><td data-label="ONG"><strong>{ong.nome}</strong><small>{ong.email}</small></td><td data-label="Localidade">{[ong.cidade, ong.estado].filter(Boolean).join(', ') || 'Não informada'}</td><td data-label="Situação"><Status value={ong.status} /></td><td data-label="Ação"><Link className="institutional-row-link" to={`/plataforma/ongs/${ong.id}`}>Gerenciar ONG</Link></td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={next => { setLoading(true); setSearch({ page: String(next) }) }} /></> : <Empty title="Nenhuma ONG cadastrada">Cadastre a primeira organização para iniciar a gestão institucional.</Empty>)}
  </>
}

export function PlatformCreate() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function save(value: OngInput) { setBusy(true); setError(null); try { const ong = await createOng(value); navigate(`/plataforma/ongs/${ong.id}`, { state: { created: true } }) } catch (cause) { setError(cause) } finally { setBusy(false) } }
  return <><PageHeading title="Cadastrar ONG" description="O cadastro institucional é exclusivo do criador. A nova ONG ficará suspensa até a ativação do primeiro administrador." back="/plataforma" /><section className="institutional-section institutional-form-panel"><OngForm initial={blank} onSubmit={save} busy={busy} error={error} /></section></>
}

export function PlatformDetails() {
  const id = Number(useParams().id)
  const [ong, setOng] = useState<Ong | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [admin, setAdmin] = useState<FirstAdmin | null>(null)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [confirmAction, setConfirmAction] = useState(false)
  useEffect(() => { let active = true; getOng(id).then(result => { if (active) { setOng(result); setError(null); setLoading(false) } }).catch(cause => { if (active) { setError(cause); setLoading(false) } }); return () => { active = false } }, [id, attempt])
  async function save(value: OngInput) { setBusy(true); setError(null); setMessage(''); try { setOng(await updateOng(id, value)); setMessage('Dados institucionais atualizados.') } catch (cause) { setError(cause) } finally { setBusy(false) } }
  async function changeStatus() { if (!ong || busy) return; setBusy(true); setError(null); setMessage(''); try { const active = ong.status === 'SUSPENSA'; setOng(await setOngActive(id, active)); setMessage(active ? 'ONG reativada.' : 'ONG suspensa. As operações institucionais e a visibilidade pública ficam restritas.'); setConfirmAction(false) } catch (cause) { setError(cause); setConfirmAction(false) } finally { setBusy(false) } }
  async function provision(event: FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(null); setMessage(''); try { const result = await createFirstAdmin(id, { nome: adminName.trim(), email: adminEmail.trim() }); setAdmin(result); setMessage('Primeiro administrador cadastrado como inativo.') } catch (cause) { setError(cause) } finally { setBusy(false) } }
  return <><PageHeading title={ong?.nome || 'Detalhes da ONG'} description="Dados e ações institucionais desta organização." back="/plataforma" />
    <LoadState loading={loading} error={!loading && error && !ong ? institutionalError(error) : ''} retry={() => { setLoading(true); setAttempt(n => n + 1) }} />
    {ong && <div className="platform-detail-layout"><div><section className="institutional-section institutional-form-panel"><div className="institutional-section-head"><h2>Dados institucionais</h2><Status value={ong.status} /></div>{message && <Notice variant="success">{message}</Notice>}{error != null && !(error instanceof ApiError && error.errors) && <div className="platform-inline-error"><Notice variant="error">{institutionalError(error)}</Notice></div>}<OngForm key={`${ong.id}-${ong.nome}-${ong.email}-${ong.cidade}-${ong.estado}`} initial={{ nome: ong.nome, email: ong.email, cnpj_cpf: ong.cnpjCpf, telefone: ong.telefone, cidade: ong.cidade, estado: ong.estado }} onSubmit={save} busy={busy} error={error instanceof ApiError && error.errors ? error : null} /></section>
      {ong.status === 'SUSPENSA' && <section className="institutional-section"><div className="institutional-section-head"><h2>Primeiro administrador</h2></div>{admin ? <><p><strong>{admin.nome}</strong> foi cadastrado como conta inativa.</p><p className="institutional-period-note">O token não é devolvido por esta API. Um responsável local deve gerar o convite com <code>php artisan patas-unidas:convite-admin {admin.id}</code> no backend e entregá-lo por canal seguro. O administrador define a senha em <Link to="/primeiro-acesso">Primeiro acesso</Link>.</p></> : <><p className="institutional-help">Cadastre somente o primeiro responsável desta ONG. Se ele já existir, a API recusará outra criação. A ativação é feita pelo fluxo de primeiro acesso.</p><form className="institutional-form platform-admin-form" onSubmit={provision}><div className="institutional-form-grid"><div className="institutional-field"><label htmlFor="admin-nome">Nome</label><input id="admin-nome" required maxLength={100} value={adminName} onChange={e => setAdminName(e.target.value)} /></div><div className="institutional-field"><label htmlFor="admin-email">E-mail</label><input id="admin-email" type="email" required maxLength={120} value={adminEmail} onChange={e => setAdminEmail(e.target.value)} /></div></div><button className="button button-primary" disabled={busy}>{busy ? 'Cadastrando…' : 'Cadastrar primeiro administrador'}</button></form></>}</section>}
      </div><aside className="institutional-section institutional-detail-side"><h2>Situação institucional</h2><p>{ong.status === 'ATIVA' ? 'A ONG está ativa. Suspender restringe suas operações e a visibilidade pública.' : 'Para reativar, a ONG precisa ter um administrador ativo após o primeiro acesso.'}</p>{confirmAction ? <div className="platform-confirm"><p>Confirma {ong.status === 'ATIVA' ? 'a suspensão' : 'a reativação'} de {ong.nome}?</p><button className="button button-primary" disabled={busy} onClick={changeStatus}>{busy ? 'Aguarde…' : ong.status === 'ATIVA' ? 'Confirmar suspensão' : 'Confirmar reativação'}</button><button className="button button-secondary" disabled={busy} onClick={() => setConfirmAction(false)}>Voltar</button></div> : <button className="button button-secondary" disabled={busy} onClick={() => setConfirmAction(true)}>{ong.status === 'ATIVA' ? 'Suspender ONG' : 'Reativar ONG'}</button>}</aside></div>}
  </>
}
