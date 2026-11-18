export function formatMoney(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return value
  const [, sign, whole, fraction = ''] = match
  return `${sign}R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(BigInt(whole))},${fraction.padEnd(2, '0')}`
}

export function formatFinancialDate(value: string | null | undefined): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value))
}
