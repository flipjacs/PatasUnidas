import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthContext, type AuthContextValue } from '../auth/auth'
import { InstitutionalFrame } from './Workspace'

const auth: AuthContextValue = {
  status: 'authenticated',
  user: { id: 1, nome: 'Mariana Oliveira', email: 'admin@patas.test', perfil: 'ADMINISTRADOR', ongId: 3, ong: { id: 3, nome: 'Lar dos Bichos do Tarumã', status: 'ATIVA' } },
  sessionError: '', refresh: vi.fn(), login: vi.fn(), logout: vi.fn(),
}

function renderWorkspace() {
  render(<AuthContext.Provider value={auth}><MemoryRouter initialEntries={['/ong']}><Routes>
    <Route path="/ong" element={<InstitutionalFrame />}>
      <Route index element={<p>Visão institucional</p>} />
      <Route path="relatorios" element={<p>Página de relatórios</p>} />
    </Route>
    <Route path="/animais" element={<p>Catálogo público</p>} />
  </Routes></MemoryRouter></AuthContext.Provider>)
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.style.overflow = '' })

it('mantém links inferiores disponíveis e destaca a rota selecionada', () => {
  renderWorkspace()
  expect(screen.getByRole('link', { name: 'Funcionários' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Transparência' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Catálogo de animais' })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: 'Relatórios' }))
  expect(screen.getByText('Página de relatórios')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Relatórios' }).getAttribute('aria-current')).toBe('page')
})

it('fecha o drawer por Escape, devolve foco e libera a página ao navegar', async () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  renderWorkspace()
  const button = screen.getByRole('button', { name: 'Abrir menu' })
  fireEvent.click(button)
  await waitFor(() => expect(document.body.style.overflow).toBe('hidden'))
  expect(button.getAttribute('aria-expanded')).toBe('true')
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('false'))
  expect(document.activeElement).toBe(button)
  expect(document.body.style.overflow).toBe('')

  fireEvent.click(button)
  await waitFor(() => expect(document.body.style.overflow).toBe('hidden'))
  fireEvent.click(screen.getByRole('link', { name: 'Catálogo de animais' }))
  expect(screen.getByText('Catálogo público')).toBeTruthy()
  await waitFor(() => expect(document.body.style.overflow).toBe(''))
})
