import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Dashboard } from './Dashboard'
import { AnimalCreate, AnimalList } from './Animals'
import { EmployeeCreate, EmployeeEdit, EmployeeList } from './Employees'

let perfil = 'ADMINISTRADOR'
vi.mock('../auth/auth', () => ({ useAuth: () => ({ user: { nome: 'Ana', perfil, ongId: 3 } }) }))
const fetchMock = vi.fn<typeof fetch>()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length } })

beforeEach(() => { perfil = 'ADMINISTRADOR'; vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); document.cookie = 'XSRF-TOKEN=csrf-test' })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('área institucional', () => {
  it('dashboard do administrador apresenta apenas agregados retornados pela API', async () => {
    fetchMock.mockResolvedValueOnce(json({ semanticaPeriodo: 'Período por data efetiva.', animais: { total: 3, disponiveis: 2, indisponiveis: 1, emProcessoAdocao: 0, adotados: 0, falecidos: 0, publicados: 1 }, clinico: { totalRegistros: 4, consultas: 2, vacinas: 1, exames: 1, cirurgias: 0 }, adocoes: { solicitacoesPendentes: 2, solicitacoesAprovadas: 0, concluidas: 1 }, apadrinhamentos: { ativos: 1, parcelasPendentes: 0, parcelasVencidas: 0 }, doacoes: { pendentes: 1, confirmadas: 2, valorConfirmado: '25.50' } }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(await screen.findByText('Doações')).toBeTruthy()
    expect(screen.getByText('R$ 25,50')).toBeTruthy()
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/ong/dashboard')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('dashboard do voluntário não exibe valor financeiro mesmo se a resposta contiver o campo', async () => {
    perfil = 'VOLUNTARIO'
    fetchMock.mockResolvedValueOnce(json({ semanticaPeriodo: 'Período por data efetiva.', animais: { total: 1, disponiveis: 1, indisponiveis: 0, emProcessoAdocao: 0, adotados: 0, falecidos: 0, publicados: 1 }, clinico: { totalRegistros: 0, consultas: 0, vacinas: 0, exames: 0, cirurgias: 0 }, doacoes: { pendentes: 1, confirmadas: 1, valorConfirmado: '25.50' } }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(await screen.findByText('Registros clínicos')).toBeTruthy()
    expect(screen.queryByText('R$ 25,50')).toBeNull()
  })

  it('dashboard veterinário não apresenta finanças ou ações de animais', async () => {
    perfil = 'VETERINARIO'
    fetchMock.mockResolvedValueOnce(json({ semanticaPeriodo: 'Período por data efetiva.', animais: { total: 3, disponiveis: 2, indisponiveis: 1, emProcessoAdocao: 0, adotados: 0, falecidos: 0, publicados: 1 }, clinico: { totalRegistros: 4, consultas: 2, vacinas: 1, exames: 1, cirurgias: 0 } }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(await screen.findByText('Registros clínicos')).toBeTruthy()
    expect(screen.queryByText('Doações')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Gerenciar animais' })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('filtros de animais chamam a API e preservam o caminho do retorno', async () => {
    fetchMock.mockResolvedValueOnce(json(page([{ id: 7, nome: 'Luna', especie: 'GATO', situacao: 'DISPONIVEL', publicado: false }])))
      .mockResolvedValueOnce(json(page([{ id: 7, nome: 'Luna', especie: 'GATO', situacao: 'DISPONIVEL', publicado: false }])))
    render(<MemoryRouter initialEntries={['/ong/animais']}><Routes><Route path="/ong/animais" element={<AnimalList />} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Luna')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'GATO' } })
    await waitFor(() => expect(fetchMock.mock.calls[1][0]).toContain('especie=GATO'))
    expect(screen.getByRole('link', { name: 'Abrir detalhes →' }).getAttribute('href')).toBe('/ong/animais/7')
  })

  it('funcionários listados têm apenas ação de detalhe', async () => {
    fetchMock.mockResolvedValueOnce(json(page([{ id: 4, nome: 'Bia', email: 'bia@patas.test', perfil: 'VOLUNTARIO', ativo: true }])))
    render(<MemoryRouter><EmployeeList /></MemoryRouter>)
    expect(await screen.findByText('Bia')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver detalhes →' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /editar|desativar/i })).toBeNull()
  })

  it('apresenta fotografia protegida na lista e preserva a busca na paginação', async () => {
    const animal = { id: 7, nome: 'Luna', especie: 'GATO', situacao: 'DISPONIVEL', publicado: false, fotoPrincipal: { id: 2, url: 'http://127.0.0.1:8001/api/v1/ong/animais/7/fotos/2/arquivo', principal: true } }
    fetchMock.mockResolvedValueOnce(json({ data: [animal], meta: { current_page: 1, last_page: 2, total: 16 } }))
      .mockResolvedValueOnce(json({ data: [animal], meta: { current_page: 1, last_page: 2, total: 16 } }))
      .mockResolvedValueOnce(json({ data: [animal], meta: { current_page: 2, last_page: 2, total: 16 } }))
    render(<MemoryRouter initialEntries={['/ong/animais']}><Routes><Route path="/ong/animais" element={<AnimalList />} /></Routes></MemoryRouter>)
    expect(await screen.findByAltText('Luna, gato')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Buscar animal pelo nome'), { target: { value: 'Luna' } })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() => expect(fetchMock.mock.calls[1][0]).toContain('busca=Luna'))
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(fetchMock.mock.calls[2][0]).toContain('page=2&busca=Luna'))
  })

  it('busca funcionário por e-mail no servidor sem perder o termo na página seguinte', async () => {
    const person = { id: 4, nome: 'Bia', email: 'bia@patas.test', perfil: 'VOLUNTARIO', ativo: true }
    fetchMock.mockResolvedValueOnce(json({ data: [person], meta: { current_page: 1, last_page: 2, total: 16 } }))
      .mockResolvedValueOnce(json({ data: [person], meta: { current_page: 1, last_page: 2, total: 16 } }))
      .mockResolvedValueOnce(json({ data: [person], meta: { current_page: 2, last_page: 2, total: 16 } }))
    render(<MemoryRouter><EmployeeList /></MemoryRouter>)
    expect(await screen.findByText('Bia')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Buscar por nome ou e-mail'), { target: { value: 'bia@patas.test' } })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() => expect(fetchMock.mock.calls[1][0]).toContain('busca=bia%40patas.test'))
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(fetchMock.mock.calls[2][0]).toContain('page=2&busca=bia%40patas.test'))
  })

  it('edita apenas nome e e-mail e preserva valores após validação', async () => {
    const person = { id: 4, nome: 'Bia', email: 'bia@patas.test', perfil: 'VOLUNTARIO', ativo: true }
    fetchMock.mockResolvedValueOnce(json(person)).mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: 'Dados inválidos', errors: { email: ['E-mail em uso.'] } }, 400))
    render(<MemoryRouter initialEntries={['/ong/funcionarios/4/editar']}><Routes><Route path="/ong/funcionarios/:id/editar" element={<EmployeeEdit />} /></Routes></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Bia Rocha' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('E-mail em uso.')).toBeTruthy()
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Bia Rocha')
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ nome: 'Bia Rocha', email: 'bia@patas.test' })
  })

  it('preserva campos do cadastro animal após erro de validação', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: 'Dados inválidos', errors: { nome: ['Nome inválido.'] } }, 400))
    render(<MemoryRouter><AnimalCreate /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Luna' } })
    fireEvent.change(screen.getByLabelText('Idade aproximada em meses'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar animal' }))
    expect(await screen.findByText('Nome inválido.')).toBeTruthy()
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Luna')
    expect(screen.getByLabelText('Nome').getAttribute('aria-invalid')).toBe('true')
  })

  it('cadastro interno nunca oferece perfil administrador nem ONG arbitrária', () => {
    render(<MemoryRouter><EmployeeCreate /></MemoryRouter>)
    expect(screen.getByLabelText('Perfil').querySelectorAll('option')).toHaveLength(2)
    expect(screen.queryByLabelText('ONG')).toBeNull()
    expect(screen.queryByText('Administrador', { selector: 'option' })).toBeNull()
  })
})
