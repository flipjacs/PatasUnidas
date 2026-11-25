import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { Notice } from '../../shared/components/Ui'
import { ApiError } from '../../shared/api/client'
import { createInventoryCategory, createStorageLocation, deactivateInventoryCategory, deactivateStorageLocation, institutionalError, listInventoryCategories, listInventoryUnits, listStorageLocations, updateInventoryCategory, updateStorageLocation, type InventoryCategory, type InventoryUnit, type StorageLocation } from './api'
import { Empty, LoadState, PageHeading, Status } from './InstitutionalUi'
import { InventoryNav } from './InventoryUi'

type Kind = 'categorias' | 'locais' | 'unidades'
type Reference = InventoryCategory | StorageLocation | InventoryUnit
const labels = { categorias: 'Categorias de produtos', locais: 'Locais de armazenamento', unidades: 'Unidades de medida' }

export function InventoryReferences({ kind }: { kind: Kind }) {
  const { user } = useAuth()
  const admin = user?.perfil === 'ADMINISTRADOR'
  const [items, setItems] = useState<Reference[]>([])
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const key = `${kind}:${attempt}`
  useEffect(() => {
    let active = true
    const load = kind === 'categorias' ? listInventoryCategories : kind === 'locais' ? listStorageLocations : listInventoryUnits
    load().then(result => { if (active) { setItems(result); setLoaded(key); setError('') } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoaded(key) } })
    return () => { active = false }
  }, [kind, key])
  function reset() { setNome(''); setDescricao(''); setEditing(null); setFieldErrors({}) }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (nome.trim().length < 2) { setFieldErrors({ nome: ['Informe pelo menos dois caracteres.'] }); return }
    setBusy(true); setError(''); setSuccess(''); setFieldErrors({})
    try {
      if (kind === 'categorias') {
        if (editing === null) await createInventoryCategory(nome.trim()); else await updateInventoryCategory(editing, nome.trim())
      } else if (kind === 'locais') {
        const payload = { nome: nome.trim(), descricao: descricao.trim() || null }
        if (editing === null) await createStorageLocation(payload); else await updateStorageLocation(editing, payload)
      }
      setSuccess(editing === null ? 'Cadastro realizado.' : 'Dados atualizados.'); reset(); setAttempt(value => value + 1)
    } catch (cause) {
      setError(institutionalError(cause)); if (cause instanceof ApiError && cause.errors) setFieldErrors(cause.errors)
    } finally { setBusy(false) }
  }
  async function deactivate(item: Reference) {
    if (busy || !window.confirm(`Desativar ${item.nome}? Não estará disponível para novos vínculos. Os produtos existentes manterão sua referência.`)) return
    setBusy(true); setError(''); setSuccess('')
    try {
      if (kind === 'categorias') await deactivateInventoryCategory(item.id)
      else await deactivateStorageLocation(item.id)
      setSuccess('Desativação realizada. Os vínculos existentes foram preservados.'); if (editing === item.id) reset(); setAttempt(value => value + 1)
    } catch (cause) { setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  return <><PageHeading title={labels[kind]} description={kind === 'categorias' ? 'Categorias padronizadas e categorias da sua ONG.' : kind === 'locais' ? 'Organize o local principal de armazenamento dos produtos.' : 'Unidades padronizadas, sem conversão automática de quantidades.'} back="/ong/estoque" /><InventoryNav />
    {success && <Notice variant="success">{success}</Notice>}
    {admin && kind !== 'unidades' && <section className="institutional-section inventory-reference-form"><h2>{editing === null ? (kind === 'categorias' ? 'Cadastrar categoria própria' : 'Cadastrar local') : (kind === 'categorias' ? 'Renomear categoria' : 'Editar local')}</h2><form onSubmit={submit} className="institutional-form"><div className="institutional-field"><label htmlFor="stock-reference-name">{kind === 'categorias' ? 'Nome da categoria' : 'Nome do local'}</label><input id="stock-reference-name" value={nome} onChange={event => setNome(event.target.value)} required minLength={2} maxLength={100} aria-invalid={!!fieldErrors.nome} aria-describedby={fieldErrors.nome ? 'stock-reference-name-error' : undefined} />{fieldErrors.nome && <span className="institutional-field-error" id="stock-reference-name-error">{fieldErrors.nome[0]}</span>}</div>{kind === 'locais' && <div className="institutional-field"><label htmlFor="stock-reference-description">Descrição do local</label><textarea id="stock-reference-description" value={descricao} onChange={event => setDescricao(event.target.value)} maxLength={2000} rows={3} aria-invalid={!!fieldErrors.descricao} aria-describedby={fieldErrors.descricao ? 'stock-reference-description-error' : undefined} />{fieldErrors.descricao && <span id="stock-reference-description-error" className="institutional-field-error">{fieldErrors.descricao[0]}</span>}</div>}<div className="institutional-form-actions"><button className="button button-primary" disabled={busy} type="submit">{busy ? 'Salvando…' : editing === null ? (kind === 'categorias' ? 'Cadastrar categoria' : 'Cadastrar local') : 'Salvar alterações'}</button>{editing !== null && <button className="button button-text" type="button" disabled={busy} onClick={reset}>Cancelar edição</button>}</div></form></section>}
    <LoadState loading={loaded !== key} error={error} retry={() => setAttempt(value => value + 1)} />
    {loaded === key && items.length === 0 && !error && <Empty title={kind === 'locais' ? 'Nenhum local cadastrado' : 'Nenhuma referência disponível'}>{admin && kind === 'locais' ? 'Cadastre um local para organizar os produtos.' : 'Os dados cadastrados pela ONG aparecerão aqui.'}</Empty>}
    {loaded === key && items.length > 0 && <div className="institutional-table-wrap inventory-table"><table className="institutional-table"><thead><tr><th scope="col">Nome</th><th scope="col">{kind === 'unidades' ? 'Sigla' : kind === 'categorias' ? 'Origem' : 'Descrição'}</th><th scope="col">{kind === 'unidades' ? 'Precisão' : 'Estado'}</th>{admin && kind !== 'unidades' && <th scope="col">Ações</th>}</tr></thead><tbody>{items.map(item => <tr key={item.id}><td data-label="Nome"><strong>{item.nome}</strong></td><td data-label={kind === 'unidades' ? 'Sigla' : kind === 'categorias' ? 'Origem' : 'Descrição'}>{'sigla' in item ? item.sigla : 'global' in item ? item.global ? 'Padronizada' : 'Da ONG' : item.descricao || 'Não informada'}</td><td data-label={kind === 'unidades' ? 'Precisão' : 'Estado'}>{'fracionavel' in item ? item.fracionavel ? 'Até 3 casas decimais' : 'Quantidade inteira' : <Status value={item.ativo} />}</td>{admin && kind !== 'unidades' && <td data-label="Ações">{('ativo' in item && item.ativo && (!('global' in item) || item.gerenciavel)) ? <div className="inventory-reference-actions"><button className="button button-text" type="button" disabled={busy} onClick={() => { setEditing(item.id); setNome(item.nome); setDescricao('descricao' in item ? item.descricao ?? '' : ''); setFieldErrors({}); requestAnimationFrame(() => document.getElementById('stock-reference-name')?.focus()) }}>{kind === 'categorias' ? 'Renomear' : 'Editar'}</button><button className="button button-text" type="button" disabled={busy} onClick={() => deactivate(item)}>Desativar</button></div> : <span className="institutional-help">Somente consulta</span>}</td>}</tr>)}</tbody></table></div>}
  </>
}
