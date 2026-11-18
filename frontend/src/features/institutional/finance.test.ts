import { beforeEach, expect, it, vi } from 'vitest'
import { closeInternalSponsorship, createFinancialMovement, decideFinancialMovement, confirmInternalInstallment, listFinancialMovements, loadFinancialSummary } from './api'
const fetchMock = vi.fn<typeof fetch>()
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); document.cookie = 'XSRF-TOKEN=test' })
it('usa resumo do servidor e pagina o histórico', async () => {
  fetchMock.mockResolvedValueOnce(reply({ saldoRealizado: '85.65' })).mockResolvedValueOnce(reply({ data: [], meta: { current_page: 2, last_page: 2, total: 20 } }))
  expect((await loadFinancialSummary()).saldoRealizado).toBe('85.65')
  await listFinancialMovements({ page: 2, tipo: 'DESPESA' })
  expect(fetchMock.mock.calls[1][0]).toContain('page=2&tipo=DESPESA')
})
it('cria apenas lançamento manual pendente sem campos institucionais', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ status: 'PENDENTE' }, 201))
  await createFinancialMovement({ tipo: 'RECEITA', categoria: 'EVENTO', descricao: 'Feira F97-DEMO', valor: '100.25' })
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ tipo: 'RECEITA', categoria: 'EVENTO', descricao: 'Feira F97-DEMO', valor: '100.25' })
})
it('mantém decisões e confirmação de parcela em endpoints próprios', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ status: 'APROVADA' })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ status: 'CONFIRMADA' }))
  await decideFinancialMovement(2, 'aprovar'); await confirmInternalInstallment(3, 4)
  expect(fetchMock.mock.calls[1][0]).toContain('/movimentacoes/2/aprovar')
  expect(fetchMock.mock.calls[3][0]).toContain('/sponsorships/3/parcelas/4/confirmar')
})
it('propaga conflito de confirmação', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ message: 'Conflito' }, 409))
  await expect(confirmInternalInstallment(3, 4)).rejects.toMatchObject({ status: 409 })
})
it('encerra apoio pela rota institucional com justificativa, sem apagar histórico', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ id: 3, status: 'ENCERRADO' }))
  await closeInternalSponsorship(3, 'Encerramento F97-DEMO')
  expect(fetchMock.mock.calls[1][0]).toContain('/ong/sponsorships/3/encerrar')
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ justificativa: 'Encerramento F97-DEMO' })
})
