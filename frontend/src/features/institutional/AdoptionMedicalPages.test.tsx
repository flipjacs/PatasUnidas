import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AdoptionDetails, AdoptionList } from './Adoptions'
import { MedicalCorrect, MedicalCreate, MedicalDetails, MedicalHistory } from './MedicalRecords'

let perfil = 'ADMINISTRADOR'
vi.mock('../auth/auth', () => ({ useAuth: () => ({ user: { perfil, ongId: 3 } }) }))
const fetchMock = vi.fn<typeof fetch>()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length } })
const adoption = (status = 'PENDENTE') => ({ id: 7, animal: { id: 25, nome: 'Canela' }, ong: { id: 3, nome: 'ONG A' }, solicitante: { id: 12, nome: 'Ana', email: 'ana@patas.test' }, status, mensagem: 'Quero conhecer Canela.', justificativaRejeicao: null, justificativaCancelamento: null, analisadoEm: null, analisadoPor: null, canceladoEm: null, canceladoPor: null, createdAt: '2026-11-16T12:00:00Z', updatedAt: '2026-11-16T12:00:00Z' })
const animal = { id: 25, nome: 'Canela', situacao: 'DISPONIVEL' }
const medical = { id: 5, animal, tipo: 'CONSULTA', titulo: 'Consulta inicial', descricao: 'Avaliação clínica.', dataProcedimento: '2026-11-15', profissionalResponsavel: null, medicamentos: null, observacoes: null, registradoPor: { id: 24, nome: 'Vet' }, createdAt: '2026-11-15T12:00:00Z', updatedAt: '2026-11-15T12:00:00Z' }

beforeEach(() => { perfil = 'ADMINISTRADOR'; vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); document.cookie = 'XSRF-TOKEN=csrf-test' })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('adoções institucionais', () => {
  it('lista e filtra no servidor, preservando navegação de detalhe', async () => {
    fetchMock.mockImplementation(async () => json(page([adoption()])))
    render(<MemoryRouter initialEntries={['/ong/adocoes']}><Routes><Route path="/ong/adocoes" element={<AdoptionList />} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Canela')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'PENDENTE' } })
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('status=PENDENTE'))
    expect((await screen.findByRole('link', { name: 'Analisar solicitação →' })).getAttribute('href')).toBe('/ong/adocoes/7')
  })

  it('exige justificativa na rejeição e atualiza o estado após resposta real', async () => {
    fetchMock.mockImplementation(async input => {
      const url = String(input)
      if (url.includes('/sanctum/')) return json({})
      if (url.endsWith('/rejeitar')) return json(adoption('REJEITADA'))
      return json(fetchMock.mock.calls.some(([path]) => String(path).endsWith('/rejeitar')) ? adoption('REJEITADA') : adoption())
    })
    render(<MemoryRouter initialEntries={['/ong/adocoes/7']}><Routes><Route path="/ong/adocoes/:id" element={<AdoptionDetails />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeitar solicitação' }))
    expect(screen.getByLabelText('Justificativa').hasAttribute('required')).toBe(true)
    fireEvent.change(screen.getByLabelText('Justificativa'), { target: { value: 'Não atende aos critérios.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar pedido' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/rejeitar') && JSON.parse(String(options?.body)).justificativa === 'Não atende aos critérios.')).toBe(true))
  })

  it('aprovação reserva e conclusão exige confirmação de entrega', async () => {
    let status = 'PENDENTE'
    fetchMock.mockImplementation(async input => {
      const url = String(input)
      if (url.includes('/sanctum/')) return json({})
      if (url.endsWith('/aprovar')) { status = 'APROVADA'; return json(adoption(status)) }
      if (url.endsWith('/confirmar-entrega')) { status = 'CONCLUIDA'; return json(adoption(status)) }
      return json(adoption(status))
    })
    render(<MemoryRouter initialEntries={['/ong/adocoes/7']}><Routes><Route path="/ong/adocoes/:id" element={<AdoptionDetails />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar solicitação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reservar animal' }))
    expect(await screen.findByText(/animal está reservado/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect((screen.getByRole('button', { name: 'Concluir adoção' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/Confirmo que o animal foi entregue/))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir adoção' }))
    expect(await screen.findByText(/A adoção foi concluída/)).toBeTruthy()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/confirmar-entrega'))).toBe(true)
  })
})

describe('prontuários institucionais', () => {
  it('mostra histórico filtrado e acesso somente de leitura ao voluntário', async () => {
    perfil = 'VOLUNTARIO'
    fetchMock.mockImplementation(async input => json(String(input).includes('/prontuarios') ? page([medical]) : animal))
    render(<MemoryRouter initialEntries={['/ong/animais/25/prontuarios']}><Routes><Route path="/ong/animais/:animalId/prontuarios" element={<MedicalHistory />} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Consulta inicial')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Novo registro' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'CONSULTA' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('tipo=CONSULTA'))).toBe(true))
  })

  it('cria registro usando somente os campos clínicos autorizados', async () => {
    fetchMock.mockImplementation(async input => String(input).includes('/sanctum/') ? json({}) : String(input).endsWith('/prontuarios') ? json(medical, 201) : json(animal))
    render(<MemoryRouter initialEntries={['/ong/animais/25/prontuarios/novo']}><Routes><Route path="/ong/animais/:animalId/prontuarios/novo" element={<MedicalCreate />} /><Route path="/ong/animais/:animalId/prontuarios/:recordId" element={<p>Registro criado</p>} /></Routes></MemoryRouter>)
    await screen.findByText('Novo registro clínico')
    fireEvent.change(screen.getByLabelText('Data do procedimento'), { target: { value: '2026-11-15' } })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Consulta inicial' } })
    fireEvent.change(screen.getByLabelText('Descrição clínica'), { target: { value: 'Avaliação clínica.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar procedimento' }))
    expect(await screen.findByText('Registro criado')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'POST' && JSON.parse(String(options.body)).titulo === 'Consulta inicial')).toBe(true)
  })

  it('correção exige mudança real e envia justificativa', async () => {
    fetchMock.mockImplementation(async input => String(input).includes('/sanctum/') ? json({}) : json(medical))
    render(<MemoryRouter initialEntries={['/ong/animais/25/prontuarios/5/corrigir']}><Routes><Route path="/ong/animais/:animalId/prontuarios/:recordId/corrigir" element={<MedicalCorrect />} /></Routes></MemoryRouter>)
    await screen.findByDisplayValue('Consulta inicial')
    fireEvent.change(screen.getByLabelText('Justificativa da correção'), { target: { value: 'Ajuste do título.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }))
    expect(await screen.findByText(/Altere ao menos um campo clínico/)).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Consulta revisada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PATCH' && JSON.parse(String(options.body)).justificativa === 'Ajuste do título.')).toBe(true))
  })

  it('detalhe do voluntário não oferece correção', async () => {
    perfil = 'VOLUNTARIO'
    fetchMock.mockResolvedValue(json(medical))
    render(<MemoryRouter initialEntries={['/ong/animais/25/prontuarios/5']}><Routes><Route path="/ong/animais/:animalId/prontuarios/:recordId" element={<MedicalDetails />} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Avaliação clínica.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Corrigir registro' })).toBeNull()
  })
})
