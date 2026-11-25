import { useEffect, useState } from 'react'
import { institutionalError, listInventoryLots, type InventoryLot, type Page } from './api'
import { Empty, LoadState, Pager } from './InstitutionalUi'
import { lotValidity, formatQuantity } from './inventoryFormat'
import { formatFinancialDate } from './financialFormat'


export function InventoryLots({ productId, unit }: { productId: number; unit: string }) {
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<Page<InventoryLot> | null>(null)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState('')
  const key = `${productId}:${page}:${attempt}`
  useEffect(() => { let active = true; listInventoryLots(productId, page).then(value => { if (active) { setData(value); setError(''); setLoaded(key) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoaded(key) } }); return () => { active = false } }, [productId, page, key])
  return <section className="institutional-section"><h2>Lotes do produto</h2><LoadState loading={loaded !== key} error={error} retry={() => setAttempt(n => n + 1)} />{loaded === key && !error && data && (data.data.length ? <><div className="institutional-table-wrap inventory-table"><table className="institutional-table"><thead><tr><th scope="col">Lote</th><th scope="col">Validade</th><th scope="col">Disponível</th><th scope="col">Situação</th></tr></thead><tbody>{data.data.map(lot => <tr key={lot.id}><td data-label="Lote"><strong>{lot.codigo}</strong><small>#{lot.id}</small></td><td data-label="Validade">{lot.validade ? formatFinancialDate(lot.validade) : 'Não informada'}</td><td data-label="Disponível">{formatQuantity(lot.quantidadeDisponivel)} {unit}</td><td data-label="Situação">{lotValidity(lot)}</td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={setPage} /></> : <Empty title="Nenhum lote registrado">Entradas sem lote permanecem identificadas separadamente no saldo do produto.</Empty>)}</section>
}
