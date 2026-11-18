import { beforeEach, expect, it, vi } from 'vitest'
import { createInternalReport, getFinancialReport, getPublicReport, listInternalReports, listPublicReports, setReportPublished } from './reportsApi'

const fetchMock = vi.fn<typeof fetch>()
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); document.cookie = 'XSRF-TOKEN=test' })

it('consulta relatório financeiro usando filtros de data civil', async () => {
  fetchMock.mockResolvedValueOnce(reply({ saldoRealizado: '85.65', quantidadeMovimentacoes: 3 }))
  expect((await getFinancialReport('2026-11-01', '2026-11-17')).saldoRealizado).toBe('85.65')
  expect(fetchMock.mock.calls[0][0]).toContain('de=2026-11-01&ate=2026-11-17')
})

it('lista, cria e publica demonstrativos pelo contrato institucional', async () => {
  fetchMock.mockResolvedValueOnce(reply({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ id: 3, status: 'RASCUNHO' }, 201)).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ id: 3, status: 'PUBLICADO' }))
  await listInternalReports({ page: 1, status: 'RASCUNHO' })
  await createInternalReport({ titulo: 'F98-DEMO', descricao: null, periodoInicio: '2026-11-01', periodoFim: '2026-11-17' })
  await setReportPublished(3, true)
  expect(fetchMock.mock.calls[0][0]).toContain('/ong/transparencia?page=1&status=RASCUNHO')
  expect(fetchMock.mock.calls[2][1]?.method).toBe('POST')
  expect(fetchMock.mock.calls[4][0]).toContain('/ong/transparencia/3/publicar')
})

it('consulta o público apenas por endpoints públicos e preserva o snapshot', async () => {
  const snapshot = { receitasRealizadas: '25.50', despesasRealizadas: '0.00', resultadoLiquido: '25.50', receitasPorCategoria: {}, despesasPorCategoria: {}, quantidadeMovimentacoes: 1 }
  fetchMock.mockResolvedValueOnce(reply({ data: [{ id: 3, dados: snapshot }], meta: { current_page: 1, last_page: 1, total: 1 } })).mockResolvedValueOnce(reply({ id: 3, dados: snapshot }))
  expect((await listPublicReports(9, 1)).data[0].dados).toEqual(snapshot)
  expect((await getPublicReport(9, 3)).dados.resultadoLiquido).toBe('25.50')
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual([expect.stringContaining('/public/ongs/9/transparencia'), expect.stringContaining('/public/ongs/9/transparencia/3')])
})

it('respeita 404 de demonstrativo despublicado ou ONG suspensa', async () => {
  fetchMock.mockResolvedValueOnce(reply({ message: 'Not Found' }, 404))
  await expect(getPublicReport(9, 3)).rejects.toMatchObject({ status: 404 })
})
