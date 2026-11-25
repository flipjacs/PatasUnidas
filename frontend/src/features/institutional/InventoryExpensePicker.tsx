import { useEffect, useRef, useState } from 'react'
import { institutionalError, listInventoryExpenses, type FinancialStatus, type InventoryExpense, type Page } from './api'
import { Empty, LoadState, Pager } from './InstitutionalUi'
import { formatFinancialDate, formatMoney } from './financialFormat'
import { inventoryExpenseState } from './inventoryFormat'

export function InventoryExpensePicker({ value, onChange, refresh, error }: { value: InventoryExpense | null; onChange: (value: InventoryExpense | null) => void; refresh: number; error?: string }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<FinancialStatus | ''>('')
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<Page<InventoryExpense> | null>(null)
  const [loaded, setLoaded] = useState('')
  const [loadError, setLoadError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const key = `${page}:${status}:${attempt}:${refresh}`
  useEffect(() => {
    if (!open) return
    let active = true
    listInventoryExpenses({ page, status: status || undefined }).then(result => { if (active) { setData(result); setLoaded(key); setLoadError('') } }).catch(cause => { if (active) { setLoadError(institutionalError(cause)); setLoaded(key) } })
    return () => { active = false }
  }, [open, page, status, key])
  function select(expense: InventoryExpense) { onChange(expense); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()) }
  return <>
    <p className="institutional-help">Associe este recebimento a uma despesa registrada no financeiro. O vínculo é opcional e não altera o pagamento.</p>
    <div className="inventory-reference-actions"><button id="movement-expense-trigger" ref={trigger} type="button" className="button button-secondary" aria-expanded={open} aria-controls="inventory-expense-options" aria-invalid={!!error} aria-describedby={error ? 'movement-despesaId-error' : undefined} onClick={() => setOpen(current => !current)}>{open ? 'Fechar seleção de despesas' : value ? 'Escolher outra despesa' : 'Selecionar despesa (opcional)'}</button>{value && <button className="button button-text" type="button" onClick={() => onChange(null)}>Remover vínculo</button>}</div>
    {error && <span id="movement-despesaId-error" className="institutional-field-error">{error}</span>}
    {value ? <dl className="inventory-expense-selected"><div><dt>Despesa selecionada</dt><dd><strong>#{value.id} · {value.descricao}</strong></dd></div><div><dt>Valor da despesa original</dt><dd>{formatMoney(value.valor)}</dd></div><div><dt>Estado financeiro ao selecionar</dt><dd>{inventoryExpenseState(value.status)}</dd></div><div><dt>Recebimento físico</dt><dd>Será registrado agora.</dd></div></dl> : <p className="institutional-help">Sem despesa selecionada. Você pode registrar a compra sem vínculo.</p>}
    {value && <p className="institutional-help">Confira a referência antes de registrar. O vínculo confirmado não poderá ser editado. A mesma despesa pode identificar vários recebimentos.</p>}
    {open && <div id="inventory-expense-options" className="inventory-expense-options" aria-label="Despesas elegíveis"><div className="institutional-field"><label htmlFor="inventory-expense-status">Estado financeiro</label><select id="inventory-expense-status" value={status} onChange={event => { setStatus(event.target.value as FinancialStatus | ''); setPage(1) }}><option value="">Todos os estados elegíveis</option><option value="PENDENTE">Pendente</option><option value="APROVADA">Aprovada</option><option value="REALIZADA">Paga</option></select></div>
      <LoadState loading={loaded !== key} error={loadError} retry={() => setAttempt(n => n + 1)} />
      {loaded === key && !loadError && data && (data.data.length ? <><div className="institutional-table-wrap inventory-table"><table className="institutional-table"><thead><tr><th scope="col">Despesa</th><th scope="col">Valor original</th><th scope="col">Estado financeiro</th><th scope="col">Selecionar</th></tr></thead><tbody>{data.data.map(expense => <tr key={expense.id}><td data-label="Despesa"><strong>#{expense.id} · {expense.descricao}</strong><small>{formatFinancialDate(expense.createdAt)} · {expense.categoriaDespesa?.nome ?? 'Não categorizado'}</small></td><td data-label="Valor original">{formatMoney(expense.valor)}</td><td data-label="Estado financeiro">{inventoryExpenseState(expense.status)}</td><td data-label="Selecionar"><label className="inventory-expense-choice"><input type="radio" name="inventory-expense-choice" aria-label={`Selecionar despesa #${expense.id}`} checked={value?.id === expense.id} onChange={() => select(expense)} />Selecionar #{expense.id}</label></td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={setPage} /></> : <Empty title="Não há despesas elegíveis para vincular." />)}
    </div>}
  </>
}
