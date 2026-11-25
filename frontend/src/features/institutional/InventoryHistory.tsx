import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { getInventoryMovement, institutionalError, listInventoryMovements, type InventoryMovement, type InventoryMovementFilters, type Page } from './api'
import { Empty, LoadState, PageHeading, Pager } from './InstitutionalUi'
import { InventoryNav } from './InventoryUi'
import { InventoryExpenseLink } from './InventoryExpenseLink'
import { movementLabels } from './inventoryFormat'
import { formatQuantity as qty } from './inventoryFormat'
import { formatFinancialDate as date } from './financialFormat'
import { Notice } from '../../shared/components/Ui'
const filterNames = ['produtoId', 'tipo', 'loteId', 'responsavelId', 'de', 'ate'] as const
export function InventoryHistory() {
  const [search, setSearch] = useSearchParams()
  const [data, setData] = useState<Page<InventoryMovement> | null>(null)
  const [loaded, setLoaded] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const key = `${search}:${attempt}`
  useEffect(() => { let active = true; const filters: InventoryMovementFilters = { page: Number(search.get('page') || 1) }; for (const name of filterNames) { if (search.get(name)) filters[name] = search.get(name)! } listInventoryMovements(filters).then(value => { if (active) { setData(value); setLoaded(key); setError('') } }).catch(cause => { if (active) { setLoaded(key); setError(institutionalError(cause)) } }); return () => { active = false } }, [search, key])
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); const next = new URLSearchParams(); for (const name of filterNames) { const value = String(values.get(name) || ''); if (value) next.set(name, value) } if (next.get('de') && next.get('ate') && next.get('de')! > next.get('ate')!) { setFilterError('A data inicial não pode ser posterior à final.'); return } setFilterError(''); setSearch(next) }
  return <><PageHeading title="Movimentações de estoque" description="Histórico de recebimentos, retiradas e ajustes. Os registros são preservados e somente leitura." /><InventoryNav />
    <form key={search.toString()} className="institutional-toolbar institutional-filters inventory-filters" onSubmit={submit}>
      <div><label htmlFor="history-product">ID do produto</label><input id="history-product" name="produtoId" type="number" min={1} defaultValue={search.get('produtoId') || ''} /></div>
      <div><label htmlFor="history-type">Tipo</label><select id="history-type" name="tipo" defaultValue={search.get('tipo') || ''}><option value="">Todos</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label htmlFor="history-lot">ID do lote</label><input id="history-lot" name="loteId" type="number" min={1} defaultValue={search.get('loteId') || ''} /></div>
      <div><label htmlFor="history-person">ID do responsável</label><input id="history-person" name="responsavelId" type="number" min={1} defaultValue={search.get('responsavelId') || ''} /></div>
      <div><label htmlFor="history-start">Data inicial</label><input id="history-start" name="de" type="date" defaultValue={search.get('de') || ''} /></div>
      <div><label htmlFor="history-end">Data final</label><input id="history-end" name="ate" type="date" defaultValue={search.get('ate') || ''} /></div>
      <button className="button button-secondary" type="submit">Aplicar filtros</button>{search.size > 0 && <button className="button button-text" type="button" onClick={() => { setSearch({}); setFilterError('') }}>Limpar filtros</button>}
    </form><p className="institutional-help">Os identificadores estão nos detalhes do produto, do lote e da movimentação. Datas incluem o dia informado.</p>
    {filterError && <Notice variant="error">{filterError}</Notice>}<LoadState loading={loaded !== key} error={error} retry={() => setAttempt(n => n + 1)} />
    {loaded === key && !error && data && (data.data.length ? <><div className="institutional-table-wrap inventory-table"><table className="institutional-table"><thead><tr><th scope="col">Produto e lote</th><th scope="col">Data e responsável</th><th scope="col">Movimentação</th><th scope="col">Quantidade</th><th scope="col">Saldo físico</th><th scope="col">Histórico</th></tr></thead><tbody>{data.data.map(item => <tr key={item.id}><td data-label="Produto e lote"><strong>{item.produto.nome}</strong><small>{item.lote ? `Lote ${item.lote.codigo}` : 'Sem lote'}</small><InventoryExpenseLink value={item.despesa} compact /></td><td data-label="Data e responsável">{date(item.createdAt)}<small>{item.responsavel.nome}</small></td><td data-label="Movimentação">{movementLabels[item.tipo]}<small>{item.motivo}</small></td><td data-label="Quantidade">{qty(item.quantidade)} {item.unidade.sigla}</td><td data-label="Saldo físico">{qty(item.saldoAnterior)} → {qty(item.saldoPosterior)} {item.unidade.sigla}</td><td data-label="Histórico"><Link className="institutional-row-link" to={`/ong/estoque/movimentacoes/${item.id}`}>Ver movimento #{item.id}</Link></td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={value => { const next = new URLSearchParams(search); next.set('page', String(value)); setSearch(next) }} /></> : <Empty title="Nenhuma movimentação encontrada">Registre uma entrada no detalhe de um produto ou ajuste os filtros.</Empty>)}
  </>
}
export function InventoryMovementDetails() {
  const { movementId } = useParams()
  const [item, setItem] = useState<InventoryMovement | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; getInventoryMovement(Number(movementId)).then(value => { if (active) { setItem(value); setError('') } }).catch(cause => { if (active) setError(institutionalError(cause)) }); return () => { active = false } }, [movementId, attempt])
  const visible = item?.id === Number(movementId) ? item : null
  return <><PageHeading title={`Movimentação #${movementId}`} back="/ong/estoque/movimentacoes" /><InventoryNav /><LoadState loading={!visible && !error} error={error} retry={() => setAttempt(n => n + 1)} />{visible && <section className="institutional-section"><h2>{movementLabels[visible.tipo]}</h2><dl className="institutional-facts inventory-facts"><div><dt>Produto</dt><dd><Link className="institutional-row-link" to={`/ong/estoque/${visible.produto.id}`}>{visible.produto.nome} (#{visible.produto.id})</Link></dd></div><div><dt>Quantidade</dt><dd>{qty(visible.quantidade)} {visible.unidade.sigla}</dd></div><div><dt>Saldo anterior</dt><dd>{qty(visible.saldoAnterior)} {visible.unidade.sigla}</dd></div><div><dt>Saldo posterior</dt><dd>{qty(visible.saldoPosterior)} {visible.unidade.sigla}</dd></div><div><dt>Responsável</dt><dd>{visible.responsavel.nome} (#{visible.responsavel.id})</dd></div><div><dt>Data</dt><dd>{date(visible.createdAt)} · {new Date(visible.createdAt).toLocaleTimeString('pt-BR')}</dd></div><div><dt>Motivo</dt><dd>{visible.motivo}</dd></div><div><dt>Observações</dt><dd>{visible.observacoes || 'Não informadas'}</dd></div><div><dt>Lote</dt><dd>{visible.lote ? `${visible.lote.codigo} (#${visible.lote.id})` : 'Sem lote'}</dd></div><div><dt>Validade</dt><dd>{visible.lote?.validade ? date(visible.lote.validade) : 'Não informada'}</dd></div></dl><InventoryExpenseLink value={visible.despesa} /><p className="institutional-period-note">Registro preservado. Correções exigem uma nova movimentação justificada.</p></section>}</>
}
