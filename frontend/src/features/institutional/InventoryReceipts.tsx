import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/auth'
import { institutionalError, listInventoryMovements, type InventoryMovement, type Page } from './api'
import { Empty, LoadState, Pager } from './InstitutionalUi'
import { formatQuantity } from './inventoryFormat'
import { formatFinancialDate } from './financialFormat'
import './inventory.css'

export function InventoryReceipts({ expenseId }: { expenseId: number }) {
  const { user } = useAuth()
  const allowed = user?.perfil === 'ADMINISTRADOR' || user?.perfil === 'VOLUNTARIO'
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<Page<InventoryMovement> | null>(null)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState('')
  const key = `${expenseId}:${page}:${attempt}`
  useEffect(() => { if (!allowed) return; let active = true; listInventoryMovements({ despesaId: String(expenseId), page }).then(value => { if (active) { setData(value); setError(''); setLoaded(key) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoaded(key) } }); return () => { active = false } }, [expenseId, page, allowed, key])
  if (!allowed) return null
  return <section className="institutional-section inventory-receipts"><h2>Recebimentos de estoque</h2><p className="institutional-help">Entradas vinculadas à despesa #{expenseId}. O valor da despesa permanece no lançamento financeiro original e não é somado por recebimento.</p><LoadState loading={loaded !== key} error={error} retry={() => setAttempt(n => n + 1)} />{loaded === key && !error && data && (data.data.length ? <><div className="institutional-table-wrap inventory-table"><table className="institutional-table"><thead><tr><th scope="col">Produto</th><th scope="col">Quantidade</th><th scope="col">Data e responsável</th><th scope="col">Lote</th><th scope="col">Movimentação</th></tr></thead><tbody>{data.data.map(row => <tr key={row.id}><td data-label="Produto"><strong>{row.produto.nome}</strong></td><td data-label="Quantidade">{formatQuantity(row.quantidade)} {row.unidade.sigla}</td><td data-label="Data e responsável">{formatFinancialDate(row.createdAt)}<small>{row.responsavel.nome}</small></td><td data-label="Lote">{row.lote?.codigo ?? 'Sem lote'}</td><td data-label="Movimentação"><Link className="institutional-row-link" to={`/ong/estoque/movimentacoes/${row.id}`}>Ver movimento #{row.id}</Link></td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={setPage} /></> : <Empty title="Nenhum recebimento de estoque está vinculado a esta despesa.">Podem existir recebimentos antigos sem vínculo registrado.</Empty>)}</section>
}
