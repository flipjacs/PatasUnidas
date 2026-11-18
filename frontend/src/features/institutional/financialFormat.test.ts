import { expect, it } from 'vitest'
import { formatFinancialDate, formatMoney } from './financialFormat'
it('mostra a data civil de vencimento sem deslocamento de fuso', () => {
  expect(formatFinancialDate('2026-11-17')).toBe('17/11/2026')
})
it('formata centavos grandes sem converter o valor para float', () => {
  expect(formatMoney('9999999999.99')).toBe('R$ 9.999.999.999,99')
  expect(formatMoney('25.50')).toBe('R$ 25,50')
})
