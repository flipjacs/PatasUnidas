import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Notice } from '../../shared/components/Ui'
import { createFinancialMovement, decideFinancialMovement, getFinancialMovement, institutionalError, listExpenseCategories, listFinancialMovements, loadFinancialSummary, type ExpenseCategory, type FinancialMovement, type FinancialSummary, type Page } from './api'
import { ExpenseCategoryManager } from './ExpenseCategoryManager'
import { InventoryReceipts } from './InventoryReceipts'
import { Empty, LoadState, PageHeading, Pager, Status } from './InstitutionalUi'
import { useAuth } from '../auth/auth'
import './finance.css'
import { formatMoney as money, formatFinancialDate as date } from './financialFormat'

const categories = { RECEITA: ['EVENTO', 'OUTRA_RECEITA'], DESPESA: ['ALIMENTACAO', 'MEDICAMENTOS', 'VETERINARIO', 'TRANSPORTE', 'MANUTENCAO', 'OUTRA_DESPESA'] }
const labels: Record<string, string> = { EVENTO: 'Evento', OUTRA_RECEITA: 'Outra receita', ALIMENTACAO: 'Alimentação', MEDICAMENTOS: 'Medicamentos', VETERINARIO: 'Veterinário', TRANSPORTE: 'Transporte', MANUTENCAO: 'Manutenção', OUTRA_DESPESA: 'Outra despesa', DOACAO: 'Doação', APADRINHAMENTO: 'Apadrinhamento' }
const statusOptions = ['PENDENTE', 'APROVADA', 'REALIZADA', 'CANCELADA']
const expenseLabel = (item: FinancialMovement) => item.categoriaDespesa?.nome ?? 'Não categorizado'

