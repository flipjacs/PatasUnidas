import type { InventoryLot, InventoryMovementType } from './api'

export function formatQuantity(value: string): string {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(value)
  if (!match) return value
  const decimals = (match[2] ?? '').replace(/0+$/, '')
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(BigInt(match[1])) + (decimals ? `,${decimals}` : '')
}

export const movementLabels: Record<InventoryMovementType, string> = { ENTRADA_COMPRA: 'Entrada por compra', ENTRADA_DOACAO: 'Entrada por doação física', ENTRADA_DEVOLUCAO: 'Entrada por devolução', SAIDA_CONSUMO: 'Saída por consumo', SAIDA_PERDA: 'Saída por perda', SAIDA_DESCARTE: 'Saída por descarte', AJUSTE_POSITIVO: 'Ajuste positivo', AJUSTE_NEGATIVO: 'Ajuste negativo' }
export function lotValidity(lot: InventoryLot) {
  if (!lot.validade) return 'Sem validade registrada'
  if (lot.vencido) return 'Vencido'
  const today = new Date().toISOString().slice(0, 10)
  const boundary = new Date(`${today}T12:00:00Z`); boundary.setUTCDate(boundary.getUTCDate() + 30)
  return lot.validade <= boundary.toISOString().slice(0, 10) ? 'Próximo do vencimento' : 'Válido'
}

export function inventoryExpenseState(value: string): string {
  return ({ PENDENTE: 'Pendente', APROVADA: 'Aprovada, ainda não paga', REALIZADA: 'Paga', CANCELADA: 'Cancelada' } as Record<string, string>)[value] ?? value
}
