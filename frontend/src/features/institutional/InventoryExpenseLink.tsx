import { Link } from 'react-router'
import { useAuth } from '../auth/auth'
import type { InventoryExpenseLink as ExpenseLink } from './api'
import { inventoryExpenseState } from './inventoryFormat'

export function InventoryExpenseLink({ value, compact = false }: { value: ExpenseLink | null | undefined; compact?: boolean }) {
  const { user } = useAuth()
  const financial = user?.perfil === 'ADMINISTRADOR' || user?.perfil === 'VOLUNTARIO'
  if (!value) return compact ? null : <p className="institutional-help">Sem despesa vinculada.</p>
  if (compact) return <small>Despesa #{value.id}{financial && value.status ? ` · ${inventoryExpenseState(value.status)}` : ''}</small>
  return <div className="inventory-linked-expense"><h3>Vínculo financeiro</h3><p><strong>Despesa #{value.id}</strong>{financial && value.descricao ? ` · ${value.descricao}` : ''}</p>{financial && value.status && <p>Estado financeiro atual: {inventoryExpenseState(value.status)}.</p>}{financial && <Link className="institutional-row-link" to={`/ong/financeiro/${value.id}`}>Consultar despesa e recebimentos</Link>}<p className="institutional-help">Referência preservada no histórico. O recebimento físico não confirma pagamento.</p></div>
}
