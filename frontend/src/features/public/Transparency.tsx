import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { BottomNav, Header, Notice } from '../../shared/components/Ui'
import { Empty, LoadState, Pager } from '../institutional/InstitutionalUi'
import { formatFinancialDate, formatMoney } from '../institutional/financialFormat'
import { getPublicReport, listPublicReports, type PublicReport } from '../institutional/reportsApi'
import '../institutional/reports.css'

function publicError(cause: unknown) { if (cause instanceof ApiError && cause.status === 404) return 'Esta ONG ou demonstrativo não está disponível para consulta pública.'; if (cause instanceof ApiError && cause.status === 0) return cause.message; return 'Não foi possível consultar a transparência agora.' }
function PublicShell({ children }: { children: React.ReactNode }) { return <div className="app-shell"><Header /><main className="page-content public-reports" id="conteudo">{children}</main><BottomNav /></div> }

export function PublicTransparencyHome() {
  const [id, setId] = useState('')
  const navigate = useNavigate()
  function open(event: FormEvent) { event.preventDefault(); const parsed = Number(id); if (Number.isSafeInteger(parsed) && parsed > 0) navigate(`/transparencia/${parsed}`) }
  return <PublicShell><div className="public-reports-intro"><p className="section-label">Prestação de contas</p><h1>Transparência das ONGs</h1><p>Consulte os demonstrativos que uma organização decidiu publicar. Os valores representam o período indicado em cada documento.</p></div><section className="institutional-section public-reports-lookup"><h2>Consultar uma organização</h2><p>Use o identificador da ONG, disponível no link de transparência de seus animais.</p><form onSubmit={open}><label htmlFor="public-ong-id">Identificador da ONG</label><div><input id="public-ong-id" inputMode="numeric" type="number" min="1" step="1" required value={id} onChange={e => setId(e.target.value)} /><button className="button button-primary">Consultar demonstrativos</button></div></form><p><Link to="/animais">Encontrar uma ONG no catálogo de animais</Link></p></section></PublicShell>
}

export function PublicTransparencyList() {
  const ongId = Number(useParams().ongId)
  const validOng = Number.isSafeInteger(ongId) && ongId > 0
  const [search, setSearch] = useSearchParams()
  const requested = Number(search.get('page') || 1)
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1
  const [result, setResult] = useState<Awaited<ReturnType<typeof listPublicReports>> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { if (!validOng) return; let active = true; listPublicReports(ongId, page).then(value => { if (active) { setResult(value); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(publicError(cause)); setLoading(false) } }); return () => { active = false } }, [ongId, validOng, page, attempt])
  return <PublicShell><div className="public-reports-intro"><Link to="/transparencia" className="institutional-back">← Transparência</Link><p className="section-label">Dados públicos</p><h1>{result?.data[0]?.ong.nome || `Demonstrativos da ONG #${ongId}`}</h1><p>Somente demonstrativos publicados por uma ONG ativa aparecem nesta página.</p></div>{!validOng ? <Notice variant="error">Identificador de ONG inválido.</Notice> : <><LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(n => n + 1) }} />{!loading && !error && result && (result.data.length ? <><div className="public-report-list">{result.data.map(item => <article className="institutional-section" key={item.id}><p className="section-label">{formatFinancialDate(item.periodoInicio)} a {formatFinancialDate(item.periodoFim)}</p><h2><Link to={`/transparencia/${ongId}/${item.id}`}>{item.titulo}</Link></h2>{item.descricao && <p>{item.descricao}</p>}<p>Resultado líquido: <strong>{formatMoney(item.dados.resultadoLiquido)}</strong></p><Link className="institutional-row-link" to={`/transparencia/${ongId}/${item.id}`}>Consultar demonstrativo</Link></article>)}</div><Pager page={result.meta.current_page} last={result.meta.last_page} total={result.meta.total} onPage={next => { setLoading(true); setSearch({ page: String(next) }) }} /></> : <Empty title="Nenhum demonstrativo publicado">Esta ONG ainda não possui demonstrativos disponíveis ao público.</Empty>)}</>}</PublicShell>
}

export function PublicTransparencyDetails() {
  const ongId = Number(useParams().ongId)
  const id = Number(useParams().id)
  const validId = [ongId, id].every(value => Number.isSafeInteger(value) && value > 0)
  const [report, setReport] = useState<PublicReport | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { if (!validId) return; let active = true; getPublicReport(ongId, id).then(value => { if (active) { setReport(value); setError(''); setLoading(false) } }).catch(cause => { if (active) { setReport(null); setError(publicError(cause)); setLoading(false) } }); return () => { active = false } }, [ongId, id, validId, attempt])
  return <PublicShell><div className="public-reports-intro"><Link to={`/transparencia/${ongId}`} className="institutional-back">← Demonstrativos da ONG</Link><p className="section-label">Demonstrativo público</p><h1>{report?.titulo || 'Demonstrativo'}</h1>{report && <p>{report.ong.nome} · {formatFinancialDate(report.periodoInicio)} a {formatFinancialDate(report.periodoFim)}</p>}</div>{!validId ? <Notice variant="error">Identificador inválido.</Notice> : <><LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(n => n + 1) }} />{!loading && report && <section className="institutional-section">{report.descricao && <p>{report.descricao}</p>}<p className="institutional-period-note">Publicado em {formatFinancialDate(report.publicadoEm)}. Os valores abaixo são o retrato consolidado do período no momento da publicação.</p><dl className="report-metrics"><div><dt>Receitas realizadas</dt><dd>{formatMoney(report.dados.receitasRealizadas)}</dd></div><div><dt>Despesas realizadas</dt><dd>{formatMoney(report.dados.despesasRealizadas)}</dd></div><div><dt>Resultado líquido</dt><dd>{formatMoney(report.dados.resultadoLiquido)}</dd></div><div><dt>Movimentações realizadas</dt><dd>{report.dados.quantidadeMovimentacoes}</dd></div></dl><div className="report-category-grid"><div><h2>Receitas por categoria</h2>{Object.keys(report.dados.receitasPorCategoria).length ? <ul>{Object.entries(report.dados.receitasPorCategoria).map(([key, value]) => <li key={key}>{key.replaceAll('_', ' ')}: <strong>{formatMoney(value)}</strong></li>)}</ul> : <p>Sem receitas no período.</p>}</div><div><h2>Despesas por categoria</h2>{Object.keys(report.dados.despesasPorCategoria).length ? <ul>{Object.entries(report.dados.despesasPorCategoria).map(([key, value]) => <li key={key}>{key.replaceAll('_', ' ')}: <strong>{formatMoney(value)}</strong></li>)}</ul> : <p>Sem despesas no período.</p>}</div></div></section>}{!loading && !error && !report && <Notice variant="error">Demonstrativo indisponível.</Notice>}</>}</PublicShell>
}
