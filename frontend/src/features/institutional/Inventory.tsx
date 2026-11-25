import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { Notice } from '../../shared/components/Ui'
import { useAuth } from '../auth/auth'
import { deactivateInventoryProduct, getInventoryProduct, institutionalError, listInventoryCategories, listInventoryProducts, listInventoryUnits, listStorageLocations, type InventoryCategory, type InventoryProduct, type InventoryUnit, type Page, type StorageLocation } from './api'
import { Empty, LoadState, PageHeading, Pager, Status } from './InstitutionalUi'
import { InventoryLots } from './InventoryLots'
import { InventoryNav, InventoryScopeNote } from './InventoryUi'
import { formatQuantity as quantity } from './inventoryFormat'
import { formatFinancialDate as date } from './financialFormat'

export function InventoryList() {
  const { user } = useAuth()
  const [search, setSearch] = useSearchParams()
  const [term, setTerm] = useState(search.get('busca') ?? '')
  const [data, setData] = useState<Page<InventoryProduct> | null>(null)
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [units, setUnits] = useState<InventoryUnit[]>([])
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [error, setError] = useState('')
  const [referenceError, setReferenceError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState('')
  const key = `${search.toString()}:${attempt}`
  const loading = key !== loaded
  useEffect(() => {
    let active = true
    const page = Number(search.get('page') || 1)
    listInventoryProducts({ page: Number.isInteger(page) && page > 0 ? page : 1, busca: search.get('busca') || undefined, categoriaId: search.get('categoriaId') || undefined, unidadeId: search.get('unidadeId') || undefined, localId: search.get('localId') || undefined, ativo: search.get('ativo') || undefined })
      .then(result => { if (active) { setData(result); setError(''); setLoaded(key) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoaded(key) } })
    return () => { active = false }
  }, [search, key])
  useEffect(() => {
    let active = true
    Promise.all([listInventoryCategories(), listInventoryUnits(), listStorageLocations()]).then(([cats, measures, places]) => { if (active) { setCategories(cats); setUnits(measures); setLocations(places); setReferenceError('') } }).catch(cause => { if (active) setReferenceError(institutionalError(cause)) })
    return () => { active = false }
  }, [attempt])
  function filter(name: string, value: string) { const next = new URLSearchParams(search); if (value) next.set(name, value); else next.delete(name); next.delete('page'); setSearch(next) }
  return <>
    <PageHeading title="Estoque" description="Organize os produtos e suprimentos para os cuidados com os animais." action={user?.perfil !== 'VETERINARIO' ? <Link className="button button-primary" to="/ong/estoque/novo">Cadastrar produto</Link> : undefined} />
    <InventoryNav /><InventoryScopeNote />
    <form className="institutional-toolbar institutional-search" role="search" onSubmit={event => { event.preventDefault(); filter('busca', term.trim()) }}><div><label htmlFor="inventory-search">Buscar produto pelo nome</label><input id="inventory-search" type="search" value={term} onChange={event => setTerm(event.target.value)} maxLength={150} /></div><button type="submit" className="button button-secondary">Buscar</button></form>
    {referenceError && <Notice variant="error">{referenceError}</Notice>}
    <div className="institutional-toolbar institutional-filters inventory-filters" aria-label="Filtrar produtos">
      <div><label htmlFor="inventory-category-filter">Categoria</label><select id="inventory-category-filter" value={search.get('categoriaId') || ''} onChange={event => filter('categoriaId', event.target.value)}><option value="">Todas</option>{categories.map(item => <option key={item.id} value={item.id}>{item.nome}{item.ativo ? '' : ' (inativa)'}</option>)}</select></div>
      <div><label htmlFor="inventory-unit-filter">Unidade</label><select id="inventory-unit-filter" value={search.get('unidadeId') || ''} onChange={event => filter('unidadeId', event.target.value)}><option value="">Todas</option>{units.map(item => <option key={item.id} value={item.id}>{item.nome} ({item.sigla})</option>)}</select></div>
      <div><label htmlFor="inventory-place-filter">Local principal</label><select id="inventory-place-filter" value={search.get('localId') || ''} onChange={event => filter('localId', event.target.value)}><option value="">Todos</option>{locations.map(item => <option key={item.id} value={item.id}>{item.nome}{item.ativo ? '' : ' (inativo)'}</option>)}</select></div>
      <div><label htmlFor="inventory-state-filter">Estado</label><select id="inventory-state-filter" value={search.get('ativo') || ''} onChange={event => filter('ativo', event.target.value)}><option value="">Todos</option><option value="1">Ativo</option><option value="0">Inativo</option></select></div>
      {search.size > 0 && <button className="institutional-clear" onClick={() => { setSearch({}); setTerm('') }}>Limpar filtros</button>}
    </div>
    <LoadState loading={loading} error={error} retry={() => setAttempt(value => value + 1)} />
    {!loading && !error && data && (data.data.length ? <><div className="institutional-table-wrap inventory-table"><table className="institutional-table"><thead><tr><th scope="col">Produto e categoria</th><th scope="col">Disponível</th><th scope="col">Mínimo</th><th scope="col">Local</th><th scope="col">Estado</th><th scope="col">Ação</th></tr></thead><tbody>{data.data.map(item => <tr key={item.id}><td data-label="Produto"><strong>{item.nome}</strong><small>{item.categoria.nome}{!item.categoria.ativo ? ' (inativa)' : ''}{item.marca ? ` · ${item.marca}` : ''}</small></td><td data-label="Disponível">{quantity(item.quantidadeDisponivel)} {item.unidade.sigla}</td><td data-label="Mínimo">{quantity(item.quantidadeMinima)} {item.unidade.sigla}</td><td data-label="Local">{item.local?.nome ?? 'Não definido'}</td><td data-label="Estado"><Status value={item.ativo} /></td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/estoque/${item.id}`} state={{ back: `/ong/estoque?${search}` }}>Ver produto</Link></td></tr>)}</tbody></table></div><Pager page={data.meta.current_page} last={data.meta.last_page} total={data.meta.total} onPage={page => { const next = new URLSearchParams(search); next.set('page', String(page)); setSearch(next) }} /></> : <Empty title="Nenhum produto encontrado">Ajuste os filtros para consultar o catálogo{user?.perfil !== 'VETERINARIO' ? ' ou cadastre um produto.' : '.'}</Empty>)}
  </>
}

export function InventoryDetails() {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const location = useLocation()
  const [item, setItem] = useState<InventoryProduct | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const back = typeof location.state?.back === 'string' && location.state.back.startsWith('/ong/estoque?') ? location.state.back : '/ong/estoque'
  useEffect(() => { let active = true; getInventoryProduct(id).then(result => { if (active) { setItem(result); setError('') } }).catch(cause => { if (active) setError(institutionalError(cause)) }); return () => { active = false } }, [id, attempt])
  async function deactivate() {
    if (!item || busy || !window.confirm('Este produto deixará de estar disponível para novas operações. Seu cadastro e histórico serão preservados. Deseja desativar?')) return
    setBusy(true); setError('')
    try { setItem(await deactivateInventoryProduct(item.id)) }
    catch (cause) { setError(institutionalError(cause)); getInventoryProduct(id).then(setItem).catch(() => undefined) }
    finally { setBusy(false) }
  }
  const visible = item?.id === id ? item : null
  return <><PageHeading title={visible?.nome ?? 'Produto'} back={back} action={visible && user?.perfil !== 'VETERINARIO' ? <Link className="button button-primary" to={`/ong/estoque/${id}/editar`}>Editar produto</Link> : undefined} /><InventoryNav />
    <LoadState loading={!visible && !error} error={error} retry={() => setAttempt(value => value + 1)} />
    {location.state?.notice && <Notice variant="success">{location.state.notice}</Notice>}
    {visible && <section className="institutional-section"><div className="institutional-section-head"><h2>Dados do produto</h2><Status value={visible.ativo} /></div><dl className="institutional-facts inventory-facts"><div><dt>Quantidade disponível</dt><dd>{quantity(visible.quantidadeDisponivel)} {visible.unidade.sigla}</dd></div><div><dt>Estoque mínimo</dt><dd>{quantity(visible.quantidadeMinima)} {visible.unidade.sigla}</dd></div><div><dt>Categoria</dt><dd>{visible.categoria.nome}{!visible.categoria.ativo && ' (inativa)'}</dd></div><div><dt>Unidade</dt><dd>{visible.unidade.nome} ({visible.unidade.sigla})</dd></div><div><dt>Local principal</dt><dd>{visible.local ? `${visible.local.nome}${visible.local.ativo ? '' : ' (inativo)'}` : 'Não definido'}</dd></div><div><dt>Marca</dt><dd>{visible.marca || 'Não informada'}</dd></div><div><dt>Código interno</dt><dd>{visible.codigoInterno || 'Não informado'}</dd></div><div><dt>Descrição</dt><dd>{visible.descricao || 'Não informada'}</dd></div><div><dt>Observações</dt><dd>{visible.observacoes || 'Não informadas'}</dd></div><div><dt>Cadastro</dt><dd>{date(visible.createdAt)}</dd></div><div><dt>Última atualização</dt><dd>{date(visible.updatedAt)}</dd></div></dl><p className="institutional-help">{visible.controlaValidade ? 'Lote e validade obrigatórios nas entradas.' : 'Controle de validade opcional.'}</p><p className="institutional-help">Sem lote: {quantity(visible.quantidadeSemLote ?? '0.000')} {visible.unidade.sigla}{!visible.possuiMovimentacoes ? ' · Sem movimentações registradas.' : ''}</p><div className="institutional-detail-actions">{visible.ativo && (user?.perfil === 'ADMINISTRADOR' || user?.perfil === 'VOLUNTARIO') && <><Link className="button button-primary" to={`/ong/estoque/${id}/movimentar/entrada`}>Registrar entrada</Link><Link className="button button-secondary" to={`/ong/estoque/${id}/movimentar/saida`}>Registrar saída</Link>{user?.perfil === 'ADMINISTRADOR' && <Link className="button button-secondary" to={`/ong/estoque/${id}/movimentar/ajuste`}>Registrar ajuste</Link>}</>}<Link className="button button-text" to={`/ong/estoque/movimentacoes?produtoId=${id}`}>Consultar histórico</Link></div>{user?.perfil === 'ADMINISTRADOR' && visible.ativo && <div className="institutional-detail-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={deactivate}>{busy ? 'Desativando…' : 'Desativar produto'}</button></div>}</section>}{visible && <InventoryLots key={visible.id} productId={visible.id} unit={visible.unidade.sigla} />}
  </>
}
