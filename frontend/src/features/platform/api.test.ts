import { beforeEach, expect, it, vi } from 'vitest'
import { createFirstAdmin, createOng, listOngs, setOngActive, updateOng } from './api'

const fetchMock = vi.fn<typeof fetch>()
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); document.cookie = 'XSRF-TOKEN=test' })

it('lista ONGs paginadas sem pedir dados globais inexistentes', async () => {
  fetchMock.mockResolvedValueOnce(reply({ data: [{ id: 1, nome: 'ONG F98-DEMO', status: 'SUSPENSA' }], meta: { current_page: 2, last_page: 2, total: 16 } }))
  expect((await listOngs(2)).data[0].status).toBe('SUSPENSA')
  expect(fetchMock.mock.calls[0][0]).toContain('/platform/ongs?page=2')
})

it('envia apenas campos institucionais no cadastro e edição', async () => {
  const input = { nome: 'ONG F98-DEMO', email: 'f98@patas.test', cnpj_cpf: null, telefone: null, cidade: 'Manaus', estado: 'AM' }
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ id: 9, ...input, status: 'SUSPENSA' }, 201)).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ id: 9, ...input, status: 'SUSPENSA' }))
  await createOng(input); await updateOng(9, input)
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual(input)
  expect(fetchMock.mock.calls[3][0]).toContain('/platform/ongs/9')
})

it('usa endpoints separados para situação e primeiro administrador', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ status: 'ATIVA' })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ id: 5, ativo: false }, 201))
  await setOngActive(9, true); await createFirstAdmin(9, { nome: 'Admin F98-DEMO', email: 'admin-f98@patas.test' })
  expect(fetchMock.mock.calls[1][0]).toContain('/platform/ongs/9/reativar')
  expect(fetchMock.mock.calls[3][0]).toContain('/platform/ongs/9/administradores')
  expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({ nome: 'Admin F98-DEMO', email: 'admin-f98@patas.test' })
})

it('propaga conflito na reativação sem ocultar a regra do servidor', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply({ message: 'A ONG precisa de um administrador ativo.' }, 409))
  await expect(setOngActive(9, true)).rejects.toMatchObject({ status: 409 })
})
