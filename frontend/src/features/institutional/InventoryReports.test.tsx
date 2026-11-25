import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { InventoryReports } from './InventoryReports'
import * as api from './api'

vi.mock('./api', async importOriginal => {
  const original = await importOriginal<typeof import('./api')>()
  return { ...original, listInventoryCategories: vi.fn().mockResolvedValue([]), listInventoryUnits: vi.fn().mockResolvedValue([]), listInventoryProducts: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } }), listCriticalInventoryProducts: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } }), getInventoryReport: vi.fn() }
})
const counts = { totalOperacoes: 0, produtosDistintos: 0, entradas: 0, saidas: 0, ajustes: 0, porTipo: { ENTRADA_COMPRA: 0, ENTRADA_DOACAO: 0, ENTRADA_DEVOLUCAO: 0, SAIDA_CONSUMO: 0, SAIDA_PERDA: 0, SAIDA_DESCARTE: 0, AJUSTE_POSITIVO: 0, AJUSTE_NEGATIVO: 0 } }
const report: api.InventoryReport = { periodo: { de: '2026-01-01', ate: '2026-11-19' }, referencias: { estoqueEm: '2026-11-19T12:00:00Z', validadeEm: '2026-11-19', proximosDias: 30, campoMovimentacao: 'created_at', fusoHorario: 'UTC', classificacao: 'CATEGORIA_ATUAL_DO_PRODUTO' }, filtros: { categoriaId: null, produtoId: null, unidadeId: null, limiteRanking: 10 }, catalogo: { total: 1, ativos: 1, inativos: 0, comSaldo: 1, esgotados: 0, estoqueBaixo: 1 }, movimentacoes: counts, consumoPorCategoria: [], ranking: { criterio: 'FREQUENCIA_SAIDAS_CONSUMO', itens: [] }, meses: [{ competencia: '2026-02', ...counts }], validade: { lotesVencidos: 0, produtosComLotesVencidos: 0, lotesProximos: 0, produtosComLotesProximos: 0, quantidadesPorUnidade: [] } }
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('InventoryReports', () => {
  it('labels current stock separately from historical operations and preserves zero months', async () => {
    vi.mocked(api.getInventoryReport).mockResolvedValue(report)
    render(<MemoryRouter><InventoryReports /></MemoryRouter>)
    expect(await screen.findByText('Situação atual do estoque')).toBeInTheDocument()
    expect(screen.getByText(/As movimentações consideram 2026-01-01 a 2026-11-19/)).toBeInTheDocument()
    expect(screen.getAllByText('fev/2026').length).toBeGreaterThan(0)
    expect(screen.getByText('Sem consumo no período')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ver evolução por tipo em tabela'))
    expect(screen.getByRole('table', { name: 'Operações de estoque por competência' })).toBeInTheDocument()
  })
  it('rejects inverted dates before making another request', async () => {
    vi.mocked(api.getInventoryReport).mockResolvedValue(report)
    render(<MemoryRouter><InventoryReports /></MemoryRouter>)
    await screen.findByText('Situação atual do estoque')
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-20' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-19' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(screen.getByText('A data final deve ser igual ou posterior à inicial.')).toBeInTheDocument()
    await waitFor(() => expect(api.getInventoryReport).toHaveBeenCalledTimes(1))
  })
})
