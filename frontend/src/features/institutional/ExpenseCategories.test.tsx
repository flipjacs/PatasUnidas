import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { FinanceCreate, FinanceOverview } from './Finance'
import { ExpenseCategoryManager } from './ExpenseCategoryManager'
import { createFinancialMovement, listExpenseCategories, listFinancialMovements, createExpenseCategory, renameExpenseCategory, deactivateExpenseCategory } from './api'

let perfil = 'ADMINISTRADOR'
vi.mock('../auth/auth', () => ({ useAuth: () => ({ user: { perfil } }) }))
vi.mock('./api', async importOriginal => {
  const original = await importOriginal<typeof import('./api')>()
  return { ...original, listExpenseCategories: vi.fn(), listFinancialMovements: vi.fn(), loadFinancialSummary: vi.fn().mockResolvedValue({ receitasRealizadas: '0.00', despesasRealizadas: '0.00', saldoRealizado: '0.00', receitasPendentes: '0.00', despesasPendentes: '0.00', despesasAprovadas: '0.00' }), createFinancialMovement: vi.fn(), createExpenseCategory: vi.fn(), renameExpenseCategory: vi.fn(), deactivateExpenseCategory: vi.fn() }
})
const categories = [{ id: 1, nome: 'Alimentação', codigo: 'ALIMENTACAO', global: true, ativo: true, gerenciavel: false }, { id: 13, nome: 'Resgate', codigo: null, global: false, ativo: true, gerenciavel: true }, { id: 14, nome: 'Antiga', codigo: null, global: false, ativo: false, gerenciavel: true }]
beforeEach(() => {
  perfil = 'ADMINISTRADOR'
  vi.mocked(listExpenseCategories).mockReset().mockResolvedValue(categories)
  vi.mocked(listFinancialMovements).mockReset().mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
  vi.mocked(createFinancialMovement).mockReset().mockResolvedValue({ id: 15 } as never)
  vi.mocked(createExpenseCategory).mockReset().mockResolvedValue({ id: 16 } as never)
  vi.mocked(renameExpenseCategory).mockReset().mockResolvedValue({ id: 13 } as never)
  vi.mocked(deactivateExpenseCategory).mockReset().mockResolvedValue({ id: 13 } as never)
})
afterEach(() => cleanup())

it('cadastra despesa categorizada e omite categoria desativada', async () => {
  render(<MemoryRouter><FinanceCreate /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'DESPESA' } })
  const select = await screen.findByLabelText('Categoria da despesa') as HTMLSelectElement
  await waitFor(() => expect(select.querySelectorAll('optgroup')).toHaveLength(2))
  expect(select.querySelector('option[value="14"]')).toBeNull()
  fireEvent.change(select, { target: { value: '13' } })
  fireEvent.change(screen.getByLabelText('Valor em reais'), { target: { value: '12.34' } })
  fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Resgate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pendência' }))
  await waitFor(() => expect(createFinancialMovement).toHaveBeenCalledWith({ tipo: 'DESPESA', categoriaId: 13, descricao: 'Resgate', valor: '12.34' }))
})

it('mantém cadastro legado quando nenhuma categoria estruturada é selecionada', async () => {
  render(<MemoryRouter><FinanceCreate /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'DESPESA' } })
  fireEvent.change(screen.getByLabelText('Valor em reais'), { target: { value: '8.50' } })
  fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Ração' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pendência' }))
  await waitFor(() => expect(createFinancialMovement).toHaveBeenCalledWith({ tipo: 'DESPESA', categoria: 'OUTRA_DESPESA', descricao: 'Ração', valor: '8.50' }))
})

it('filtra despesas por categoria e ausência de categoria no servidor', async () => {
  render(<MemoryRouter initialEntries={['/ong/financeiro?tipo=DESPESA']}><Routes><Route path="/ong/financeiro" element={<FinanceOverview />} /></Routes></MemoryRouter>)
  const select = await screen.findByLabelText('Categoria da despesa')
  fireEvent.change(select, { target: { value: '13' } })
  await waitFor(() => expect(listFinancialMovements).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: '13', semCategoria: undefined, page: 1 })))
  fireEvent.change(select, { target: { value: 'none' } })
  await waitFor(() => expect(listFinancialMovements).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: undefined, semCategoria: '1', page: 1 })))
})

it('cadastra categoria própria somente como administrador', async () => {
  const view = render(<MemoryRouter><ExpenseCategoryManager categories={categories} onChange={vi.fn()} /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: 'F112-FRONTEND' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar categoria' }))
  await waitFor(() => expect(createExpenseCategory).toHaveBeenCalledWith('F112-FRONTEND'))
  view.unmount(); perfil = 'VOLUNTARIO'
  render(<MemoryRouter><ExpenseCategoryManager categories={categories} onChange={vi.fn()} /></MemoryRouter>)
  expect(screen.queryByLabelText('Nome da categoria')).toBeNull()
})

it('renomeia e desativa categoria própria preservando as globais', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<MemoryRouter><ExpenseCategoryManager categories={categories} onChange={vi.fn()} /></MemoryRouter>)
  expect(screen.getAllByRole('button', { name: 'Renomear' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))
  fireEvent.change(screen.getByLabelText('Novo nome para Resgate'), { target: { value: 'Resgate urgente' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }))
  await waitFor(() => expect(renameExpenseCategory).toHaveBeenCalledWith(13, 'Resgate urgente'))
  fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
  await waitFor(() => expect(deactivateExpenseCategory).toHaveBeenCalledWith(13))
  expect(confirm).toHaveBeenCalled()
  confirm.mockRestore()
})
