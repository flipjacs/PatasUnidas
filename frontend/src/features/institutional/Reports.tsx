import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/auth'
import { Notice } from '../../shared/components/Ui'
import { institutionalError, loadDashboard, type Dashboard } from './api'
import { LoadState, PageHeading } from './InstitutionalUi'
import { getFinancialReport, type FinancialReport } from './reportsApi'
import { formatMoney, formatFinancialDate } from './financialFormat'
import './reports.css'

function CategoryTable({ title, values }: { title: string; values: Record<string, string> }) {
  const entries = Object.entries(values)
  return <section className="institutional-section"><h2>{title}</h2>{entries.length ? <div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Categoria</th><th>Valor realizado</th></tr></thead><tbody>{entries.map(([name, amount]) => <tr key={name}><td data-label="Categoria">{name.replaceAll('_', ' ')}</td><td data-label="Valor realizado" className="finance-money">{formatMoney(amount)}</td></tr>)}</tbody></table></div> : <p className="institutional-period-note">Nenhuma movimentação realizada neste período.</p>}</section>
}

export function Reports() {
  const { user } = useAuth()
  const admin = user?.perfil === 'ADMINISTRADOR'
  const [search, setSearch] = useSearchParams()
  const de = search.get('de') || ''
  const ate = search.get('ate') || ''
  const [draftDe, setDraftDe] = useState(de)
  const [draftAte, setDraftAte] = useState(ate)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [financial, setFinancial] = useState<FinancialReport | null>(null)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; Promise.all([loadDashboard(de || undefined, ate || undefined), admin ? getFinancialReport(de || undefined, ate || undefined) : Promise.resolve(null)]).then(([operational, finance]) => { if (active) { setDashboard(operational); setFinancial(finance); setError(''); setLoading(false) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [de, ate, admin, attempt])
  function apply(event: FormEvent) { event.preventDefault(); if (draftDe && draftAte && draftDe > draftAte) { setValidation('A data final deve ser igual ou posterior à inicial.'); return }; setValidation(''); const next = new URLSearchParams(); if (draftDe) next.set('de', draftDe); if (draftAte) next.set('ate', draftAte); setLoading(true); setSearch(next) }
  return <><PageHeading title="Relatórios da ONG" description="Indicadores operacionais e, para administradores, demonstrativo financeiro do período." action={admin ? <Link className="button button-secondary" to="/ong/transparencia">Gerir transparência</Link> : undefined} />
    <form className="institutional-toolbar institutional-period" onSubmit={apply}><div><label htmlFor="report-from">De</label><input id="report-from" type="date" value={draftDe} onChange={e => setDraftDe(e.target.value)} /></div><div><label htmlFor="report-to">Até</label><input id="report-to" type="date" min={draftDe || undefined} value={draftAte} onChange={e => setDraftAte(e.target.value)} /></div><button className="button button-secondary">Aplicar período</button>{(de || ate) && <button className="institutional-clear" type="button" onClick={() => { setDraftDe(''); setDraftAte(''); setLoading(true); setSearch(new URLSearchParams()) }}>Limpar</button>}</form>
    {validation && <Notice variant="error">{validation}</Notice>}
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(n => n + 1) }} />
    {!loading && !error && dashboard && <><section className="institutional-section"><h2>Operação institucional</h2><dl className="report-metrics"><div><dt>Animais cadastrados</dt><dd>{dashboard.animais.total}</dd></div><div><dt>Disponíveis</dt><dd>{dashboard.animais.disponiveis}</dd></div><div><dt>Publicados</dt><dd>{dashboard.animais.publicados}</dd></div><div><dt>Registros clínicos</dt><dd>{dashboard.clinico.totalRegistros}</dd></div>{dashboard.adocoes && <div><dt>Adoções concluídas</dt><dd>{dashboard.adocoes.concluidas}</dd></div>}{dashboard.apadrinhamentos && <div><dt>Apadrinhamentos ativos</dt><dd>{dashboard.apadrinhamentos.ativos}</dd></div>}</dl><p className="institutional-period-note">{dashboard.semanticaPeriodo}</p></section>
      {admin && financial && <><section className="institutional-section"><h2>Resultado financeiro</h2><dl className="report-metrics"><div><dt>Receitas recebidas</dt><dd>{formatMoney(financial.receitasRealizadas)}</dd></div><div><dt>Despesas pagas</dt><dd>{formatMoney(financial.despesasRealizadas)}</dd></div><div><dt>Resultado realizado</dt><dd>{formatMoney(financial.saldoRealizado)}</dd></div><div><dt>Receitas pendentes</dt><dd>{formatMoney(financial.receitasPendentes)}</dd></div><div><dt>Despesas pendentes</dt><dd>{formatMoney(financial.despesasPendentes)}</dd></div><div><dt>Despesas aprovadas</dt><dd>{formatMoney(financial.despesasAprovadas)}</dd></div><div><dt>Movimentações cadastradas</dt><dd>{financial.quantidadeMovimentacoes}</dd></div></dl><p className="institutional-period-note">{financial.semanticaPeriodo}</p></section><div className="report-category-grid"><CategoryTable title="Receitas por categoria" values={financial.receitasPorCategoria} /><CategoryTable title="Despesas por categoria" values={financial.despesasPorCategoria} /></div></>}
      {(de || ate) && <p className="institutional-period-note">Período selecionado: {de ? formatFinancialDate(de) : 'início aberto'} a {ate ? formatFinancialDate(ate) : 'fim aberto'}.</p>}
    </>}
  </>
}