export function FinanceOverview() {
  const [search, setSearch] = useSearchParams()
  const [data, setData] = useState<Page<FinancialMovement> | null>(null)
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [categoryError, setCategoryError] = useState('')
  const { user } = useAuth()
  const key = search.toString()
  useEffect(() => {
    let active = true
    Promise.all([listFinancialMovements({ page: search.get('page') || 1, tipo: search.get('tipo') || undefined, status: search.get('status') || undefined, categoriaId: search.get('categoriaId') || undefined, semCategoria: search.get('semCategoria') || undefined, de: search.get('de') || undefined, ate: search.get('ate') || undefined }), loadFinancialSummary(search.get('de') || undefined, search.get('ate') || undefined)])
      .then(([movements, totals]) => { if (active) { setData(movements); setSummary(totals); setError(''); setLoading(false) } })
      .catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } })
    return () => { active = false }
  }, [key, attempt, search])
  useEffect(() => { let active = true; listExpenseCategories().then(items => { if (active) { setExpenseCategories(items); setCategoryError('') } }).catch(cause => { if (active) setCategoryError(institutionalError(cause)) }); return () => { active = false } }, [attempt])
  function filter(name: string, value: string) { const next = new URLSearchParams(search); if (name === 'tipo' && value !== 'DESPESA') { next.delete('categoriaId'); next.delete('semCategoria') }; if (name === 'categoriaId') { next.delete('semCategoria'); next.set('tipo', 'DESPESA') }; if (name === 'semCategoria') { next.delete('categoriaId'); next.set('tipo', 'DESPESA') }; if (value) next.set(name, value); else next.delete(name); next.delete('page'); setSearch(next); setLoading(true) }
  return <>
    <PageHeading title="Financeiro" description="Valores realizados e pendências da sua ONG. O resultado realizado não representa saldo bancário." action={<Link className="button button-primary" to="/ong/financeiro/novo">Novo lançamento</Link>} />
    {user?.perfil === 'ADMINISTRADOR' && <p className="finance-analysis-entry"><Link className="institutional-row-link" to="/ong/financeiro/analise">Análise de despesas: categorias e evolução mensal →</Link></p>}
    {summary && <dl className="finance-summary"><div><dt>Receitas recebidas</dt><dd>{money(summary.receitasRealizadas)}</dd></div><div><dt>Despesas pagas</dt><dd>{money(summary.despesasRealizadas)}</dd></div><div className="finance-summary-result"><dt>Resultado realizado</dt><dd>{money(summary.saldoRealizado)}</dd></div><div><dt>Receitas pendentes</dt><dd>{money(summary.receitasPendentes)}</dd></div><div><dt>Despesas pendentes</dt><dd>{money(summary.despesasPendentes)}</dd></div><div><dt>Despesas aprovadas, não pagas</dt><dd>{money(summary.despesasAprovadas)}</dd></div></dl>}
    <p className="institutional-period-note">O período do histórico considera o cadastro. No resumo, valores realizados usam a data de confirmação; pendências usam o cadastro e despesas aprovadas usam a aprovação.</p>
    <div className="institutional-toolbar institutional-filters" aria-label="Filtrar movimentações">
      <div><label htmlFor="fin-type">Tipo</label><select id="fin-type" value={search.get('tipo') || ''} onChange={e => filter('tipo', e.target.value)}><option value="">Todos</option><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select></div>
      {(search.get('tipo') === 'DESPESA' || search.has('categoriaId') || search.has('semCategoria')) && <div><label htmlFor="fin-category">Categoria da despesa</label><select id="fin-category" value={search.get('semCategoria') ? 'none' : search.get('categoriaId') || ''} onChange={e => filter(e.target.value === 'none' ? 'semCategoria' : 'categoriaId', e.target.value === 'none' ? '1' : e.target.value)}><option value="">Todas as categorias</option><option value="none">Sem categoria</option>{expenseCategories.map(item => <option key={item.id} value={item.id}>{item.nome}{item.ativo ? '' : ' (inativa)'}</option>)}</select>{categoryError && <small role="alert">{categoryError}</small>}</div>}
      <div><label htmlFor="fin-status">Situação</label><select id="fin-status" value={search.get('status') || ''} onChange={e => filter('status', e.target.value)}><option value="">Todas</option>{statusOptions.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
      <div><label htmlFor="fin-from">De</label><input id="fin-from" type="date" value={search.get('de') || ''} onChange={e => filter('de', e.target.value)} /></div>
      <div><label htmlFor="fin-to">Até</label><input id="fin-to" type="date" min={search.get('de') || undefined} value={search.get('ate') || ''} onChange={e => filter('ate', e.target.value)} /></div>
      {search.size > 0 && <button type="button" className="institutional-clear" onClick={() => { setSearch(new URLSearchParams()); setLoading(true) }}>Limpar filtros</button>}
    </div>
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(x => x + 1) }} />
    {!loading && !error && data && (data.data.length ? <><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Movimentação</th><th>Tipo</th><th>Situação</th><th>Valor</th><th>Cadastro</th><th>Ação</th></tr></thead><tbody>{data.data.map(item => <tr key={item.id}><td data-label="Movimentação"><strong>{item.descricao}</strong><small>{item.tipo === 'DESPESA' ? expenseLabel(item) : labels[item.categoria] || item.categoria} · {item.origem.tipo === 'MANUAL' ? 'Manual' : item.origem.tipo === 'DOACAO' ? 'Doação' : 'Apadrinhamento'}</small></td><td data-label="Tipo">{item.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</td><td data-label="Situação"><Status value={item.status} /></td><td data-label="Valor" className="finance-money">{money(item.valor)}</td><td data-label="Cadastro">{date(item.createdAt)}</td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/financeiro/${item.id}`}>Ver detalhes</Link></td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={page => { const next = new URLSearchParams(search); next.set('page', String(page)); setSearch(next); setLoading(true) }} /></> : <Empty title="Nenhuma movimentação neste filtro">Cadastre uma pendência ou ajuste os filtros para consultar o histórico.</Empty>)}
    <ExpenseCategoryManager categories={expenseCategories} onChange={() => setAttempt(x => x + 1)} />
    {user?.perfil === 'VOLUNTARIO' && <p className="institutional-period-note">Você pode registrar pendências. Aprovações e confirmações são realizadas pelo administrador.</p>}
  </>
}

export function FinanceCreate() {
  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('RECEITA')
  const [categoria, setCategoria] = useState('EVENTO')
  const [categoriaId, setCategoriaId] = useState('')
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [categoryError, setCategoryError] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<FinancialMovement | null>(null)
  useEffect(() => { let active = true; listExpenseCategories().then(items => { if (active) setExpenseCategories(items) }).catch(cause => { if (active) setCategoryError(institutionalError(cause)) }); return () => { active = false } }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { setCreated(await createFinancialMovement({ tipo, ...(tipo === 'RECEITA' ? { categoria } : categoriaId ? { categoriaId: Number(categoriaId) } : { categoria: 'OUTRA_DESPESA' }), descricao: descricao.trim(), valor })) }
    catch (cause) { setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  return <><PageHeading title="Novo lançamento" description="O lançamento começa pendente. Recebimentos e pagamentos exigem confirmação posterior." back="/ong/financeiro" />
    {created ? <section className="institutional-section institutional-form-panel"><Notice variant="success">Lançamento #{created.id} registrado como pendente.</Notice><Link className="button button-primary" to={`/ong/financeiro/${created.id}`}>Ver lançamento</Link></section> : <section className="institutional-section institutional-form-panel"><form className="institutional-form" onSubmit={submit}>{error && <Notice variant="error">{error}</Notice>}<div className="institutional-form-grid"><div className="institutional-field"><label htmlFor="movement-type">Tipo</label><select id="movement-type" value={tipo} onChange={e => { const next = e.target.value as 'RECEITA' | 'DESPESA'; setTipo(next); setCategoria(categories[next][0]) }}><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select></div>{tipo === 'RECEITA' ? <div className="institutional-field"><label htmlFor="movement-category">Categoria</label><select id="movement-category" value={categoria} onChange={e => setCategoria(e.target.value)}>{categories.RECEITA.map(x => <option key={x} value={x}>{labels[x]}</option>)}</select></div> : <div className="institutional-field"><label htmlFor="movement-category-id">Categoria da despesa</label><select id="movement-category-id" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}><option value="">Sem categoria estruturada</option>{expenseCategories.some(x => x.global && x.ativo) && <optgroup label="Categorias padronizadas">{expenseCategories.filter(x => x.global && x.ativo).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>}{expenseCategories.some(x => !x.global && x.ativo) && <optgroup label="Categorias da ONG">{expenseCategories.filter(x => !x.global && x.ativo).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>}</select>{categoryError && <small role="alert">Não foi possível carregar categorias. Você ainda pode registrar uma despesa sem categoria.</small>}</div>}<div className="institutional-field"><label htmlFor="movement-value">Valor em reais</label><input id="movement-value" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="125.50" pattern="[0-9]+([.][0-9]{1,2})?" required /><small>Use ponto para separar centavos, por exemplo 125.50.</small></div><div className="institutional-field"><label htmlFor="movement-description">Descrição</label><input id="movement-description" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={255} required /></div></div><div className="institutional-form-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Registrando…' : 'Registrar pendência'}</button></div></form></section>}
  </>
}

export function FinanceDetails() {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const [item, setItem] = useState<FinancialMovement | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; getFinancialMovement(id).then(x => { if (active) { setItem(x); setError('') } }).catch(e => { if (active) setError(institutionalError(e)) }); return () => { active = false } }, [id, attempt])
  const actions = item?.origem.tipo === 'MANUAL' && user?.perfil === 'ADMINISTRADOR' ? item.tipo === 'RECEITA' && item.status === 'PENDENTE' ? [['confirmar-recebimento', 'Confirmar recebimento'], ['cancelar', 'Cancelar pendência']] as const : item.tipo === 'DESPESA' && item.status === 'PENDENTE' ? [['aprovar', 'Aprovar despesa'], ['cancelar', 'Cancelar pendência']] as const : item.tipo === 'DESPESA' && item.status === 'APROVADA' ? [['confirmar-pagamento', 'Confirmar pagamento'], ['cancelar', 'Cancelar despesa']] as const : [] : []
  async function decide(action: 'aprovar' | 'confirmar-pagamento' | 'confirmar-recebimento' | 'cancelar') {
    if (busy || !item) return
    setBusy(true); setError('')
    try { setItem(await decideFinancialMovement(item.id, action)) }
    catch (cause) { setError(institutionalError(cause)); getFinancialMovement(id).then(setItem).catch(() => undefined) }
    finally { setBusy(false) }
  }
  return <><PageHeading title={item ? `Lançamento #${item.id}` : 'Lançamento'} back="/ong/financeiro" />{error && <div className="institutional-error"><Notice variant="error">{error}</Notice><button className="button button-secondary" onClick={() => setAttempt(x => x + 1)}>Atualizar dados</button></div>}{!item && !error && <LoadState loading error="" retry={() => undefined} />}{item && <div className="institutional-detail-grid"><section className="institutional-section"><div className="institutional-section-head"><h2>{item.descricao}</h2><Status value={item.status} /></div><dl className="institutional-facts"><div><dt>Valor</dt><dd className="finance-money">{money(item.valor)}</dd></div><div><dt>Tipo e categoria</dt><dd>{item.tipo === 'RECEITA' ? 'Receita' : 'Despesa'} · {item.tipo === 'DESPESA' ? expenseLabel(item) : labels[item.categoria] || item.categoria}</dd></div><div><dt>Origem</dt><dd>{item.origem.tipo === 'MANUAL' ? 'Lançamento manual' : `${item.origem.tipo} #${item.origem.id}`}</dd></div><div><dt>Cadastro</dt><dd>{date(item.createdAt)}{item.registradoPor ? ` · ${item.registradoPor.nome}` : ''}</dd></div><div><dt>Aprovação</dt><dd>{date(item.aprovadoEm)}{item.aprovadoPor ? ` · ${item.aprovadoPor.nome}` : ''}</dd></div><div><dt>Confirmação</dt><dd>{date(item.confirmadoEm)}{item.confirmadoPor ? ` · ${item.confirmadoPor.nome}` : ''}</dd></div><div><dt>Cancelamento</dt><dd>{date(item.canceladoEm)}</dd></div></dl></section><aside className="institutional-section institutional-detail-side"><h2>Próximo passo</h2><p className="institutional-help">{item.status === 'REALIZADA' ? 'Valor realizado e preservado no histórico.' : item.status === 'CANCELADA' ? 'Lançamento cancelado e preservado no histórico.' : item.tipo === 'DESPESA' && item.status === 'APROVADA' ? 'A aprovação autorizou a despesa; o pagamento ainda precisa ser confirmado.' : 'Este valor ainda não compõe o resultado realizado.'}</p>{actions.length > 0 && <div className="institutional-action-list">{actions.map(([action, label]) => <button key={action} type="button" className={`button ${action === 'cancelar' ? 'button-secondary' : 'button-primary'}`} disabled={busy} onClick={() => decide(action)}>{busy ? 'Atualizando…' : label}</button>)}</div>}</aside></div>}{item?.id === id && item.tipo === 'DESPESA' && <InventoryReceipts key={item.id} expenseId={item.id} />}</>
}
