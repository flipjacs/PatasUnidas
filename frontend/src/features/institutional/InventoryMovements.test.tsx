import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import * as api from './api'
let perfil = 'ADMINISTRADOR'
vi.mock('../auth/auth', () => ({ useAuth: () => ({ user: { id: 21, perfil } }) }))
const fetchMock = vi.fn<typeof fetch>()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { perfil = 'ADMINISTRADOR'; document.cookie = 'XSRF-TOKEN=test'; vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('aceita a resposta idempotente 200 e envia somente o comando original', async () => {
 fetchMock.mockImplementation(async url => String(url).includes('/sanctum/') ? new Response(null, { status: 204 }) : json({ id: 10 }, 200))
 const value = { produtoId: 1, tipo: 'ENTRADA_COMPRA' as const, quantidade: '2.500', motivo: 'Conferência', chaveOperacao: 'f1420000-0000-4000-8000-000000000001' }
 expect(await api.registerInventoryMovement('entrada', value)).toMatchObject({ id: 10 })
 const sent = fetchMock.mock.calls.find(([url]) => String(url).includes('/entradas'))!
 expect(JSON.parse(String(sent[1]?.body))).toEqual(value)
})

import { InventoryMovementEditor } from './InventoryMovementForm'
import { InventoryDetails } from './Inventory'
import { InventoryHistory, InventoryMovementDetails } from './InventoryHistory'
import { InventoryAlerts } from './InventoryAlerts'
import { InventoryEditor } from './InventoryForm'
import { formatFinancialDate } from './financialFormat'
const category = { id: 1, nome: 'Alimentação', ativo: true, global: true, codigo: 'ALIMENTACAO', gerenciavel: false }
const unit = { id: 2, nome: 'Quilograma', sigla: 'kg', codigo: 'KG', fracionavel: true }
const fixture = { id: 1, nome: 'Ração F142', marca: null, codigoInterno: null, descricao: null, observacoes: null, categoria: category, unidade: unit, local: null, quantidadeMinima: '3.000', quantidadeDisponivel: '20.000', quantidadeSemLote: '15.000', controlaValidade: false, possuiMovimentacoes: false, ativo: true, createdAt: '2026-11-19T12:00:00Z', updatedAt: '2026-11-19T12:00:00Z' }
const expired = { id: 1, produtoId: 1, codigo: 'VENCIDO', validade: '2026-01-01', quantidadeDisponivel: '2.000', vencido: true, createdAt: '2026-01-01' }
const valid = { ...expired, id: 2, codigo: 'ATUAL', validade: '2027-01-31', vencido: false }
const movement = { id: 10, produto: { id: 1, nome: fixture.nome }, tipo: 'ENTRADA_COMPRA', quantidade: '2.500', unidade: unit, saldoAnterior: '20.000', saldoPosterior: '22.500', motivo: 'Conferência física', observacoes: null, responsavel: { id: 21, nome: 'Ana' }, lote: null, chaveOperacao: 'x', createdAt: '2026-11-19T12:00:00Z' }
const paged = (data: unknown[], current = 1) => ({ data, meta: { current_page: current, last_page: 2, total: 16 } })
let current = fixture
let errorStatus = 0
let postCount = 0
let failNetwork = false
function setup() {
 current = fixture; errorStatus = 0; postCount = 0; failNetwork = false
 fetchMock.mockImplementation(async (url, options) => {
  const path = String(url)
  if (path.includes('/sanctum/')) return new Response(null, { status: 204 })
  if (options?.method === 'POST') {
   postCount++
   if (failNetwork && postCount === 1) throw new TypeError('Rede interrompida')
   if (errorStatus) return json({ message: errorStatus === 409 ? 'Saldo insuficiente no lote ou na quantidade sem lote.' : 'Dados inválidos.', errors: errorStatus === 422 ? { motivo: ['Confira a justificativa informada.'] } : undefined }, errorStatus)
   current = { ...current, quantidadeDisponivel: '22.500', possuiMovimentacoes: true }
   return json(movement, postCount > 1 ? 200 : 201)
  }
  if (path.includes('/categorias')) return json({ data: [category] })
  if (path.includes('/unidades')) return json({ data: [unit] })
  if (path.includes('/locais')) return json({ data: [] })
  if (path.includes('/lotes')) return json(paged([expired, valid]))
  if (/\/movimentacoes\/\d+$/.test(path)) return json(movement)
  if (path.includes('/movimentacoes')) return json(paged([movement], path.includes('page=2') ? 2 : 1))
  if (path.includes('/alertas')) return json(paged(path.includes('VENC') ? [{ ...valid, produto: { id: 1, nome: current.nome } }] : [current]))
  return json(current)
 })
}
function editor(operation = 'entrada') {
 return render(<MemoryRouter initialEntries={[`/ong/estoque/1/movimentar/${operation}`]}><Routes><Route path="/ong/estoque/:id/movimentar/:operation" element={<InventoryMovementEditor />} /><Route path="/ong/estoque/:id" element={<InventoryDetails />} /></Routes></MemoryRouter>)
}
async function fill(quantity = '2.500') {
 await screen.findByLabelText('Quantidade (kg) *')
 fireEvent.change(screen.getByLabelText('Quantidade (kg) *'), { target: { value: quantity } })
 fireEvent.change(screen.getByLabelText('Motivo *'), { target: { value: 'Conferência física' } })
}
it('registra entrada e recarrega o saldo confirmado pelo backend', async () => {
 setup(); editor(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
 expect(await screen.findByText('Movimentação #10 confirmada. Saldo atualizado pelo servidor.')).toBeTruthy()
 expect(await screen.findByText('22,5 kg')).toBeTruthy()
 const body = JSON.parse(String(fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')![1]?.body))
 expect(body).toMatchObject({ produtoId: 1, quantidade: '2.500', tipo: 'ENTRADA_COMPRA' }); expect(body.chaveOperacao).toMatch(/^[0-9a-f-]{36}$/)
 expect(body).not.toHaveProperty('ong_id'); expect(body).not.toHaveProperty('saldoPosterior')
})
it('mantém payload e chave após falha de rede e aceita retry 200', async () => {
 setup(); failNetwork = true; editor(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
 const retry = await screen.findByRole('button', { name: 'Reenviar a mesma operação com segurança' })
 expect(screen.getByLabelText('Motivo *').matches(':disabled')).toBe(true)
 const leave = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(leave); expect(leave.defaultPrevented).toBe(true)
 fireEvent.click(retry); await screen.findByText(/Movimentação #10 confirmada/)
 const commands = fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST').map(([, opts]) => JSON.parse(String(opts?.body)))
 expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0])
})
it('trata conflito, atualiza o saldo e gera outra chave quando o comando muda', async () => {
 setup(); errorStatus = 409; editor('saida'); await fill('25'); fireEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
 await screen.findByText('Saldo insuficiente no lote ou na quantidade sem lote.')
 const first = JSON.parse(String(fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')![1]?.body))
 errorStatus = 0; fireEvent.change(screen.getByLabelText('Quantidade (kg) *'), { target: { value: '1' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
 await screen.findByText(/Movimentação #10 confirmada/)
 const last = JSON.parse(String(fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST').at(-1)![1]?.body))
 expect(last.chaveOperacao).not.toBe(first.chaveOperacao); expect(last.tipo).toBe('SAIDA_CONSUMO')
})
it('bloqueia consumo vencido e permite descarte por lote', async () => {
 setup(); editor('saida'); await fill('1'); fireEvent.change(screen.getByLabelText('Origem do saldo'), { target: { value: 'existente' } })
 await screen.findByLabelText('Lote registrado *'); expect((screen.getByRole('option', { name: /VENCIDO/ }) as HTMLOptionElement).disabled).toBe(true)
 fireEvent.change(screen.getByLabelText('Tipo de movimentação'), { target: { value: 'SAIDA_DESCARTE' } }); fireEvent.change(screen.getByLabelText('Origem do saldo'), { target: { value: 'existente' } })
 expect((screen.getByRole('option', { name: /VENCIDO/ }) as HTMLOptionElement).disabled).toBe(false)
 fireEvent.change(screen.getByLabelText('Lote registrado *'), { target: { value: '1' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar saída' })); await screen.findByText(/Movimentação #10 confirmada/)
 expect(JSON.parse(String(fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')![1]?.body))).toMatchObject({ tipo: 'SAIDA_DESCARTE', loteId: 1 })
})
it('exige validade configurada e envia lote novo sem loteId', async () => {
 setup(); current = { ...fixture, controlaValidade: true }; editor(); await fill()
 fireEvent.change(screen.getByLabelText('Código do lote *'), { target: { value: 'NOVO' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
 await screen.findByText('Este produto exige data de validade.'); expect(postCount).toBe(0)
 fireEvent.change(screen.getByLabelText('Validade *'), { target: { value: '2027-01-31' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText(/Movimentação #10 confirmada/)
 const command = JSON.parse(String(fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')![1]?.body)); expect(command.lote).toEqual({ codigo: 'NOVO', validade: '2027-01-31' }); expect(command).not.toHaveProperty('loteId')
})
it('recusa quantidade inválida e fração indivisível sem enviar', async () => {
 setup(); current = { ...fixture, unidade: { ...unit, fracionavel: false } }; editor(); await fill('0'); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText(/Informe uma quantidade maior/)
 fireEvent.change(screen.getByLabelText('Quantidade (kg) *'), { target: { value: '1.5' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Esta unidade exige quantidade inteira.'); expect(postCount).toBe(0)
})
it('exibe validação 422 próxima do campo sem apagar valores', async () => {
 setup(); errorStatus = 422; editor(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Confira a justificativa informada.'); expect((screen.getByLabelText('Motivo *') as HTMLTextAreaElement).value).toBe('Conferência física')
})
it('ajuste exige confirmação e voluntário não acessa o fluxo', async () => {
 setup(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true); editor('ajuste'); await fill('1'); fireEvent.click(screen.getByRole('button', { name: 'Registrar ajuste' })); await screen.findByText(/Movimentação #10 confirmada/); expect(confirm).toHaveBeenCalled(); expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/ajustes'))).toBe(true)
 cleanup(); perfil = 'VOLUNTARIO'; editor('ajuste'); expect(screen.getByText('Sua conta não pode executar esta movimentação.')).toBeTruthy()
})
it('veterinário consulta lotes e histórico sem controles de escrita', async () => {
 setup(); perfil = 'VETERINARIO'; render(<MemoryRouter initialEntries={['/ong/estoque/1']}><Routes><Route path="/ong/estoque/:id" element={<InventoryDetails />} /></Routes></MemoryRouter>); await screen.findByText('Dados do produto'); await screen.findByText('ATUAL'); expect(screen.queryByRole('link', { name: 'Registrar entrada' })).toBeNull(); expect(screen.getByRole('link', { name: 'Consultar histórico' })).toBeTruthy()
})
it('produto inativo não permite registrar movimentação', async () => {
 setup(); current = { ...fixture, ativo: false }; editor(); await screen.findByText('Produto inativo. Novas movimentações estão bloqueadas.'); expect((screen.getByRole('button', { name: 'Registrar entrada' }) as HTMLButtonElement).disabled).toBe(true)
})
it('histórico preserva filtros e paginação e detalhe é somente leitura', async () => {
 setup(); render(<MemoryRouter initialEntries={['/ong/estoque/movimentacoes']}><Routes><Route path="/ong/estoque/movimentacoes" element={<InventoryHistory />} /><Route path="/ong/estoque/movimentacoes/:movementId" element={<InventoryMovementDetails />} /></Routes></MemoryRouter>); await screen.findByText('Conferência física'); fireEvent.change(screen.getByLabelText('ID do produto'), { target: { value: '1' } }); fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' })); await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('produtoId=1'))).toBe(true)); fireEvent.click(await screen.findByRole('button', { name: 'Próxima' })); await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => /produtoId=1.*page=2|page=2.*produtoId=1/.test(String(url)))).toBe(true)); fireEvent.click(await screen.findByRole('link', { name: 'Ver movimento #10' })); await screen.findByText('Registro preservado. Correções exigem uma nova movimentação justificada.'); expect(screen.queryByRole('button', { name: /Excluir|Editar/ })).toBeNull()
})
it('alertas usam o total do servidor, tipo e paginação reais', async () => {
 setup(); render(<MemoryRouter><InventoryAlerts /></MemoryRouter>); await screen.findByText('16 resultados para estoque baixo.'); fireEvent.click(screen.getByRole('button', { name: 'Próxima' })); await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('tipo=BAIXO&page=2'))).toBe(true)); fireEvent.change(screen.getByLabelText('Tipo de alerta'), { target: { value: 'VENCIDO' } }); fireEvent.click(screen.getByRole('button', { name: 'Consultar alertas' })); await screen.findByText('Lote ATUAL'); expect(screen.getByText('Validade: 31/01/2027')).toBeTruthy()
})
it('controle de validade é visível e protegido após movimentação', async () => {
 setup(); current = { ...fixture, controlaValidade: true, possuiMovimentacoes: true }; render(<MemoryRouter initialEntries={['/ong/estoque/1/editar']}><Routes><Route path="/ong/estoque/:id/editar" element={<InventoryEditor />} /></Routes></MemoryRouter>); const check = await screen.findByRole('checkbox', { name: 'Exigir lote e validade nas entradas' }) as HTMLInputElement; expect(check.checked).toBe(true); expect(check.disabled).toBe(true); expect(formatFinancialDate('2026-11-17')).toBe('17/11/2026')
})
it('impede duplo clique durante a confirmação em andamento', async () => {
 setup(); const normal = fetchMock.getMockImplementation()!; let finish: ((response: Response) => void) | undefined
 fetchMock.mockImplementation((url, options) => options?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve }) : normal(url, options))
 editor(); await fill(); const button = screen.getByRole('button', { name: 'Registrar entrada' }); fireEvent.click(button); fireEvent.click(button)
 await waitFor(() => expect(finish).toBeDefined()); expect(fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(1)
 expect((screen.getByRole('button', { name: 'Registrando…' }) as HTMLButtonElement).disabled).toBe(true)
 finish!(json(movement, 201)); await screen.findByText(/Movimentação #10 confirmada/)
})
it('ignora uma resposta antiga de alertas após trocar os critérios', async () => {
 setup(); const normal = fetchMock.getMockImplementation()!; let old: ((response: Response) => void) | undefined
 fetchMock.mockImplementation((url, options) => String(url).includes('tipo=BAIXO') ? new Promise<Response>(resolve => { old = resolve }) : String(url).includes('/alertas') ? Promise.resolve(json(paged([{ ...fixture, nome: 'Produto esgotado atual', quantidadeDisponivel: '0.000' }]))) : normal(url, options))
 render(<MemoryRouter><InventoryAlerts /></MemoryRouter>); await waitFor(() => expect(old).toBeDefined())
 fireEvent.change(screen.getByLabelText('Tipo de alerta'), { target: { value: 'ESGOTADO' } }); fireEvent.click(screen.getByRole('button', { name: 'Consultar alertas' })); await screen.findByText('Produto esgotado atual')
 old!(json(paged([{ ...fixture, nome: 'Resposta obsoleta' }]))); await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByText('Resposta obsoleta')).toBeNull()
})
it('permite reconciliar retry desconhecido mesmo se o produto foi desativado', async () => {
 setup(); const normal = fetchMock.getMockImplementation()!; let first = true
 fetchMock.mockImplementation((url, options) => {
  if (options?.method === 'POST' && first) { first = false; current = { ...fixture, ativo: false }; return Promise.reject(new TypeError('Resposta perdida')) }
  return normal(url, options)
 })
 editor(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' })); await screen.findByText('Produto inativo. Novas movimentações estão bloqueadas.')
 const button = screen.getByRole('button', { name: 'Reenviar a mesma operação com segurança' }) as HTMLButtonElement; expect(button.disabled).toBe(false); fireEvent.click(button); await screen.findByText(/Movimentação #10 confirmada/)
})
