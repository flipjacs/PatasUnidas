import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice } from '../../shared/components/Ui'
import { createEmployee, getEmployee, institutionalError, listEmployees, setEmployeeActive, updateEmployee, type Employee, type Page } from './api'
import { Empty, LoadState, PageHeading, Pager, Status } from './InstitutionalUi'

const profileName = (perfil: Employee['perfil']) => perfil === 'VOLUNTARIO' ? 'Voluntário' : 'Veterinário'
const fieldError = (id: string, message?: string) => message ? <span id={`${id}-error`} className="institutional-field-error">{message}</span> : null
const focusInvalidField = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('.institutional-form [aria-invalid="true"]')?.focus())

export function EmployeeList() {
  const [search, setSearchParams] = useSearchParams()
  const number = Number(search.get('page') || 1)
  const [page, setPage] = useState<Page<Employee> | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [term, setTerm] = useState(search.get('busca') ?? '')
  const busca = search.get('busca') ?? ''
  const key = `${number}:${busca}:${attempt}`
  const loading = loadedKey !== key
  useEffect(() => { let active = true; listEmployees(Number.isInteger(number) && number > 0 ? number : 1, busca || undefined).then(result => { if (active) { setPage(result); setError(''); setLoadedKey(key) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoadedKey(key) } }); return () => { active = false } }, [number, busca, attempt, key])
  function submitSearch(event: FormEvent) { event.preventDefault(); const next = new URLSearchParams(search); const value = term.trim(); if (value) next.set('busca', value); else next.delete('busca'); next.delete('page'); setSearchParams(next) }
  function pageTo(value: number) { const next = new URLSearchParams(search); next.set('page', String(value)); setSearchParams(next) }
  return <>
    <PageHeading title="Funcionários" description="Voluntários e veterinários vinculados à sua ONG." action={<Link className="button button-primary" to="/ong/funcionarios/novo">Cadastrar funcionário</Link>} />
    <form className="institutional-toolbar institutional-search" role="search" onSubmit={submitSearch}><div><label htmlFor="employee-search">Buscar por nome ou e-mail</label><input id="employee-search" type="search" placeholder="Nome ou e-mail" value={term} onChange={event => setTerm(event.target.value)} minLength={2} maxLength={120} /></div><button className="button button-secondary" type="submit">Buscar</button>{busca && <button type="button" className="institutional-clear" onClick={() => { setTerm(''); const next = new URLSearchParams(search); next.delete('busca'); next.delete('page'); setSearchParams(next) }}>Limpar busca</button>}</form>
    <LoadState loading={loading} error={error} retry={() => setAttempt(n => n + 1)} />
    {!loading && !error && page && (page.data.length ? <><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th scope="col">Funcionário</th><th scope="col">Perfil</th><th scope="col">Conta</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead><tbody>{page.data.map(person => <tr key={person.id}><td data-label="Funcionário"><strong>{person.nome}</strong><small>{person.email}</small></td><td data-label="Perfil">{profileName(person.perfil)}</td><td data-label="Conta"><Status value={person.ativo} /></td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/funcionarios/${person.id}`}>Ver detalhes →</Link></td></tr>)}</tbody></table></div><Pager page={page.meta.current_page} last={page.meta.last_page} total={page.meta.total} onPage={pageTo} /></> : <Empty title={busca ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário cadastrado'}>{busca ? 'Tente outro nome ou e-mail.' : 'Cadastre voluntários e veterinários para acompanhar a equipe da ONG.'}</Empty>)}
  </>
}

export function EmployeeCreate() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [visible, setVisible] = useState(false)
  const [perfil, setPerfil] = useState<Employee['perfil']>('VOLUNTARIO')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (senha !== confirmacao) { setFieldErrors({ confirmacao: ['A confirmação da senha não corresponde.'] }); setError('Confira os campos indicados.'); focusInvalidField(); return }
    if (new TextEncoder().encode(senha).length > 72) { setFieldErrors({ senha: ['A senha deve ter no máximo 72 bytes.'] }); setError('Confira os campos indicados.'); focusInvalidField(); return }
    setBusy(true); setError(''); setFieldErrors({})
    try { const person = await createEmployee({ nome: nome.trim(), email: email.trim(), senha, perfil }); navigate(`/ong/funcionarios/${person.id}`, { replace: true, state: { notice: 'Funcionário cadastrado.' } }) }
    catch (cause) { if (cause instanceof ApiError && cause.errors) { setFieldErrors(cause.errors); setError('Confira os campos indicados.'); focusInvalidField() } else setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  return <><PageHeading title="Cadastrar funcionário" description="Cadastre um voluntário ou veterinário da sua ONG. O vínculo é definido pelo servidor." back="/ong/funcionarios" /><section className="institutional-section institutional-form-panel">{error && <Notice variant="error">{error}</Notice>}<form className="institutional-form" onSubmit={submit}>
    <div className="institutional-field"><label htmlFor="employee-nome">Nome</label><input id="employee-nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={100} autoComplete="name" required aria-invalid={Boolean(fieldErrors.nome)} aria-describedby={fieldErrors.nome ? 'employee-nome-error' : undefined} />{fieldError('employee-nome', fieldErrors.nome?.[0])}</div>
    <div className="institutional-field"><label htmlFor="employee-email">E-mail</label><input id="employee-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={120} autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'employee-email-error' : undefined} />{fieldError('employee-email', fieldErrors.email?.[0])}</div>
    <div className="institutional-field"><label htmlFor="employee-profile">Perfil</label><select id="employee-profile" value={perfil} onChange={e => setPerfil(e.target.value as Employee['perfil'])} aria-invalid={Boolean(fieldErrors.perfil)} aria-describedby={fieldErrors.perfil ? 'employee-profile-error' : undefined}><option value="VOLUNTARIO">Voluntário</option><option value="VETERINARIO">Veterinário</option></select>{fieldError('employee-profile', fieldErrors.perfil?.[0])}</div>
    <div className="institutional-form-grid"><div className="institutional-field"><label htmlFor="employee-password">Senha</label><input id="employee-password" type={visible ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required aria-invalid={Boolean(fieldErrors.senha)} aria-describedby={fieldErrors.senha ? 'employee-password-error' : undefined} />{fieldError('employee-password', fieldErrors.senha?.[0])}</div><div className="institutional-field"><label htmlFor="employee-confirmation">Confirmar senha</label><input id="employee-confirmation" type={visible ? 'text' : 'password'} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required aria-invalid={Boolean(fieldErrors.confirmacao)} aria-describedby={fieldErrors.confirmacao ? 'employee-confirmation-error' : undefined} />{fieldError('employee-confirmation', fieldErrors.confirmacao?.[0])}</div></div>
    <label className="institutional-check"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> Mostrar senhas</label><p className="institutional-help">Use de 8 a 72 caracteres e no máximo 72 bytes. Compartilhe a senha por um canal seguro.</p>
    <div className="institutional-form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Cadastrando…' : 'Cadastrar funcionário'}</button></div>
  </form></section></>
}

export function EmployeeDetails() {
  const id = Number(useParams().id)
  const location = useLocation()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState((location.state as { notice?: string } | null)?.notice ?? '')
  const [attempt, setAttempt] = useState(0)
  const key = `${id}:${attempt}`
  const loading = loadedKey !== key
  useEffect(() => { let active = true; getEmployee(id).then(result => { if (active) { setEmployee(result); setError(''); setLoadedKey(key) } }).catch(cause => { if (active) { setEmployee(null); setError(institutionalError(cause)); setLoadedKey(key) } }); return () => { active = false } }, [id, attempt, key])
  async function toggle() {
    if (!employee || busy) return
    if (!window.confirm(employee.ativo ? 'Desativar esta conta? O funcionário perderá acesso às áreas protegidas.' : 'Ativar esta conta?')) return
    setBusy(true); setError(''); setFeedback('')
    try { const result = await setEmployeeActive(id, !employee.ativo); setEmployee(result); setFeedback(result.ativo ? 'Conta ativada.' : 'Conta desativada.') }
    catch (cause) { setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  return <><PageHeading title={employee?.nome ?? 'Funcionário'} description="Dados da equipe da ONG" back="/ong/funcionarios" /><LoadState loading={loading} error={!employee ? error : ''} retry={() => setAttempt(n => n + 1)} />{!loading && employee && <><div className="institutional-feedback">{error && <Notice variant="error">{error}</Notice>}{feedback && <Notice variant="success">{feedback}</Notice>}</div><section className="institutional-section institutional-employee-detail"><div className="institutional-section-head"><h2>Dados da conta</h2><Status value={employee.ativo} /></div><dl><div><dt>Nome</dt><dd>{employee.nome}</dd></div><div><dt>E-mail</dt><dd>{employee.email}</dd></div><div><dt>Perfil</dt><dd>{profileName(employee.perfil)}</dd></div><div><dt>Identificação</dt><dd>#{employee.id}</dd></div></dl><div className="institutional-detail-actions"><Link className="button button-secondary" to={`/ong/funcionarios/${employee.id}/editar`}>Editar dados</Link><button className={`button ${employee.ativo ? 'button-destructive' : 'button-secondary'}`} type="button" disabled={busy} onClick={() => void toggle()}>{busy ? 'Salvando…' : employee.ativo ? 'Desativar conta' : 'Ativar conta'}</button></div></section></>}</>
}

export function EmployeeEdit() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const [person, setPerson] = useState<Employee | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  useEffect(() => { let active = true; getEmployee(id).then(result => { if (active) { setPerson(result); setNome(result.nome); setEmail(result.email); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [id])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setFieldErrors({})
    try { await updateEmployee(id, { nome: nome.trim(), email: email.trim() }); navigate(`/ong/funcionarios/${id}`, { replace: true, state: { notice: 'Dados cadastrais atualizados.' } }) }
    catch (cause) { if (cause instanceof ApiError && cause.errors) { setFieldErrors(cause.errors); setError('Confira os campos indicados.'); focusInvalidField() } else setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  return <><PageHeading title="Editar funcionário" description={person ? `${profileName(person.perfil)} da sua ONG` : 'Dados cadastrais da equipe'} back={`/ong/funcionarios/${id}`} /><LoadState loading={loading} error={!person ? error : ''} retry={() => window.location.reload()} />{!loading && person && <section className="institutional-section institutional-form-panel">{error && <Notice variant="error">{error}</Notice>}<form className="institutional-form" onSubmit={submit}><div className="institutional-field"><label htmlFor="employee-edit-name">Nome</label><input id="employee-edit-name" value={nome} onChange={event => setNome(event.target.value)} required maxLength={100} autoComplete="name" aria-invalid={Boolean(fieldErrors.nome)} aria-describedby={fieldErrors.nome ? 'employee-edit-name-error' : undefined} />{fieldError('employee-edit-name', fieldErrors.nome?.[0])}</div><div className="institutional-field"><label htmlFor="employee-edit-email">E-mail</label><input id="employee-edit-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={120} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'employee-edit-email-error' : undefined} />{fieldError('employee-edit-email', fieldErrors.email?.[0])}</div><p className="institutional-help">Perfil e vínculo com a ONG permanecem iguais.</p><div className="institutional-form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button></div></form></section>}</>
}
