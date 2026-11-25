import { useState } from 'react'
import type { ExpenseAnalysis } from './api'
import { formatMoney as money } from './financialFormat'
import { Empty } from './InstitutionalUi'

const series = [
  { key: 'totalPago', label: 'Pagas', className: 'expense-series-paid', dash: undefined },
  { key: 'totalPendente', label: 'Pendentes', className: 'expense-series-pending', dash: '7 5' },
  { key: 'totalAprovado', label: 'Aprovadas, não pagas', className: 'expense-series-approved', dash: '2 5' },
] as const
const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function monthLabel(value: string): string {
  const [year, month] = value.split('-')
  return `${monthNames[Number(month) - 1]}/${year}`
}

export function ExpenseCharts({ data }: { data: ExpenseAnalysis }) {
  const [selected, setSelected] = useState(data.meses.length - 1)
  // Numeric conversion only controls chart geometry. All financial labels use the API strings.
  const categoryMax = Math.max(1, ...data.categorias.map(item => Number(item.totalPago)))
  const max = Math.max(1, ...data.meses.flatMap(item => series.map(s => Number(item[s.key]))))
  const x = (index: number) => data.meses.length === 1 ? 380 : 80 + index * 600 / (data.meses.length - 1)
  const y = (value: string) => 235 - Number(value) / max * 190
  const month = data.meses[selected]
  return <div className="expense-charts">
    <section className="institutional-section expense-chart-section" aria-labelledby="expense-distribution-title">
      <h2 id="expense-distribution-title">Pagamentos por categoria</h2><p className="institutional-help">Somente despesas efetivamente pagas no período.</p>
      {data.categorias.length === 0 ? <Empty title="Sem pagamentos no período">Pendências e aprovações aparecem na evolução mensal.</Empty> : <ul className="expense-category-bars">{data.categorias.map(item => <li key={item.categoriaId ?? 'uncategorized'}><button type="button" className="expense-category-bar" aria-label={`${item.nome}: ${money(item.totalPago)}, ${item.quantidade} despesas pagas${item.ativo === false ? ', categoria inativa' : ''}`}><span className="expense-category-bar-heading"><strong>{item.nome}{item.ativo === false && <small>Inativa</small>}</strong><span>{money(item.totalPago)}</span></span><span className="expense-bar-track" aria-hidden="true"><span style={{ width: `${Number(item.totalPago) / categoryMax * 100}%` }} /></span><span role="tooltip" className="expense-category-tooltip">{item.quantidade} despesas pagas · {money(item.totalPago)}</span></button></li>)}</ul>}
    </section>
    <section className="institutional-section expense-chart-section" aria-labelledby="expense-monthly-title">
      <h2 id="expense-monthly-title">Evolução mensal</h2><p className="institutional-help">Selecione um mês no gráfico ou na lista para consultar os valores.</p>
      <ul className="expense-chart-legend">{series.map(s => <li key={s.key}><span className={s.className} aria-hidden="true">{s.dash === undefined ? '━━' : s.key === 'totalPendente' ? '┄┄' : '···'}</span>{s.label}</li>)}</ul>
      <p className="expense-chart-scroll-help">Em telas pequenas, deslize o gráfico para ver todos os meses ou consulte a tabela abaixo.</p>
      <div className="expense-line-chart" tabIndex={0} role="region" aria-label="Gráfico mensal com rolagem horizontal">
        <svg viewBox="0 0 720 275" aria-label="Evolução mensal de despesas, valores em reais" role="group">
          <title>Evolução mensal das despesas</title>
          {[0, .5, 1].map(fraction => <g key={fraction} className="expense-grid"><line x1="80" x2="680" y1={235 - fraction * 190} y2={235 - fraction * 190} /><text x="70" y={239 - fraction * 190} textAnchor="end">{new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(max * fraction)}</text></g>)}
          {series.map(s => <g key={s.key} className={s.className}><polyline points={data.meses.map((item, index) => `${x(index)},${y(item[s.key])}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={s.key === 'totalPago' ? 3 : 2} strokeDasharray={s.dash} />{data.meses.map((item, index) => <circle key={item.competencia} cx={x(index)} cy={y(item[s.key])} r="3.5" fill="var(--paper)" stroke="currentColor" strokeWidth="2" />)}</g>)}
          {data.meses.map((item, index) => <g key={item.competencia}>{(index % Math.max(1, Math.ceil(data.meses.length / 5)) === 0 || index === data.meses.length - 1) && <text className="expense-month-label" x={x(index)} y="263" textAnchor="middle">{monthLabel(item.competencia)}</text>}<rect x={x(index) - Math.min(22, 280 / data.meses.length)} y="32" width={Math.min(44, 560 / data.meses.length)} height="210" fill="transparent" tabIndex={0} role="button" aria-label={`${monthLabel(item.competencia)}: pagas ${money(item.totalPago)}, pendentes ${money(item.totalPendente)}, aprovadas ${money(item.totalAprovado)}`} onFocus={() => setSelected(index)} onMouseEnter={() => setSelected(index)} onClick={() => setSelected(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index) } }}><title>{monthLabel(item.competencia)} · Pagas {money(item.totalPago)} · Pendentes {money(item.totalPendente)} · Aprovadas {money(item.totalAprovado)}</title></rect></g>)}
        </svg>
      </div>
      <div className="expense-month-detail"><div className="institutional-field"><label htmlFor="expense-selected-month">Consultar competência</label><select id="expense-selected-month" value={selected} onChange={event => setSelected(Number(event.target.value))}>{data.meses.map((item, index) => <option key={item.competencia} value={index}>{monthLabel(item.competencia)}</option>)}</select></div>{month && <dl aria-live="polite">{series.map(s => <div key={s.key}><dt>{s.label}</dt><dd>{money(month[s.key])}</dd></div>)}</dl>}</div>
      <details className="expense-data-table"><summary>Ver todos os valores mensais em tabela</summary><div className="institutional-table-wrap"><table className="institutional-table"><caption>Despesas por competência e situação financeira</caption><thead><tr><th scope="col">Competência</th><th scope="col">Pagas</th><th scope="col">Pendentes</th><th scope="col">Aprovadas, não pagas</th></tr></thead><tbody>{data.meses.map(item => <tr key={item.competencia}><th scope="row" data-label="Competência">{monthLabel(item.competencia)}</th>{series.map(s => <td key={s.key} data-label={s.label}>{money(item[s.key])}</td>)}</tr>)}</tbody></table></div></details>
    </section>
  </div>
}
