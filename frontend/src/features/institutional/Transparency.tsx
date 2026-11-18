import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice } from '../../shared/components/Ui'
import { useAuth } from '../auth/auth'
import { institutionalError, type Page } from './api'
import { Empty, LoadState, PageHeading, Pager, Status } from './InstitutionalUi'
import { createInternalReport, getInternalReport, listInternalReports, setReportPublished, updateInternalReport, type InternalReport, type ReportInput } from './reportsApi'
import { formatMoney, formatFinancialDate } from './financialFormat'
import './reports.css'

export function ReportSnapshot({ report }: { report: Pick<InternalReport, 'dados'> }) {
  const data = report.dados
  return <><dl className="report-metrics"><div><dt>Receitas recebidas</dt><dd>{formatMoney(data.receitasRealizadas)}</dd></div><div><dt>Despesas pagas</dt><dd>{formatMoney(data.despesasRealizadas)}</dd></div><div><dt>Resultado líquido</dt><dd>{formatMoney(data.resultadoLiquido)}</dd></div><div><dt>Movimentações realizadas</dt><dd>{data.quantidadeMovimentacoes}</dd></div></dl><div className="report-category-grid"><div><h3>Receitas por categoria</h3>{Object.entries(data.receitasPorCategoria).length ? <ul>{Object.entries(data.receitasPorCategoria).map(([category, value]) => <li key={category}><span>{category.replaceAll('_', ' ')}</span><strong>{formatMoney(value)}</strong></li>)}</ul> : <p>Sem receitas no período.</p>}</div><div><h3>Despesas por categoria</h3>{Object.entries(data.despesasPorCategoria).length ? <ul>{Object.entries(data.despesasPorCategoria).map(([category, value]) => <li key={category}><span>{category.replaceAll('_', ' ')}</span><strong>{formatMoney(value)}</strong></li>)}</ul> : <p>Sem despesas no período.</p>}</div></div></>
}

function ReportForm({ initial, busy, error, onSave }: { initial: ReportInput; busy: boolean; error: unknown; onSave: (input: ReportInput) => Promise<void> }) {
  const [value, setValue] = useState(initial)
  const errors = error instanceof ApiError ? error.errors ?? {} : {}
  return <form className="institutional-form" onSubmit={(event: FormEvent) => { event.preventDefault(); if (!busy) void onSave(value) }}>{error != null && Object.keys(errors).length === 0 && <Notice variant="error">{institutionalError(error)}</Notice>}<div className="institutional-form-grid">
    <div className="institutional-field"><label htmlFor="report-title">Título</label><input id="report-title" required maxLength={120} value={value.titulo} aria-invalid={!!errors.titulo} onChange={e => setValue(current => ({ ...current, titulo: e.target.value }))} />{errors.titulo && <small className="platform-field-error">{errors.titulo.join(' ')}</small>}</div>
    <div className="institutional-field"><label htmlFor="report-description">Descrição (opcional)</label><textarea id="report-description" rows={3} maxLength={2000} value={value.descricao || ''} aria-invalid={!!errors.descricao} onChange={e => setValue(current => ({ ...current, descricao: e.target.value || null }))} />{errors.descricao && <small className="institutional-field-error">{errors.descricao.join(' ')}</small>}</div>
    <div className="institutional-field"><label htmlFor="report-start">Início do período</label><input id="report-start" type="date" required value={value.periodoInicio} aria-invalid={!!errors.periodoInicio} onChange={e => setValue(current => ({ ...current, periodoInicio: e.target.value }))} />{errors.periodoInicio && <small className="institutional-field-error">{errors.periodoInicio.join(' ')}</small>}</div>
    <div className="institutional-field"><label htmlFor="report-end">Fim do período</label><input id="report-end" type="date" required min={value.periodoInicio || undefined} value={value.periodoFim} aria-invalid={!!errors.periodoFim} onChange={e => setValue(current => ({ ...current, periodoFim: e.target.value }))} />{errors.periodoFim && <small className="institutional-field-error">{errors.periodoFim.join(' ')}</small>}</div>
  </div><div className="institutional-form-actions"><button className="button button-primary" disabled={busy || !!(value.periodoInicio && value.periodoFim && value.periodoFim < value.periodoInicio)}>{busy ? 'Salvando…' : initial.titulo ? 'Salvar demonstrativo' : 'Criar rascunho'}</button></div></form>
}

