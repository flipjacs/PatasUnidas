import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ExpenseAnalysisPanel } from './ExpenseAnalysisPanel'
import { loadExpenseAnalysis, type ExpenseAnalysis } from './api'
import { ApiError } from '../../shared/api/client'
let perfil = 'ADMINISTRADOR'
vi.mock('../auth/auth', () => ({ useAuth: () => ({ user: { perfil } }) }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), loadExpenseAnalysis: vi.fn() }))
const category = { categoriaId: null, nome: 'Não categorizado', global: null, ativo: null, totalPago: '33.33', quantidade: 2 }
const data: ExpenseAnalysis = { periodo: { de: '2026-01-01', ate: '2026-11-18' }, criteriosTemporais: { pago: 'confirmado_em', pendente: 'created_at', aprovado: 'aprovado_em' }, indicadores: { totalPago: '100.10', quantidadePago: 3, totalPendente: '5.05', quantidadePendente: 1, totalAprovado: '7.07', quantidadeAprovado: 1, quantidadeDespesas: 5, totalPagoSemCategoria: '33.33', categoriaMaiorGasto: category }, categorias: [category, { categoriaId: 9, nome: 'Resgate antigo', global: false, ativo: false, totalPago: '66.77', quantidade: 1 }], meses: [{ competencia: '2026-01', totalPago: '0.00', totalPendente: '0.00', totalAprovado: '0.00', quantidade: 0 }, { competencia: '2026-11', totalPago: '100.10', totalPendente: '5.05', totalAprovado: '7.07', quantidade: 5 }] }
const show = () => render(<MemoryRouter><ExpenseAnalysisPanel /></MemoryRouter>)
beforeEach(() => { perfil = 'ADMINISTRADOR'; vi.mocked(loadExpenseAnalysis).mockReset().mockResolvedValue(data) })
afterEach(() => cleanup())

it('apresenta agregados da API, categorias históricas e meses zerados', async () => {
  show()
  expect(screen.getByRole('status', { name: 'Carregando dados' })).toBeTruthy()
  expect(await screen.findByText('R$ 100,10', { selector: '.expense-indicator-paid dd' })).toBeTruthy()
  expect(screen.getByText('Inativa')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Não categorizado: R\$ 33,33/ })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Consultar competência'), { target: { value: '0' } })
  expect(within(screen.getByText('Consultar competência').closest('.expense-month-detail')!).getAllByText('R$ 0,00')).toHaveLength(3)
  expect(screen.getByRole('button', { name: /jan\/2026: pagas R\$ 0,00/ })).toBeTruthy()
})
it('consulta somente ao aplicar e mantém datas civis sem conversão', async () => {
  show(); await screen.findByLabelText('Consultar competência')
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-11-17' } })
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-11-18' } })
  expect(loadExpenseAnalysis).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }))
  await waitFor(() => expect(loadExpenseAnalysis).toHaveBeenLastCalledWith({ de: '2026-11-17', ate: '2026-11-18' }))
  fireEvent.click(screen.getByRole('button', { name: 'Restaurar período padrão' }))
  await waitFor(() => expect(loadExpenseAnalysis).toHaveBeenLastCalledWith({}))
})
it('bloqueia datas invertidas e intervalos excessivos antes da API', async () => {
  show(); await screen.findByLabelText('Consultar competência')
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-12-01' } })
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }))
  expect(screen.getByRole('alert').textContent).toContain('anterior ou igual')
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2020-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }))
  expect(screen.getByRole('alert').textContent).toContain('1.095 dias')
  expect(loadExpenseAnalysis).toHaveBeenCalledTimes(1)
})
it('exibe estado vazio com totais zerados e filtros disponíveis', async () => {
  vi.mocked(loadExpenseAnalysis).mockResolvedValue({ ...data, categorias: [], indicadores: { ...data.indicadores, quantidadeDespesas: 0, totalPago: '0.00', totalPendente: '0.00', totalAprovado: '0.00', categoriaMaiorGasto: null } })
  show()
  expect(await screen.findByText('Nenhuma despesa neste período')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Aplicar período' })).toBeTruthy()
  expect(screen.queryByRole('group', { name: /Evolução mensal/ })).toBeNull()
})
it.each([403, 422, 0])('trata erro %s e permite nova consulta', async status => {
  vi.mocked(loadExpenseAnalysis).mockRejectedValueOnce(new ApiError(status, 'Confira o período.')).mockResolvedValue(data)
  show()
  expect(await screen.findByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByLabelText('Consultar competência')).toBeTruthy()
})
it('ignora resposta antiga quando um filtro mais recente foi aplicado', async () => {
  let resolveOld!: (value: ExpenseAnalysis) => void
  vi.mocked(loadExpenseAnalysis).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve })).mockResolvedValue(data)
  show()
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-11-18' } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }))
  await screen.findByLabelText('Consultar competência')
  await act(async () => { resolveOld({ ...data, periodo: { de: '2020-01-01', ate: '2020-02-01' } }) })
  expect(screen.queryByText(/01\/01\/2020/)).toBeNull()
})
it('não carrega análise como voluntário', () => {
  perfil = 'VOLUNTARIO'; show()
  expect(loadExpenseAnalysis).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toContain('restrita')
})
