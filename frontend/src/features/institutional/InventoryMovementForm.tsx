import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice } from '../../shared/components/Ui'
import { useAuth } from '../auth/auth'
import { getInventoryProduct, institutionalError, listInventoryLots, registerInventoryMovement, type InventoryExpense, type InventoryLot, type InventoryMovementInput, type InventoryMovementType, type InventoryOperation, type InventoryProduct, type Page } from './api'
import { LoadState, PageHeading, Pager } from './InstitutionalUi'
import { InventoryNav } from './InventoryUi'
import { InventoryExpensePicker } from './InventoryExpensePicker'
import { movementLabels, formatQuantity } from './inventoryFormat'
import { formatFinancialDate } from './financialFormat'


const types: Record<InventoryOperation, InventoryMovementType[]> = { entrada: ['ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_DEVOLUCAO'], saida: ['SAIDA_CONSUMO', 'SAIDA_PERDA', 'SAIDA_DESCARTE'], ajuste: ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] }
const titles = { entrada: 'Registrar entrada', saida: 'Registrar saída', ajuste: 'Registrar ajuste' }
function MovementForm({ initial, operation }: { initial: InventoryProduct; operation: InventoryOperation }) {
  const navigate = useNavigate()
  const [product, setProduct] = useState(initial)
  const [type, setType] = useState(types[operation][0])
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [expense, setExpense] = useState<InventoryExpense | null>(null)
  const [mode, setMode] = useState<'sem' | 'novo' | 'existente'>(initial.controlaValidade && operation !== 'saida' ? 'novo' : 'sem')
  const [code, setCode] = useState('')
  const [expiry, setExpiry] = useState('')
  const [lot, setLot] = useState<InventoryLot | null>(null)
  const [lots, setLots] = useState<Page<InventoryLot> | null>(null)
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState('')
  const [lotError, setLotError] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const lock = useRef(false)
  const intent = useRef<InventoryMovementInput | null>(null)
  useEffect(() => {
    if (!uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uncertain])
  const key = `${page}:${attempt}`
  const positive = operation === 'entrada' || type === 'AJUSTE_POSITIVO'
  useEffect(() => { let active = true; listInventoryLots(product.id, page).then(value => { if (active) { setLots(value); setLoaded(key); setLotError('') } }).catch(cause => { if (active) { setLotError(institutionalError(cause)); setLoaded(key) } }); return () => { active = false } }, [product.id, page, key])
  function change(action: () => void) { if (uncertain || lock.current) return; intent.current = null; action() }
  function attrs(field: string) { return { 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `movement-${field}-error` : undefined } }
  function fieldError(field: string) { return errors[field] && <span id={`movement-${field}-error`} className="institutional-field-error">{errors[field][0]}</span> }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    let payload = intent.current
    if (!uncertain) {
      const quantity = amount.trim().replace(',', '.')
      const invalid: Record<string, string[]> = {}
      if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(quantity) || !/[1-9]/.test(quantity)) invalid.quantidade = ['Informe uma quantidade maior que zero, com até três casas decimais e sem separador de milhar.']
      else if (!product.unidade.fracionavel && /\.\d*[1-9]/.test(quantity)) invalid.quantidade = ['Esta unidade exige quantidade inteira.']
      if (reason.trim().length < 3) invalid.motivo = ['Informe o motivo com pelo menos três caracteres.']
      if (mode === 'novo' && !code.trim()) invalid['lote.codigo'] = ['Informe o código do lote.']
      if (mode === 'novo' && product.controlaValidade && !expiry) invalid['lote.validade'] = ['Este produto exige data de validade.']
      if (mode === 'existente' && !lot) invalid.loteId = ['Selecione um lote.']
      if (positive && product.controlaValidade && (mode === 'sem' || (mode === 'existente' && !lot?.validade))) invalid.loteId = ['Este produto exige um lote com validade.']
      if (type === 'SAIDA_CONSUMO' && mode === 'existente' && lot?.vencido) invalid.loteId = ['Lote vencido não pode ser usado para consumo. Selecione descarte quando apropriado.']
      if (!positive && mode === 'novo') invalid.loteId = ['Selecione um lote existente para a retirada.']
      setErrors(invalid); setError('')
      if (Object.keys(invalid).length) { setError('Confira os campos indicados.'); requestAnimationFrame(() => document.querySelector<HTMLElement>('.inventory-movement-form [aria-invalid="true"]')?.focus()); return }
      const value = { produtoId: product.id, tipo: type, quantidade: quantity, motivo: reason.trim(), observacoes: notes.trim() || null, ...(type === 'ENTRADA_COMPRA' && expense ? { despesaId: expense.id } : {}), ...(mode === 'novo' ? { lote: { codigo: code.trim(), validade: expiry || null } } : mode === 'existente' && lot ? { loteId: lot.id } : {}) }
      if (operation === 'ajuste' && !window.confirm(`Ajustar o estoque em ${positive ? 'mais' : 'menos'} ${formatQuantity(quantity)} ${product.unidade.sigla}. Esta operação ficará registrada no histórico. Confirmar ajuste?`)) return
      payload = intent.current ?? { ...value, chaveOperacao: crypto.randomUUID() }
      intent.current = payload
    }
    if (!payload) return
    lock.current = true; setBusy(true); setError('')
    try {
      const movement = await registerInventoryMovement(operation, payload)
      navigate(`/ong/estoque/${product.id}`, { replace: true, state: { notice: `Movimentação #${movement.id} confirmada. Saldo atualizado pelo servidor.` } })
    } catch (cause) {
      const unknown = !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500 || cause.status === 200 || cause.status === 201
      setUncertain(unknown)
      if (unknown) setError('O resultado do envio ainda é desconhecido. Mantenha este formulário aberto e tente novamente com a mesma operação. A chave será preservada para evitar duplicidade.')
      else { setError(cause.errors ? 'Confira os campos indicados.' : institutionalError(cause)); if (cause.errors) setErrors(cause.errors) }
      getInventoryProduct(product.id).then(setProduct).catch(() => undefined)
      setAttempt(n => n + 1)
    } finally { lock.current = false; setBusy(false) }
  }
  const options = lots?.data ?? []
  return <section className="institutional-section inventory-form-panel"><div className="inventory-balance"><div><span>Saldo físico atual</span><strong>{formatQuantity(product.quantidadeDisponivel)} {product.unidade.sigla}</strong></div><div><span>Quantidade sem lote</span><strong>{formatQuantity(product.quantidadeSemLote ?? '0.000')} {product.unidade.sigla}</strong></div></div>
    <form className="institutional-form inventory-form inventory-movement-form" onSubmit={submit} noValidate>
      {error && <Notice variant="error">{error}</Notice>}
      <fieldset disabled={busy || uncertain || !product.ativo}><legend>Dados da movimentação</legend><p className="institutional-help">Produto: <strong>{product.nome}</strong>. Quantidade é a diferença a movimentar, não o saldo final.</p><div className="institutional-form-grid">
        <div className="institutional-field"><label htmlFor="movement-type">Tipo de movimentação</label><select id="movement-type" value={type} onChange={e => change(() => { setType(e.target.value as InventoryMovementType); setExpense(null); setMode('sem'); setLot(null) })}>{types[operation].map(value => <option key={value} value={value}>{movementLabels[value]}</option>)}</select></div>
        <div className="institutional-field"><label htmlFor="movement-amount">Quantidade ({product.unidade.sigla}) *</label><input id="movement-amount" inputMode="decimal" value={amount} onChange={e => change(() => setAmount(e.target.value))} {...attrs('quantidade')} required />{fieldError('quantidade')}</div>
      </div></fieldset>
      {type === 'ENTRADA_COMPRA' && <fieldset disabled={busy || uncertain || !product.ativo}><legend>Vincular despesa financeira</legend><InventoryExpensePicker value={expense} onChange={value => change(() => setExpense(value))} refresh={attempt} error={errors.despesaId?.[0]} /></fieldset>}
      {type === 'ENTRADA_DOACAO' && <p className="institutional-period-note">Esta operação registra o recebimento de produtos físicos no estoque. Nenhum valor financeiro será lançado automaticamente. Você pode registrar a origem nas observações, sem dados pessoais obrigatórios.</p>}
      <fieldset disabled={busy || uncertain || !product.ativo}><legend>Lote e validade</legend><div className="institutional-field"><label htmlFor="movement-lot-mode">Origem do saldo</label><select id="movement-lot-mode" value={mode} onChange={e => change(() => { setMode(e.target.value as typeof mode); setLot(null) })}><option value="sem" disabled={positive && product.controlaValidade}>Quantidade sem lote</option>{positive && <option value="novo">Informar código de lote</option>}<option value="existente">Selecionar lote registrado</option></select></div>
        {mode === 'novo' && <div className="institutional-form-grid"><div className="institutional-field"><label htmlFor="movement-lot-code">Código do lote *</label><input id="movement-lot-code" value={code} onChange={e => change(() => setCode(e.target.value))} maxLength={100} {...attrs('lote.codigo')} />{fieldError('lote.codigo')}</div><div className="institutional-field"><label htmlFor="movement-expiry">Validade{product.controlaValidade ? ' *' : ' (opcional)'}</label><input id="movement-expiry" type="date" value={expiry} onChange={e => change(() => setExpiry(e.target.value))} {...attrs('lote.validade')} />{fieldError('lote.validade')}</div></div>}
        {mode === 'existente' && <><LoadState loading={key !== loaded} error={lotError} retry={() => setAttempt(n => n + 1)} />{loaded === key && !lotError && <div className="institutional-field"><label htmlFor="movement-lot">Lote registrado *</label><select id="movement-lot" value={lot?.id ?? ''} onChange={e => change(() => setLot(options.find(value => value.id === Number(e.target.value)) ?? null))} {...attrs('loteId')}><option value="">Selecione</option>{lot && !options.some(value => value.id === lot.id) && <option value={lot.id}>{lot.codigo} (selecionado)</option>}{options.map(value => <option key={value.id} value={value.id} disabled={(!positive && !/[1-9]/.test(value.quantidadeDisponivel)) || (type === 'SAIDA_CONSUMO' && value.vencido) || (positive && product.controlaValidade && !value.validade)}>{value.codigo} · {formatQuantity(value.quantidadeDisponivel)} {product.unidade.sigla} · {value.validade ? formatFinancialDate(value.validade) : 'sem validade'}{value.vencido ? ' · vencido' : ''}</option>)}</select>{fieldError('loteId')}{lots && <Pager page={lots.meta.current_page} last={lots.meta.last_page} total={lots.meta.total} onPage={setPage} />}</div>}</>}
        {mode !== 'existente' && fieldError('loteId')}{fieldError('lote')}<p className="institutional-help">{type === 'SAIDA_CONSUMO' ? 'Lotes vencidos ficam indisponíveis para consumo. O descarte justificado continua permitido.' : 'Selecione um único lote ou use a quantidade sem lote. Não há distribuição automática.'}</p>
      </fieldset>
      <fieldset disabled={busy || uncertain || !product.ativo}><legend>Justificativa</legend><div className="institutional-field"><label htmlFor="movement-reason">Motivo *</label><textarea id="movement-reason" value={reason} onChange={e => change(() => setReason(e.target.value))} maxLength={2000} rows={3} {...attrs('motivo')} required />{fieldError('motivo')}</div><div className="institutional-field"><label htmlFor="movement-notes">Observações (opcional)</label><textarea id="movement-notes" value={notes} onChange={e => change(() => setNotes(e.target.value))} maxLength={2000} rows={2} {...attrs('observacoes')} />{fieldError('observacoes')}</div></fieldset>
      {!product.ativo && <Notice variant="error">Produto inativo. Novas movimentações estão bloqueadas.</Notice>}
      <p className="institutional-period-note">O saldo só muda após confirmação do servidor. Esta operação não gera lançamento financeiro.</p>
      <div className="institutional-form-actions"><button className="button button-primary" disabled={busy || (!product.ativo && !uncertain)}>{busy ? 'Registrando…' : uncertain ? 'Reenviar a mesma operação com segurança' : titles[operation]}</button>{!uncertain && <Link className="button button-text" to={`/ong/estoque/${product.id}`}>Cancelar</Link>}</div>
    </form></section>
}
export function InventoryMovementEditor() {
  const { id, operation: rawOperation } = useParams()
  const { user } = useAuth()
  const operation = rawOperation as InventoryOperation
  const allowed = (user?.perfil === 'ADMINISTRADOR' || user?.perfil === 'VOLUNTARIO') && (operation !== 'ajuste' || user?.perfil === 'ADMINISTRADOR') && Object.hasOwn(types, operation)
  const [product, setProduct] = useState<InventoryProduct | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { if (!allowed) return; let active = true; getInventoryProduct(Number(id)).then(value => { if (active) { setProduct(value); setError('') } }).catch(cause => { if (active) setError(institutionalError(cause)) }); return () => { active = false } }, [id, allowed, attempt])
  if (!allowed) return <Notice variant="error">Sua conta não pode executar esta movimentação.</Notice>
  const visible = product?.id === Number(id) ? product : null
  return <><PageHeading title={titles[operation]} back={`/ong/estoque/${id}`} /><InventoryNav /><LoadState loading={!visible && !error} error={error} retry={() => setAttempt(n => n + 1)} />{visible && <MovementForm key={`${id}:${operation}`} initial={visible} operation={operation} />}</>
}
