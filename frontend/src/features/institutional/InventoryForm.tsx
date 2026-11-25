import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice } from '../../shared/components/Ui'
import { useAuth } from '../auth/auth'
import { createInventoryProduct, getInventoryProduct, institutionalError, listInventoryCategories, listInventoryUnits, listStorageLocations, updateInventoryProduct, type InventoryCategory, type InventoryProduct, type InventoryProductInput, type InventoryUnit, type StorageLocation } from './api'
import { LoadState, PageHeading } from './InstitutionalUi'
import { InventoryNav } from './InventoryUi'

type References = { categories: InventoryCategory[]; units: InventoryUnit[]; locations: StorageLocation[] }
type Draft = { nome: string; marca: string; codigoInterno: string; categoriaId: string; unidadeId: string; localId: string; quantidadeMinima: string; descricao: string; observacoes: string }
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div className="institutional-field"><label htmlFor={id}>{label}</label>{children}{error && <span id={`${id}-error`} className="institutional-field-error">{error}</span>}</div>
}

function ProductForm({ initial, refs }: { initial: InventoryProduct | null; refs: References }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>({ nome: initial?.nome ?? '', marca: initial?.marca ?? '', codigoInterno: initial?.codigoInterno ?? '', categoriaId: String(initial?.categoria.id ?? ''), unidadeId: String(initial?.unidade.id ?? ''), localId: String(initial?.local?.id ?? ''), quantidadeMinima: initial?.quantidadeMinima ?? '0', descricao: initial?.descricao ?? '', observacoes: initial?.observacoes ?? '' })
  const [controlaValidade, setControlaValidade] = useState(initial?.controlaValidade ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const unit = refs.units.find(item => item.id === Number(draft.unidadeId))
  const back = initial ? `/ong/estoque/${initial.id}` : '/ong/estoque'
  function update(field: keyof Draft, value: string) { setDraft(current => ({ ...current, [field]: value })) }
  function accessibility(field: keyof Draft) { return { 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `stock-${field}-error` : undefined } }
  function focusError() { requestAnimationFrame(() => document.querySelector<HTMLElement>('.inventory-form [aria-invalid="true"]')?.focus()) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const minimum = draft.quantidadeMinima.trim().replace(',', '.')
    const localErrors: Record<string, string[]> = {}
    if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(minimum)) localErrors.quantidadeMinima = ['Informe um valor não negativo, até 999999999.999 e três casas decimais, sem separador de milhar.']
    else if (unit && !unit.fracionavel && /\.\d*[1-9]/.test(minimum)) localErrors.quantidadeMinima = ['Esta unidade exige uma quantidade inteira.']
    if (!draft.categoriaId) localErrors.categoriaId = ['Selecione uma categoria.']
    if (!draft.unidadeId) localErrors.unidadeId = ['Selecione uma unidade.']
    if (draft.nome.trim().length < 2) localErrors.nome = ['Informe o nome do produto com pelo menos dois caracteres.']
    setErrors(localErrors); setError('')
    if (Object.keys(localErrors).length) { setError('Confira os campos indicados.'); focusError(); return }
    const value: InventoryProductInput = { nome: draft.nome.trim(), marca: draft.marca.trim() || null, codigoInterno: draft.codigoInterno.trim() || null, descricao: draft.descricao.trim() || null, observacoes: draft.observacoes.trim() || null, categoriaId: Number(draft.categoriaId), unidadeId: Number(draft.unidadeId), localId: draft.localId ? Number(draft.localId) : null, quantidadeMinima: minimum, controlaValidade }
    const patch: Partial<InventoryProductInput> = {}
    if (initial) {
      const before: InventoryProductInput = { nome: initial.nome, marca: initial.marca, codigoInterno: initial.codigoInterno, descricao: initial.descricao, observacoes: initial.observacoes, categoriaId: initial.categoria.id, unidadeId: initial.unidade.id, localId: initial.local?.id ?? null, quantidadeMinima: initial.quantidadeMinima, controlaValidade: initial.controlaValidade ?? false }
      for (const key of Object.keys(value) as (keyof InventoryProductInput)[]) {
        if (value[key] !== before[key]) Object.assign(patch, { [key]: value[key] })
      }
    }
    setBusy(true)
    try {
      const product = initial ? await updateInventoryProduct(initial.id, patch) : await createInventoryProduct(value)
      navigate(`/ong/estoque/${product.id}`, { replace: true, state: { notice: initial ? 'Produto atualizado.' : 'Produto cadastrado com saldo zero.' } })
    } catch (cause) {
      if (cause instanceof ApiError && cause.errors) { setErrors(cause.errors); setError('Confira os campos indicados.'); focusError() }
      else setError(institutionalError(cause))
    } finally { setBusy(false) }
  }
  return <section className="institutional-section inventory-form-panel"><form className="institutional-form inventory-form" onSubmit={submit} noValidate>
    {error && <Notice variant="error">{error}</Notice>}<p className="institutional-help">Campos com * são obrigatórios. A quantidade disponível é somente leitura.</p>
    <fieldset><legend>Identificação</legend><div className="institutional-form-grid"><Field id="stock-nome" label="Nome do produto *" error={errors.nome?.[0]}><input id="stock-nome" value={draft.nome} onChange={event => update('nome', event.target.value)} required minLength={2} maxLength={150} {...accessibility('nome')} /></Field><Field id="stock-marca" label="Marca" error={errors.marca?.[0]}><input id="stock-marca" value={draft.marca} onChange={event => update('marca', event.target.value)} maxLength={100} {...accessibility('marca')} /></Field><Field id="stock-codigoInterno" label="Código interno" error={errors.codigoInterno?.[0]}><input id="stock-codigoInterno" value={draft.codigoInterno} onChange={event => update('codigoInterno', event.target.value)} maxLength={60} {...accessibility('codigoInterno')} /></Field></div></fieldset>
    <fieldset><legend>Classificação</legend><div className="institutional-form-grid"><Field id="stock-categoriaId" label="Categoria *" error={errors.categoriaId?.[0]}><select id="stock-categoriaId" value={draft.categoriaId} onChange={event => update('categoriaId', event.target.value)} required {...accessibility('categoriaId')}><option value="">Selecione</option>{initial && !initial.categoria.ativo && <option value={initial.categoria.id} disabled>{initial.categoria.nome} (inativa, vínculo atual)</option>}{[true, false].map(global => <optgroup key={String(global)} label={global ? 'Categorias padronizadas' : 'Categorias da ONG'}>{refs.categories.filter(item => item.ativo && item.global === global).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</optgroup>)}</select></Field><Field id="stock-unidadeId" label="Unidade de medida *" error={errors.unidadeId?.[0]}><select id="stock-unidadeId" value={draft.unidadeId} onChange={event => update('unidadeId', event.target.value)} required {...accessibility('unidadeId')} disabled={!!initial && (!!initial.possuiMovimentacoes || /[1-9]/.test(initial.quantidadeDisponivel))}><option value="">Selecione</option>{refs.units.map(item => <option key={item.id} value={item.id}>{item.nome} ({item.sigla})</option>)}</select></Field></div>{initial && <p className="institutional-help">Alterações de unidade dependem do saldo e do histórico, verificados pelo servidor.</p>}</fieldset>
    <fieldset><legend>Organização</legend><div className="institutional-form-grid"><Field id="stock-localId" label="Local principal" error={errors.localId?.[0]}><select id="stock-localId" value={draft.localId} onChange={event => update('localId', event.target.value)} {...accessibility('localId')}><option value="">Não definido</option>{initial?.local && !initial.local.ativo && <option value={initial.local.id} disabled>{initial.local.nome} (inativo, vínculo atual)</option>}{refs.locations.filter(item => item.ativo).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field id="stock-quantidadeMinima" label={`Estoque mínimo${unit ? ` (${unit.sigla})` : ''}`} error={errors.quantidadeMinima?.[0]}><input id="stock-quantidadeMinima" inputMode="decimal" value={draft.quantidadeMinima} onChange={event => update('quantidadeMinima', event.target.value)} {...accessibility('quantidadeMinima')} /></Field></div><p className="institutional-help">{unit?.fracionavel ? 'Até três casas decimais. Exemplo: 2,500. Não use separador de milhar.' : 'Informe uma quantidade inteira para unidades indivisíveis.'}</p></fieldset>
    <fieldset><legend>Controle de validade</legend><label className="inventory-checkbox"><input type="checkbox" checked={controlaValidade} onChange={event => setControlaValidade(event.target.checked)} disabled={!!initial?.possuiMovimentacoes} aria-describedby="expiry-help" />Exigir lote e validade nas entradas</label><p id="expiry-help" className="institutional-help">{initial?.possuiMovimentacoes ? 'O controle de validade está protegido após a primeira movimentação.' : 'Ative para produtos que precisam de rastreabilidade por lote e data de validade.'}</p>{errors.controlaValidade && <p className="institutional-field-error">{errors.controlaValidade[0]}</p>}</fieldset>
    <fieldset><legend>Informações adicionais</legend><div className="institutional-form-grid">{(['descricao', 'observacoes'] as const).map(field => <Field id={`stock-${field}`} key={field} label={field === 'descricao' ? 'Descrição' : 'Observações'} error={errors[field]?.[0]}><textarea id={`stock-${field}`} value={draft[field]} onChange={event => update(field, event.target.value)} maxLength={2000} rows={3} {...accessibility(field)} /></Field>)}</div></fieldset>
    <div className="institutional-form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : initial ? 'Salvar alterações' : 'Cadastrar produto'}</button><Link className="button button-text" to={back}>Cancelar</Link></div>
  </form></section>
}

export function InventoryEditor() {
  const { id: rawId } = useParams()
  const id = rawId ? Number(rawId) : null
  const { user } = useAuth()
  const [references, setReferences] = useState<References | null>(null)
  const [initial, setInitial] = useState<InventoryProduct | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState('')
  const key = `${id}:${attempt}`
  const editable = user?.perfil === 'ADMINISTRADOR' || user?.perfil === 'VOLUNTARIO'
  useEffect(() => {
    if (!editable) return
    let active = true
    Promise.all([listInventoryCategories(), listInventoryUnits(), listStorageLocations(), id === null ? Promise.resolve(null) : getInventoryProduct(id)]).then(([categories, units, locations, product]) => { if (active) { setReferences({ categories, units, locations }); setInitial(product); setError(''); setLoaded(key) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoaded(key) } })
    return () => { active = false }
  }, [id, key, editable])
  if (!editable) return <Notice variant="error">Sua conta não pode cadastrar ou editar produtos.</Notice>
  return <><PageHeading title={id === null ? 'Cadastrar produto' : 'Editar produto'} back={id === null ? '/ong/estoque' : `/ong/estoque/${id}`} /><InventoryNav /><LoadState loading={loaded !== key} error={error} retry={() => setAttempt(value => value + 1)} />{loaded === key && !error && references && <ProductForm key={key} initial={initial} refs={references} />}</>
}
