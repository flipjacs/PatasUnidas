import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { institutionalError, listInventoryAlerts, type InventoryAlertType, type InventoryLot, type InventoryProduct, type Page } from './api'
import { Empty, LoadState, PageHeading, Pager } from './InstitutionalUi'
import { InventoryNav } from './InventoryUi'
import { formatQuantity } from './inventoryFormat'
import { formatFinancialDate } from './financialFormat'
const labels: Record<InventoryAlertType, string> = { BAIXO: 'Estoque baixo', ESGOTADO: 'Produtos esgotados', VENCIDO: 'Lotes vencidos', PROXIMO_VENCIMENTO: 'Próximos do vencimento' }
export function InventoryAlerts() {
  const [search, setSearch] = useSearchParams()
  const raw = search.get('tipo') || 'BAIXO'
  const type: InventoryAlertType = Object.hasOwn(labels, raw) ? raw as InventoryAlertType : 'BAIXO'
  const days = Number(search.get('dias') || 30)
  const [data, setData] = useState<Page<InventoryProduct | InventoryLot> | null>(null)
  const [loaded, setLoaded] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const key = `${search}:${attempt}`
  useEffect(() => { let active = true; const page = Number(search.get('page') || 1); const pending = type === 'BAIXO' || type === 'ESGOTADO' ? listInventoryAlerts(type, page) : listInventoryAlerts(type, page, days); pending.then(value => { if (active) { setData(value); setLoaded(key); setError('') } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoaded(key) } }); return () => { active = false } }, [search, type, days, key])
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); setSearch({ tipo: String(values.get('tipo')), dias: String(values.get('dias') || 30) }) }
  return <><PageHeading title="Alertas de estoque" description="Consulte produtos ativos e lotes com saldo. Os resultados são fornecidos pelo servidor." /><InventoryNav /><form key={`${type}:${days}`} className="institutional-toolbar institutional-filters inventory-filters" onSubmit={submit}><div><label htmlFor="alert-type">Tipo de alerta</label><select id="alert-type" name="tipo" defaultValue={type}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label htmlFor="alert-days">Prazo para próximo vencimento (dias)</label><input id="alert-days" name="dias" type="number" min={1} max={365} defaultValue={days} required /></div><button className="button button-secondary">Consultar alertas</button></form>
    <p className="institutional-help">Estoque baixo: saldo positivo até o mínimo. Esgotados incluem produtos novos sem movimentação. O prazo é usado apenas para próximos vencimentos. As quantidades dos lotes seguem a unidade cadastrada no produto.</p>
    <LoadState loading={loaded !== key} error={error} retry={() => setAttempt(n => n + 1)} />{loaded === key && !error && data && <>{data.data.length ? <><p className="institutional-help">{data.meta.total} {data.meta.total === 1 ? 'resultado' : 'resultados'} para {labels[type].toLowerCase()}.</p><div className="institutional-table-wrap inventory-table"><table className="institutional-table"><thead><tr><th scope="col">Produto</th><th scope="col">Situação</th><th scope="col">Quantidade</th><th scope="col">Referência</th><th scope="col">Ação</th></tr></thead><tbody>{data.data.map(item => { const isLot = 'produtoId' in item; return <tr key={item.id}><td data-label="Produto"><strong>{isLot ? item.produto?.nome ?? `Produto #${item.produtoId}` : item.nome}</strong>{isLot && <small>Lote {item.codigo}</small>}</td><td data-label="Situação">{labels[type]}{!isLot && !item.possuiMovimentacoes && <small>Sem movimentações registradas</small>}</td><td data-label="Quantidade">{formatQuantity(item.quantidadeDisponivel)}{!isLot ? ` ${item.unidade.sigla}` : ''}</td><td data-label="Referência">{isLot ? `Validade: ${item.validade ? formatFinancialDate(item.validade) : 'não informada'}` : `Mínimo: ${formatQuantity(item.quantidadeMinima)} ${item.unidade.sigla}`}</td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/estoque/${isLot ? item.produtoId : item.id}`}>Ver produto</Link></td></tr> })}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={page => { const next = new URLSearchParams(search); next.set('page', String(page)); setSearch(next) }} /></> : <Empty title="Não há alertas de estoque para os critérios selecionados." />}</>}
  </>
}
