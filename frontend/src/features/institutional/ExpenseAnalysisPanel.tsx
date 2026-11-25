import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { Notice } from '../../shared/components/Ui'
import { institutionalError, loadExpenseAnalysis, type ExpenseAnalysis } from './api'
import { Empty, LoadState, PageHeading } from './InstitutionalUi'
import { formatFinancialDate as date, formatMoney as money } from './financialFormat'
import { ExpenseCharts } from './ExpenseCharts'
import './expenseAnalysis.css'

const temporalLabels = { confirmado_em: 'data de confirmação do pagamento', created_at: 'data do cadastro', aprovado_em: 'data da aprovação' }

function civilDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const instant = Date.UTC(year, month - 1, day)
  const parsed = new Date(instant)
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? instant / 86400000 : null
}

export function ExpenseAnalysisPanel() {
  const { user } = useAuth()
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [applied, setApplied] = useState<{ de?: string; ate?: string }>({})
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<ExpenseAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const allowed = user?.perfil === 'ADMINISTRADOR'
  useEffect(() => {
    if (!allowed) return
    let active = true
    loadExpenseAnalysis(applied).then(result => {
      if (active) { setData(result); setLoading(false); setError('') }
    }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } })
    return () => { active = false }
  }, [applied, attempt, allowed])

  function apply(event: FormEvent) {
    event.preventDefault()
    const today = new Date()
    const start = de || `${today.getFullYear()}-01-01`
    const end = ate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const first = civilDay(start), last = civilDay(end)
    if (first === null || last === null) { setValidation('Informe datas válidas.'); return }
    if (first > last) { setValidation('A data inicial deve ser anterior ou igual à data final.'); return }
    if (last - first > 1095) { setValidation('Selecione um período de até 1.095 dias.'); return }
    setValidation(''); setLoading(true); setError(''); setApplied({ de: de || undefined, ate: ate || undefined })
  }

  if (!allowed) return <Notice variant="error">A análise de despesas é restrita ao administrador da ONG.</Notice>
  return <>
    <PageHeading title="Análise de despesas" description="Pagamentos realizados, distribuição por categoria e evolução mensal da sua ONG." back="/ong/financeiro" />
    <form className="institutional-toolbar expense-period" aria-label="Período da análise" onSubmit={apply} noValidate>
      <div className="institutional-field"><label htmlFor="analysis-from">Data inicial</label><input id="analysis-from" type="date" value={de} onChange={event => setDe(event.target.value)} aria-invalid={!!validation} aria-describedby="analysis-period-help" /></div>
      <div className="institutional-field"><label htmlFor="analysis-to">Data final</label><input id="analysis-to" type="date" value={ate} onChange={event => setAte(event.target.value)} aria-invalid={!!validation} aria-describedby="analysis-period-help" /></div>
      <button className="button button-primary" type="submit">Aplicar período</button>
      <button className="button button-text" type="button" onClick={() => { setDe(''); setAte(''); setValidation(''); setLoading(true); setError(''); setApplied({}) }}>Restaurar período padrão</button>
      <p id="analysis-period-help">Datas inclusivas, até 1.095 dias. Sem filtro, o período vai de janeiro até hoje.</p>
      {validation && <p className="institutional-field-error" role="alert">{validation}</p>}
    </form>
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setError(''); setAttempt(value => value + 1) }} />
    {!loading && !error && data && <section className="expense-analysis" aria-label="Resultado da análise">
      <p className="expense-period-result">Período analisado: <strong>{date(data.periodo.de)} a {date(data.periodo.ate)}</strong></p>
      <dl className="expense-indicators">
        <div className="expense-indicator-paid"><dt>Total pago</dt><dd>{money(data.indicadores.totalPago)}</dd><small>{data.indicadores.quantidadePago} despesas pagas</small></div>
        <div><dt>Despesas pendentes</dt><dd>{money(data.indicadores.totalPendente)}</dd><small>{data.indicadores.quantidadePendente} pendências</small></div>
        <div><dt>Aprovadas, ainda não pagas</dt><dd>{money(data.indicadores.totalAprovado)}</dd><small>{data.indicadores.quantidadeAprovado} despesas aprovadas</small></div>
      </dl>
      <dl className="expense-secondary-indicators"><div><dt>Maior gasto pago</dt><dd>{data.indicadores.categoriaMaiorGasto?.nome ?? 'Sem pagamentos no período'}</dd>{data.indicadores.categoriaMaiorGasto && <small>{money(data.indicadores.categoriaMaiorGasto.totalPago)}</small>}</div><div><dt>Pago sem categoria estruturada</dt><dd>{money(data.indicadores.totalPagoSemCategoria)}</dd><small>Preserva as despesas antigas sem classificação.</small></div></dl>
      {data.indicadores.quantidadeDespesas === 0 ? <Empty title="Nenhuma despesa neste período">Selecione outro período para consultar pagamentos, pendências e aprovações.</Empty> : <ExpenseCharts key={`${data.periodo.de}-${data.periodo.ate}-${attempt}`} data={data} />}
      <details className="expense-criteria"><summary>Como interpretar os valores e as datas</summary><p>Os valores representam o estado atual de cada despesa. Receitas e despesas canceladas não entram nesta análise.</p><ul><li>Pagas: {temporalLabels[data.criteriosTemporais.pago]}.</li><li>Pendentes: {temporalLabels[data.criteriosTemporais.pendente]}.</li><li>Aprovadas, ainda não pagas: {temporalLabels[data.criteriosTemporais.aprovado]}.</li></ul><p>As séries usam datas diferentes e não são cumulativas. Meses nas extremidades incluem somente os dias selecionados. Categorias inativas permanecem no histórico; Não categorizado é separado de Outros.</p></details>
    </section>}
  </>
}
