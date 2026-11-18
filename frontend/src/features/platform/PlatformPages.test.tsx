import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { PlatformOverview, PlatformCreate } from './Platform'
import { PublicTransparencyDetails } from '../public/Transparency'

vi.mock('../auth/auth', () => ({ useAuth: () => ({ status: 'unauthenticated', user: null }) }))
const fetchMock = vi.fn<typeof fetch>()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); document.cookie = 'XSRF-TOKEN=test' })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('mostra situação real e navegação para a ONG na listagem global', async () => {
  fetchMock.mockResolvedValueOnce(json({ data: [{ id: 8, nome: 'ONG F98-DEMO', email: 'ong@patas.test', cidade: 'Manaus', estado: 'AM', status: 'SUSPENSA' }], meta: { current_page: 1, last_page: 1, total: 1 } }))
  render(<MemoryRouter><PlatformOverview /></MemoryRouter>)
  expect(await screen.findByText('ONG F98-DEMO')).toBeTruthy()
  expect(screen.getByText('Suspensa')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Gerenciar ONG' }).getAttribute('href')).toBe('/plataforma/ongs/8')
})

it('cria ONG sem campo de situação e informa erro de validação junto ao campo', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ message: 'Dados inválidos', errors: { nome: ['Nome inválido.'] } }, 400))
  render(<MemoryRouter><PlatformCreate /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Nome da ONG'), { target: { value: 'F98-DEMO' } })
  fireEvent.change(screen.getByLabelText('E-mail institucional'), { target: { value: 'ong@patas.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar ONG' }))
  expect(await screen.findByText('Nome inválido.')).toBeTruthy()
  expect(screen.queryByLabelText('Situação')).toBeNull()
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).not.toHaveProperty('status')
})

it('página pública mostra snapshot sem dados pessoais e respeita indisponibilidade', async () => {
  const report = { id: 4, ong: { id: 8, nome: 'ONG F98-DEMO' }, titulo: 'Demonstrativo', descricao: null, periodoInicio: '2026-11-01', periodoFim: '2026-11-17', publicadoEm: '2026-11-17T12:00:00Z', dados: { receitasRealizadas: '25.50', despesasRealizadas: '0.00', resultadoLiquido: '25.50', quantidadeMovimentacoes: 1, receitasPorCategoria: {}, despesasPorCategoria: {} }, doador: { email: 'privado@patas.test' } }
  fetchMock.mockResolvedValueOnce(json(report))
  render(<MemoryRouter initialEntries={['/transparencia/8/4']}><Routes><Route path="/transparencia/:ongId/:id" element={<PublicTransparencyDetails />} /></Routes></MemoryRouter>)
  expect((await screen.findAllByText('R$ 25,50')).length).toBe(2)
  expect(screen.queryByText('privado@patas.test')).toBeNull()
  expect(fetchMock.mock.calls[0][0]).toContain('/public/ongs/8/transparencia/4')
  await waitFor(() => expect(screen.getByText('ONG F98-DEMO', { exact: false })).toBeTruthy())
})
