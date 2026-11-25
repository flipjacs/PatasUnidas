import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import * as api from './api'
let perfil = 'ADMINISTRADOR'
vi.mock('../auth/auth', () => ({ useAuth: () => ({ user: { id: 21, perfil } }) }))
const fetchMock = vi.fn<typeof fetch>()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { perfil = 'ADMINISTRADOR'; document.cookie = 'XSRF-TOKEN=test'; vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('consulta a projeção resumida de despesas por página e estado', async () => {
 fetchMock.mockResolvedValue(json({ data: [], meta: { current_page: 2, last_page: 2, total: 16 } }))
 await api.listInventoryExpenses({ page: 2, status: 'PENDENTE' })
 const url = new URL(String(fetchMock.mock.calls[0][0])); expect(url.searchParams.get('vinculavelEstoque')).toBe('1'); expect(url.searchParams.get('page')).toBe('2'); expect(url.searchParams.get('status')).toBe('PENDENTE')
})

import { InventoryMovementEditor } from './InventoryMovementForm'
import { InventoryMovementDetails } from './InventoryHistory'
import { InventoryReceipts } from './InventoryReceipts'
import { FinanceDetails } from './Finance'
const expense: api.InventoryExpense = { id: 33, descricao: 'F152 Compra de suprimentos', valor: '300.00', status: 'PENDENTE', categoriaDespesa: null, createdAt: '2026-11-19T12:00:00Z' }
const second = { ...expense, id: 34, descricao: 'F152 Compra alternativa', status: 'APROVADA' as const }
const product = { id: 1, nome: 'F152 Ração', unidade: { id: 2, codigo: 'KG', nome: 'Quilograma', sigla: 'kg', fracionavel: true }, categoria: { id: 1, nome: 'Alimentação', ativo: true, global: true, gerenciavel: false }, marca: null, codigoInterno: null, descricao: null, observacoes: null, local: null, quantidadeDisponivel: '0.000', quantidadeSemLote: '0.000', quantidadeMinima: '0.000', controlaValidade: false, possuiMovimentacoes: false, ativo: true, createdAt: '2026-11-19T12:00:00Z', updatedAt: '2026-11-19T12:00:00Z' }
const movement = { id: 7, produto: { id: 1, nome: product.nome }, tipo: 'ENTRADA_COMPRA', quantidade: '2.000', unidade: product.unidade, saldoAnterior: '0.000', saldoPosterior: '2.000', motivo: 'Conferência F152', observacoes: null, responsavel: { id: 21, nome: 'Ana' }, lote: null, despesa: { id: 33, descricao: expense.descricao, status: expense.status }, chaveOperacao: 'key', createdAt: expense.createdAt }
let detail: Omit<typeof movement, 'despesa'> & { despesa: api.InventoryExpenseLink | null } = movement
let postStatus = 0
let selectionStatus = 0
let receiptsStatus = 0
let emptySelection = false
let emptyReceipts = false
let network = false
let posts = 0
function page(data: unknown[], current = 1) { return { data, meta: { current_page: current, last_page: data.length ? 2 : 1, total: data.length ? 16 : 0 } } }
function setup() {
 detail = movement; postStatus = 0; selectionStatus = 0; receiptsStatus = 0; emptySelection = false; emptyReceipts = false; network = false; posts = 0
 fetchMock.mockImplementation(async (url, options) => {
  const path = String(url)
  if (path.includes('/sanctum/')) return new Response(null, { status: 204 })
  if (options?.method === 'POST') {
   posts++; if (network && posts === 1) throw new TypeError('Resposta perdida')
   if (postStatus) return json({ message: postStatus === 409 ? 'Despesa indisponível para vínculo de compra.' : 'Dados inválidos.', errors: postStatus === 422 ? { despesaId: ['Selecione uma despesa válida.'] } : undefined }, postStatus)
   return json(detail, posts === 1 ? 201 : 200)
  }
  if (path.includes('vinculavelEstoque=1')) {
   if (selectionStatus) return json({ message: 'Consulta indisponível' }, selectionStatus)
   return json(page(emptySelection ? [] : [path.includes('page=2') ? second : expense], path.includes('page=2') ? 2 : 1))
  }
  if (path.includes('/finance/movimentacoes/')) return json({ ...expense, tipo: 'DESPESA', categoria: 'OUTRA_DESPESA', origem: { tipo: 'MANUAL', id: null }, registradoPor: null, aprovadoPor: null, confirmadoPor: null, canceladoPor: null, aprovadoEm: null, confirmadoEm: null, canceladoEm: null })
  if (path.includes('/lotes')) return json({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
  if (/\/estoque\/movimentacoes\/\d+$/.test(path)) return json(detail)
  if (path.includes('/estoque/movimentacoes')) return receiptsStatus ? json({ message: 'Registro indisponível' }, receiptsStatus) : json(page(emptyReceipts ? [] : [detail], path.includes('page=2') ? 2 : 1))
  return json(product)
 })
}
function form(operation = 'entrada') { return render(<MemoryRouter initialEntries={[`/ong/estoque/1/movimentar/${operation}`]}><Routes><Route path="/ong/estoque/:id/movimentar/:operation" element={<InventoryMovementEditor />} /><Route path="/ong/estoque/:id" element={<p>Entrada confirmada</p>} /></Routes></MemoryRouter>) }
async function fill() { await screen.findByLabelText('Quantidade (kg) *'); fireEvent.change(screen.getByLabelText('Quantidade (kg) *'), { target: { value: '2.000' } }); fireEvent.change(screen.getByLabelText('Motivo *'), { target: { value: 'Conferência F152' } }) }
async function select(id = 33) {
 fireEvent.click(await screen.findByRole('button', { name: /Selecionar despesa \(opcional\)|Escolher outra despesa/ }))
 if (id === 34) fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
 fireEvent.click(await screen.findByRole('radio', { name: `Selecionar despesa #${id}` }))
}
function sent() { return fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST').map(([, options]) => JSON.parse(String(options?.body))) }
it('permite compra sem vínculo e não consulta despesas antes da seleção', async () => {
 setup(); form(); await fill(); expect(fetchMock.mock.calls.some(([url]) => String(url).includes('vinculavelEstoque'))).toBe(false)
 fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Entrada confirmada'); expect(sent()[0]).not.toHaveProperty('despesaId')
})
it('seleciona despesa em outra página e mostra estado financeiro antes de confirmar', async () => {
 setup(); form(); await fill(); await select(34)
 expect(screen.getByText('#34 · F152 Compra alternativa')).toBeTruthy(); expect(screen.getByText('Aprovada, ainda não paga')).toBeTruthy(); expect(screen.getByText('R$ 300,00')).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Entrada confirmada'); expect(sent()[0]).toMatchObject({ despesaId: 34, tipo: 'ENTRADA_COMPRA' })
 expect(fetchMock.mock.calls.some(([url]) => /vinculavelEstoque=1.*page=2/.test(String(url)))).toBe(true)
})
it('trocar compra por doação limpa vínculo e voltar a compra exige nova escolha', async () => {
 setup(); form(); await fill(); await select(); fireEvent.change(screen.getByLabelText('Tipo de movimentação'), { target: { value: 'ENTRADA_DOACAO' } })
 expect(screen.queryByRole('button', { name: 'Escolher outra despesa' })).toBeNull(); expect(screen.getByText(/Nenhum valor financeiro será lançado automaticamente/)).toBeTruthy()
 fireEvent.change(screen.getByLabelText('Tipo de movimentação'), { target: { value: 'ENTRADA_COMPRA' } }); expect(screen.getByText(/Sem despesa selecionada/)).toBeTruthy()
 fireEvent.change(screen.getByLabelText('Tipo de movimentação'), { target: { value: 'ENTRADA_DOACAO' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Entrada confirmada')
 expect(sent()[0].tipo).toBe('ENTRADA_DOACAO'); expect(sent()[0]).not.toHaveProperty('despesaId'); expect(sent()[0]).not.toHaveProperty('valor')
})
it('preserva vínculo e chave em resultado desconhecido, bloqueia edição e recupera com 200', async () => {
 setup(); network = true; form(); await fill(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
 const retry = await screen.findByRole('button', { name: 'Reenviar a mesma operação com segurança' }); expect(screen.getByRole('button', { name: 'Escolher outra despesa' }).matches(':disabled')).toBe(true)
 fireEvent.click(retry); await screen.findByText('Entrada confirmada'); expect(sent()).toHaveLength(2); expect(sent()[1]).toEqual(sent()[0]); expect(sent()[1].despesaId).toBe(33)
})
it('trocar despesa após conflito gera nova intenção e preserva quantidade e motivo', async () => {
 setup(); postStatus = 409; form(); await fill(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Despesa indisponível para vínculo de compra.')
 postStatus = 0; await select(34); expect((screen.getByLabelText('Quantidade (kg) *') as HTMLInputElement).value).toBe('2.000')
 fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Entrada confirmada'); const commands = sent(); expect(commands[1].despesaId).toBe(34); expect(commands[1].chaveOperacao).not.toBe(commands[0].chaveOperacao)
})
it('erro 422 de vínculo fica junto à seleção sem apagar o restante', async () => {
 setup(); postStatus = 422; form(); await fill(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Selecione uma despesa válida.'); expect((screen.getByLabelText('Motivo *') as HTMLTextAreaElement).value).toBe('Conferência F152')
})
it('seleção vazia ou proibida não impede uma entrada sem vínculo', async () => {
 setup(); emptySelection = true; form(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Selecionar despesa (opcional)' })); await screen.findByText('Não há despesas elegíveis para vincular.'); fireEvent.click(screen.getByRole('button', { name: 'Fechar seleção de despesas' })); cleanup()
 setup(); selectionStatus = 403; form(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Selecionar despesa (opcional)' })); await screen.findByText('Sua conta ou ONG não possui permissão para esta operação.'); fireEvent.click(screen.getByRole('button', { name: 'Fechar seleção de despesas' })); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Entrada confirmada'); expect(sent().at(-1)).not.toHaveProperty('despesaId')
})
it('veterinário vê apenas referência e nenhuma navegação financeira mesmo com dados extras', async () => {
 setup(); perfil = 'VETERINARIO'; render(<MemoryRouter initialEntries={['/ong/estoque/movimentacoes/7']}><Routes><Route path="/ong/estoque/movimentacoes/:movementId" element={<InventoryMovementDetails />} /></Routes></MemoryRouter>)
 await screen.findByText('Despesa #33'); expect(screen.queryByText(expense.descricao)).toBeNull(); expect(screen.queryByText(/Estado financeiro atual/)).toBeNull(); expect(screen.queryByRole('link', { name: 'Consultar despesa e recebimentos' })).toBeNull(); expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/finance/'))).toBe(false)
})
it('detalhe sem vínculo é válido e detalhe vinculado permite consulta imutável', async () => {
 setup(); detail = { ...movement, despesa: null }; const ui = render(<MemoryRouter initialEntries={['/ong/estoque/movimentacoes/7']}><Routes><Route path="/ong/estoque/movimentacoes/:movementId" element={<InventoryMovementDetails />} /></Routes></MemoryRouter>); await screen.findByText('Sem despesa vinculada.'); ui.unmount()
 detail = movement; render(<MemoryRouter initialEntries={['/ong/estoque/movimentacoes/7']}><Routes><Route path="/ong/estoque/movimentacoes/:movementId" element={<InventoryMovementDetails />} /></Routes></MemoryRouter>); await screen.findByText('Estado financeiro atual: Pendente.'); expect(screen.getByRole('link', { name: 'Consultar despesa e recebimentos' }).getAttribute('href')).toBe('/ong/financeiro/33'); expect(screen.queryByRole('button', { name: /Trocar|Desvincular|Excluir/ })).toBeNull()
})
it('consulta recebimentos no detalhe financeiro com paginação por despesa', async () => {
 setup(); render(<MemoryRouter initialEntries={['/ong/financeiro/33']}><Routes><Route path="/ong/financeiro/:id" element={<FinanceDetails />} /></Routes></MemoryRouter>); await screen.findByText('Recebimentos de estoque'); await screen.findByText(product.nome); fireEvent.click(screen.getByRole('button', { name: 'Próxima' })); await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => /despesaId=33.*page=2/.test(String(url)))).toBe(true)); expect(screen.getByRole('link', { name: 'Ver movimento #7' })).toBeTruthy()
})
it('recebimentos vazios, externos e proibidos apresentam estados contextuais', async () => {
 setup(); emptyReceipts = true; const ui = render(<MemoryRouter><InventoryReceipts expenseId={33} /></MemoryRouter>); await screen.findByText('Nenhum recebimento de estoque está vinculado a esta despesa.'); ui.unmount()
 emptyReceipts = false; receiptsStatus = 404; const other = render(<MemoryRouter><InventoryReceipts expenseId={999} /></MemoryRouter>); await screen.findByText('Registro não encontrado nesta organização.'); other.unmount()
 receiptsStatus = 403; render(<MemoryRouter><InventoryReceipts expenseId={33} /></MemoryRouter>); await screen.findByText('Sua conta ou ONG não possui permissão para esta operação.')
})
it('múltiplas entradas podem reutilizar a despesa, com intenções independentes', async () => {
 setup(); for (let i = 0; i < 2; i++) { const ui = form(); await fill(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Entrada confirmada'); ui.unmount() }
 const commands = sent(); expect(commands).toHaveLength(2); expect(commands.map(value => value.despesaId)).toEqual([33, 33]); expect(commands[0].chaveOperacao).not.toBe(commands[1].chaveOperacao)
 expect(fetchMock.mock.calls.some(([url, options]) => String(url).includes('/finance/') && options?.method === 'POST')).toBe(false)
})
it('entrada vinculada mantém a trava de duplo clique em requisição pendente', async () => {
 setup(); const normal = fetchMock.getMockImplementation()!; let finish: ((response: Response) => void) | undefined
 fetchMock.mockImplementation((url, options) => options?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve }) : normal(url, options))
 form(); await fill(); await select(); const button = screen.getByRole('button', { name: 'Registrar entrada' }); fireEvent.click(button); fireEvent.click(button); await waitFor(() => expect(finish).toBeDefined()); expect(sent()).toHaveLength(1); expect(sent()[0].despesaId).toBe(33)
 finish!(json(detail, 201)); await screen.findByText('Entrada confirmada')
})
it('troca de estado na seleção ignora resposta antiga sem sobrescrever a página atual', async () => {
 setup(); const normal = fetchMock.getMockImplementation()!; let old: ((response: Response) => void) | undefined
 fetchMock.mockImplementation((url, options) => String(url).includes('vinculavelEstoque=1') && !String(url).includes('status=') ? new Promise<Response>(resolve => { old = resolve }) : normal(url, options))
 form(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Selecionar despesa (opcional)' })); await waitFor(() => expect(old).toBeDefined()); fireEvent.change(screen.getByLabelText('Estado financeiro'), { target: { value: 'PENDENTE' } }); await screen.findByRole('radio', { name: 'Selecionar despesa #33' }); old!(json(page([{ ...expense, id: 99, descricao: 'Despesa obsoleta' }]))); await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByText(/Despesa obsoleta/)).toBeNull()
})
