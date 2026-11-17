import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AdoptionList, DonationList } from './PersonalLists'
import { PersonalAction } from './PersonalActions'
import { AdoptedAnimals, AdoptedMedicalHistory } from './AdoptedPages'

const fetchMock = vi.fn<typeof fetch>()
const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length, per_page: 15 } })
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const animal = { id: 2, nome: 'Lua', especie: 'CACHORRO', fotoPrincipal: null, ong: { id: 3, nome: 'ONG Teste', cidade: 'Manaus', estado: 'AM' } }

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  document.cookie = 'XSRF-TOKEN=csrf-test'
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('fluxos pessoais', () => {
  it('mostra estado vazio de doações sem afirmar pagamento', async () => {
    fetchMock.mockResolvedValueOnce(json(page([])))
    render(<MemoryRouter><DonationList /></MemoryRouter>)
    expect(await screen.findByText('Nenhuma doação registrada')).toBeTruthy()
  })

  it('cancela somente doação pendente após confirmação e mantém histórico', async () => {
    const pending = { id: 8, ong: { id: 3, nome: 'ONG Teste' }, valor: '25.50', status: 'PENDENTE', createdAt: '2026-11-15T12:00:00Z' }
    fetchMock.mockResolvedValueOnce(json(page([pending])))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ ...pending, status: 'CANCELADA' }))
      .mockResolvedValueOnce(json(page([{ ...pending, status: 'CANCELADA' }])))
    render(<MemoryRouter><DonationList /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar doação' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar doação' }))
    expect(await screen.findByText('Doação pendente cancelada. O registro permanece no histórico.')).toBeTruthy()
    expect(fetchMock.mock.calls[2][0]).toContain('/api/v1/me/donations/8/cancelar')
    expect(screen.queryByRole('button', { name: 'Cancelar doação' })).toBeNull()
  })

  it('não oferece cancelamento para doação confirmada', async () => {
    fetchMock.mockResolvedValueOnce(json(page([{ id: 8, ong: { id: 3, nome: 'ONG Teste' }, valor: '25.50', status: 'CONFIRMADA', confirmadoEm: '2026-11-15T12:00:00Z', createdAt: '2026-11-14T12:00:00Z' }])))
    render(<MemoryRouter><DonationList /></MemoryRouter>)
    expect(await screen.findByText('ONG Teste')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cancelar doação' })).toBeNull()
  })

  it('cancela solicitação apenas após confirmação e resposta da API', async () => {
    const pending = { id: 9, animal: { id: 2, nome: 'Lua' }, ong: { id: 3, nome: 'ONG Teste' }, status: 'PENDENTE', mensagem: null, justificativaRejeicao: null, justificativaCancelamento: null, createdAt: '2026-11-15T12:00:00Z' }
    fetchMock.mockResolvedValueOnce(json(page([pending])))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ ...pending, status: 'CANCELADA' }))
      .mockResolvedValueOnce(json(page([{ ...pending, status: 'CANCELADA' }])))
    render(<MemoryRouter><AdoptionList /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar solicitação' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitação' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    expect(await screen.findByText('Solicitação cancelada. O histórico foi preservado.')).toBeTruthy()
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({ method: 'PATCH' }))
  })

  it('explica que registrar doação não confirma o recebimento', async () => {
    fetchMock.mockResolvedValueOnce(json(animal))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ id: 7, status: 'PENDENTE' }, 201))
    render(<MemoryRouter initialEntries={['/animais/2/doar']}><Routes><Route path="/animais/:id/doar" element={<PersonalAction action="doar" />} /></Routes></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Valor em reais'), { target: { value: '25,50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar doação' }))
    expect(await screen.findByText('A doação está pendente. A ONG confirmará o recebimento manualmente.')).toBeTruthy()
    expect(fetchMock.mock.calls[2][1]?.body).toBe(JSON.stringify({ ongId: 3, valor: '25.50' }))
  })

  it('trata conflito na solicitação sem mostrar sucesso', async () => {
    fetchMock.mockResolvedValueOnce(json(animal))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: 'Animal indisponível para solicitação de adoção.' }, 409))
    render(<MemoryRouter initialEntries={['/animais/2/solicitar']}><Routes><Route path="/animais/:id/solicitar" element={<PersonalAction action="solicitar" />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar solicitação' }))
    expect(await screen.findByText('Animal indisponível para solicitação de adoção.')).toBeTruthy()
    expect(screen.queryByText('Solicitação enviada')).toBeNull()
  })

  it('mostra erro de validação junto ao campo da solicitação', async () => {
    fetchMock.mockResolvedValueOnce(json(animal))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: 'Dados inválidos', errors: { mensagem: ['Mensagem inválida.'] } }, 400))
    render(<MemoryRouter initialEntries={['/animais/2/solicitar']}><Routes><Route path="/animais/:id/solicitar" element={<PersonalAction action="solicitar" />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar solicitação' }))
    expect(await screen.findByText('Mensagem inválida.')).toBeTruthy()
    expect(screen.getByLabelText(/Mensagem para a ONG/).getAttribute('aria-invalid')).toBe('true')
  })

  it('cria apoio mensal com valor decimal e descreve a confirmação manual', async () => {
    fetchMock.mockResolvedValueOnce(json(animal))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ id: 8, status: 'ATIVO', modalidade: 'MENSAL' }, 201))
    render(<MemoryRouter initialEntries={['/animais/2/apadrinhar']}><Routes><Route path="/animais/:id/apadrinhar" element={<PersonalAction action="apadrinhar" />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByLabelText('Apoio mensal'))
    fireEvent.change(screen.getByLabelText('Valor em reais'), { target: { value: '15,90' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar apadrinhamento' }))
    expect(await screen.findByText('As parcelas previstas aparecerão na sua área. Elas não representam cobrança automática.')).toBeTruthy()
    expect(fetchMock.mock.calls[2][1]?.body).toBe(JSON.stringify({ animalId: 2, modalidade: 'MENSAL', valor: '15.90' }))
  })

  it('mantém o prontuário adotado somente para leitura', async () => {
    fetchMock.mockResolvedValueOnce(json(page([{ id: 4, animal: { id: 2, nome: 'Lua' }, tipo: 'VACINA', titulo: 'Vacinação', descricao: 'Dose aplicada.', dataProcedimento: '2026-11-01' }])))
    render(<MemoryRouter initialEntries={['/minha-area/adotados/2/prontuarios']}><Routes><Route path="/minha-area/adotados/:animalId/prontuarios" element={<AdoptedMedicalHistory />} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Vacinação')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /editar|corrigir|excluir|adicionar/i })).toBeNull()
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/me/animais-adotados/2/prontuarios')
  })

  it('identifica animais adotados apenas por adoção formalmente concluída', async () => {
    fetchMock.mockResolvedValueOnce(json(page([
      { id: 1, animal: { id: 2, nome: 'Lua' }, ong: { id: 3, nome: 'ONG Teste' }, status: 'APROVADA' },
      { id: 2, animal: { id: 5, nome: 'Nina' }, ong: { id: 3, nome: 'ONG Teste' }, status: 'CONCLUIDA', adocao: { id: 4, dataEntrega: '2026-11-15' } },
    ])))
    render(<MemoryRouter><AdoptedAnimals /></MemoryRouter>)
    expect(await screen.findByText('Nina')).toBeTruthy()
    expect(screen.queryByText('Lua')).toBeNull()
  })

  it('não consulta prontuário com identificador inválido', async () => {
    render(<MemoryRouter initialEntries={['/minha-area/adotados/invalido/prontuarios']}><Routes><Route path="/minha-area/adotados/:animalId/prontuarios" element={<AdoptedMedicalHistory />} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Animal inválido')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
