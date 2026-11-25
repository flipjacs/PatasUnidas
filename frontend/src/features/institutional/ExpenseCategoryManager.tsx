import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { Notice } from '../../shared/components/Ui'
import { createExpenseCategory, deactivateExpenseCategory, institutionalError, renameExpenseCategory, type ExpenseCategory } from './api'

type Props = { categories: ExpenseCategory[]; onChange: () => void }

export function ExpenseCategoryManager({ categories, onChange }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  if (user?.perfil !== 'ADMINISTRADOR') return null
  async function create(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try { await createExpenseCategory(name.trim()); setName(''); setSuccess('Categoria cadastrada.'); onChange() }
    catch (cause) { setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  async function rename(id: number) {
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try { await renameExpenseCategory(id, editName.trim()); setEditing(null); setSuccess('Categoria renomeada.'); onChange() }
    catch (cause) { setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  async function deactivate(item: ExpenseCategory) {
    if (busy || !window.confirm(`Desativar ${item.nome}? Ela não poderá ser usada em novos lançamentos. Despesas anteriores continuarão vinculadas.`)) return
    setBusy(true); setError(''); setSuccess('')
    try { await deactivateExpenseCategory(item.id); setSuccess('Categoria desativada.'); onChange() }
    catch (cause) { setError(institutionalError(cause)) }
    finally { setBusy(false) }
  }
  return <section className="institutional-section finance-categories" aria-labelledby="expense-category-title">
    <div className="institutional-section-head"><div><h2 id="expense-category-title">Categorias de despesas</h2><p className="institutional-help">Categorias padronizadas são compartilhadas. Você pode gerenciar as categorias desta ONG.</p></div></div>
    {error && <Notice variant="error">{error}</Notice>}{success && <Notice variant="success">{success}</Notice>}
    <form className="finance-category-create" onSubmit={create}><div className="institutional-field"><label htmlFor="new-expense-category">Nome da categoria</label><input id="new-expense-category" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} required /></div><button className="button button-secondary" disabled={busy || !name.trim()}>{busy ? 'Salvando…' : 'Cadastrar categoria'}</button></form>
    <ul className="finance-category-list">{categories.map(item => <li key={item.id}><div><strong>{item.nome}</strong><small>{item.global ? 'Padronizada' : 'Da ONG'} · {item.ativo ? 'Ativa' : 'Inativa'}</small></div>{item.gerenciavel && item.ativo && <div className="finance-category-actions">{editing === item.id ? <><label className="sr-only" htmlFor={`rename-category-${item.id}`}>Novo nome para {item.nome}</label><input id={`rename-category-${item.id}`} value={editName} onChange={event => setEditName(event.target.value)} maxLength={100} /><button type="button" className="button button-secondary" disabled={busy || editName.trim().length < 2} onClick={() => rename(item.id)}>Salvar nome</button><button type="button" className="button button-text" onClick={() => setEditing(null)}>Cancelar edição</button></> : <><button type="button" className="button button-text" disabled={busy} onClick={() => { setEditing(item.id); setEditName(item.nome) }}>Renomear</button><button type="button" className="button button-text" disabled={busy} onClick={() => deactivate(item)}>Desativar</button></>}</div>}</li>)}</ul>
  </section>
}
