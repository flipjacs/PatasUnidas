import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amountInput, cancelAdoption, createDonation, listOwnAdoptions, listOwnDonations, money } from './api'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  document.cookie = 'XSRF-TOKEN=csrf-test'
})

describe('contrato da área pessoal', () => {
  it('preserva valores monetários como strings decimais', () => {
    expect(amountInput(' 1.234,50 ')).toBeNull()
    expect(amountInput('125,50')).toBe('125.50')
    expect(amountInput('0')).toBeNull()
    expect(amountInput('0,001')).toBeNull()
    expect(money('1234567.89')).toBe('R$ 1.234.567,89')
  })

  it('lê a página de solicitações no endpoint próprio', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { current_page: 2, last_page: 3, total: 32, per_page: 15 } }), { status: 200 }))
    const result = await listOwnAdoptions(2)
    expect(result.meta.last_page).toBe(3)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/me/adoption-requests?page=2'), expect.objectContaining({ method: 'GET', credentials: 'include' }))
  })

  it('envia doação pendente sem campos administrativos e com CSRF', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7, status: 'PENDENTE', valor: '25.50' }), { status: 201 }))
    const result = await createDonation(3, '25.50', 'Ajuda demonstrativa')
    expect(result.status).toBe('PENDENTE')
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ ongId: 3, valor: '25.50', mensagem: 'Ajuda demonstrativa' }) }))
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-test' }))
  })

  it('cancela solicitação pela rota do próprio usuário', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 8, status: 'CANCELADA' }), { status: 200 }))
    const result = await cancelAdoption(8)
    expect(result.status).toBe('CANCELADA')
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/me/adoption-requests/8/cancelar')
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'PATCH', credentials: 'include' }))
  })

  it('sinaliza expiração da sessão em rota pessoal protegida', async () => {
    const expired = vi.fn()
    window.addEventListener('patas:session-expired', expired, { once: true })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Unauthenticated.' }), { status: 401 }))
    await expect(listOwnDonations()).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('preserva erro temporário de conexão sem convertê-lo em logout', async () => {
    const expired = vi.fn()
    window.addEventListener('patas:session-expired', expired, { once: true })
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(listOwnDonations()).rejects.toMatchObject({ status: 0 })
    expect(expired).not.toHaveBeenCalled()
    window.removeEventListener('patas:session-expired', expired)
  })
})