export function TransparencyList() {
  const { user } = useAuth()
  const [search, setSearch] = useSearchParams()
  const [data, setData] = useState<Page<InternalReport> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const key = search.toString()
  useEffect(() => { let active = true; listInternalReports({ page: search.get('page') || 1, status: search.get('status') || undefined }).then(result => { if (active) { setData(result); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [key, attempt, search])
  function filter(value: string) { const next = new URLSearchParams(); if (value) next.set('status', value); setLoading(true); setSearch(next) }
  return <><PageHeading title="Transparência" description="Demonstrativos consolidados da sua ONG. Somente os publicados ficam disponíveis ao público." action={user?.perfil === 'ADMINISTRADOR' ? <Link className="button button-primary" to="/ong/transparencia/novo">Criar demonstrativo</Link> : undefined} />
    <div className="institutional-toolbar institutional-filters"><div><label htmlFor="transparency-status">Situação</label><select id="transparency-status" value={search.get('status') || ''} onChange={e => filter(e.target.value)}><option value="">Todos</option><option value="RASCUNHO">Rascunho</option><option value="PUBLICADO">Publicado</option></select></div></div>
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(n => n + 1) }} />
    {!loading && !error && data && (data.data.length ? <><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Demonstrativo</th><th>Período</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{data.data.map(item => <tr key={item.id}><td data-label="Demonstrativo"><strong>{item.titulo}</strong><small>#{item.id}</small></td><td data-label="Período">{formatFinancialDate(item.periodoInicio)} a {formatFinancialDate(item.periodoFim)}</td><td data-label="Situação"><Status value={item.status} /></td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/transparencia/${item.id}`}>Ver demonstrativo</Link></td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={page => { const next = new URLSearchParams(search); next.set('page', String(page)); setLoading(true); setSearch(next) }} /></> : <Empty title="Nenhum demonstrativo encontrado">{user?.perfil === 'ADMINISTRADOR' ? 'Crie um rascunho para revisar os totais antes da publicação.' : 'Não há demonstrativos neste filtro.'}</Empty>)}
  </>
}

export function TransparencyCreate() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function save(value: ReportInput) { setBusy(true); setError(null); try { const result = await createInternalReport(value); navigate(`/ong/transparencia/${result.id}`) } catch (cause) { setError(cause) } finally { setBusy(false) } }
  return <><PageHeading title="Criar demonstrativo" description="O rascunho usa dados consolidados do período. A publicação atualiza o retrato financeiro antes de torná-lo público." back="/ong/transparencia" /><section className="institutional-section institutional-form-panel"><ReportForm initial={{ titulo: '', descricao: null, periodoInicio: '', periodoFim: '' }} busy={busy} error={error} onSave={save} /></section></>
}

export function TransparencyDetails() {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const admin = user?.perfil === 'ADMINISTRADOR'
  const [item, setItem] = useState<InternalReport | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { let active = true; getInternalReport(id).then(result => { if (active) { setItem(result); setError(null) } }).catch(cause => { if (active) setError(cause) }); return () => { active = false } }, [id, attempt])
  async function save(value: ReportInput) { setBusy(true); setError(null); setMessage(''); try { setItem(await updateInternalReport(id, value)); setMessage('Rascunho atualizado.') } catch (cause) { setError(cause) } finally { setBusy(false) } }
  async function change() { if (!item || busy) return; setBusy(true); setError(null); setMessage(''); try { const publish = item.status === 'RASCUNHO'; setItem(await setReportPublished(id, publish)); setMessage(publish ? 'Demonstrativo publicado com os dados consolidados atuais do período.' : 'Demonstrativo despublicado. O histórico permanece registrado.'); setConfirm(false) } catch (cause) { setError(cause); setConfirm(false); getInternalReport(id).then(setItem).catch(() => undefined) } finally { setBusy(false) } }
  return <><PageHeading title={item?.titulo || 'Demonstrativo'} back="/ong/transparencia" />{!item && !error && <LoadState loading error="" retry={() => undefined} />}{error && <div className="institutional-error"><Notice variant="error">{institutionalError(error)}</Notice><button className="button button-secondary" onClick={() => setAttempt(n => n + 1)}>Atualizar dados</button></div>}{message && <Notice variant="success">{message}</Notice>}
    {item && <><section className="institutional-section"><div className="institutional-section-head"><h2>Dados consolidados</h2><Status value={item.status} /></div><p>{item.descricao}</p><p className="institutional-period-note">Período: {formatFinancialDate(item.periodoInicio)} a {formatFinancialDate(item.periodoFim)}. {item.publicadoEm ? `Publicado em ${formatFinancialDate(item.publicadoEm)}.` : 'Ainda não publicado.'}</p><ReportSnapshot report={item} /></section>
      {item.status === 'PUBLICADO' && <p className="institutional-period-note"><Link to={`/transparencia/${item.ong.id}/${item.id}`}>Abrir visualização pública</Link></p>}
      {admin && <section className="institutional-section"><h2>{item.status === 'RASCUNHO' ? 'Revisar e publicar' : 'Despublicar demonstrativo'}</h2><p className="institutional-help">{item.status === 'RASCUNHO' ? 'Ao publicar, o servidor atualiza o retrato financeiro do período e o torna público.' : 'A despublicação retira o acesso público sem apagar o registro.'}</p>{confirm ? <div className="platform-confirm"><p>Confirma {item.status === 'RASCUNHO' ? 'a publicação' : 'a despublicação'}?</p><button className="button button-primary" disabled={busy} onClick={change}>{busy ? 'Aguarde…' : item.status === 'RASCUNHO' ? 'Confirmar publicação' : 'Confirmar despublicação'}</button><button className="button button-secondary" disabled={busy} onClick={() => setConfirm(false)}>Voltar</button></div> : <button className="button button-secondary" disabled={busy} onClick={() => setConfirm(true)}>{item.status === 'RASCUNHO' ? 'Publicar demonstrativo' : 'Despublicar demonstrativo'}</button>}</section>}
      {admin && item.status === 'RASCUNHO' && <section className="institutional-section institutional-form-panel"><h2>Editar rascunho</h2><ReportForm key={item.updatedAt} initial={{ titulo: item.titulo, descricao: item.descricao, periodoInicio: item.periodoInicio, periodoFim: item.periodoFim }} busy={busy} error={error instanceof ApiError && error.errors ? error : null} onSave={save} /></section>}
    </>}
  </>
}
