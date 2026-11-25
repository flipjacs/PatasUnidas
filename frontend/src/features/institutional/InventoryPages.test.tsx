import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { InventoryList, InventoryDetails } from './Inventory'
import { InventoryEditor } from './InventoryForm'
import { InventoryReferences } from './InventoryReferences'
import { InstitutionalFrame } from '../workspace/Workspace'
import { formatQuantity } from './inventoryFormat'

let perfil = 'ADMINISTRADOR'
vi.mock('../auth/auth', () => ({ useAuth: () => ({ user: { id: 21, nome: 'Ana', perfil, ongId: 3, ong: { nome: 'ONG Demo', status: 'ATIVA' } }, status: 'authenticated', logout: vi.fn() }), profileHome: () => '/ong', profileNames: { ADMINISTRADOR: 'Administrador', VOLUNTARIO: 'Voluntário', VETERINARIO: 'Veterinário' } }))
const fetchMock = vi.fn<typeof fetch>()
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const categories = [{ id: 1, nome: 'Alimentação', ativo: true, codigo: 'ALIMENTACAO', global: true, gerenciavel: false }, { id: 9, nome: 'Resgate', ativo: true, codigo: null, global: false, gerenciavel: true }, { id: 10, nome: 'Antiga', ativo: false, codigo: null, global: false, gerenciavel: true }]
const units = [{ id: 2, nome: 'Quilograma', codigo: 'KG', sigla: 'kg', fracionavel: true }, { id: 6, nome: 'Caixa', codigo: 'CAIXA', sigla: 'cx', fracionavel: false }]
const locations = [{ id: 1, nome: 'Depósito', descricao: 'Local principal', ativo: true }, { id: 2, nome: 'Local antigo', descricao: null, ativo: false }]
const product = { id: 1, nome: 'Ração para cães', marca: null, codigoInterno: null, descricao: null, observacoes: null, categoria: categories[0], unidade: units[0], local: locations[0], quantidadeDisponivel: '0.000', quantidadeMinima: '22.500', ativo: true, createdAt: '2026-11-18T12:00:00Z', updatedAt: '2026-11-18T12:00:00Z' }
let currentProduct = product
let writeError = 0
let empty = false
beforeEach(() => {
  perfil = 'ADMINISTRADOR'; writeError = 0; empty = false; currentProduct = product
  document.cookie = 'XSRF-TOKEN=csrf-test'
  fetchMock.mockReset().mockImplementation(async (url, options) => {
    const path = String(url)
    if (path.includes('/sanctum/')) return new Response(null, { status: 204 })
    if (options?.method !== 'GET') {
      if (writeError) return json({ message: 'Dados inválidos.', errors: { nome: ['Nome já utilizado.'] } }, writeError)
      if (path.endsWith('/desativar')) return json({ ...currentProduct, ativo: false })
      return json({ ...currentProduct, ...JSON.parse(String(options?.body || '{}')) }, options?.method === 'POST' ? 201 : 200)
    }
    if (path.includes('/categorias')) return json({ data: categories })
    if (path.includes('/unidades')) return json({ data: units })
    if (path.includes('/locais')) return json({ data: locations })
    if (/\/produtos\/\d+$/.test(path)) return json(currentProduct)
    return json({ data: empty ? [] : [product], meta: { current_page: path.includes('page=2') ? 2 : 1, last_page: 2, total: empty ? 0 : 16 } })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const renderList = () => render(<MemoryRouter initialEntries={['/ong/estoque']}><Routes><Route path="/ong/estoque" element={<InventoryList />} /></Routes></MemoryRouter>)
const renderForm = (edit = false) => render(<MemoryRouter initialEntries={[edit ? '/ong/estoque/1/editar' : '/ong/estoque/novo']}><Routes><Route path="/ong/estoque/novo" element={<InventoryEditor />} /><Route path="/ong/estoque/:id/editar" element={<InventoryEditor />} /><Route path="/ong/estoque/:id" element={<p>Produto salvo</p>} /></Routes></MemoryRouter>)

it('lista produtos, formata saldo e mantém filtros na paginação real', async () => {
  renderList(); expect(await screen.findByText('Ração para cães')).toBeTruthy()
  expect(screen.getByText('0 kg')).toBeTruthy(); expect(screen.getByText('22,5 kg')).toBeTruthy()
  for (const [label, value] of [['Categoria', '1'], ['Unidade', '2'], ['Local principal', '1'], ['Estado', '1']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.change(screen.getByLabelText('Buscar produto pelo nome'), { target: { value: 'Ração' } })
  fireEvent.submit(screen.getByRole('search'))
  await screen.findByRole('button', { name: 'Próxima' }); fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('page=2') && String(url).includes('categoriaId=1') && String(url).includes('ativo=1') && String(url).includes('busca=Ra%C3%A7%C3%A3o'))).toBe(true))
})
it('cadastra produto sem saldo nem ONG e aceita quantidade decimal como string', async () => {
  renderForm(); await screen.findByLabelText('Nome do produto *')
  expect(screen.queryByLabelText(/Quantidade disponível/)).toBeNull()
  fireEvent.change(screen.getByLabelText('Nome do produto *'), { target: { value: 'F132 Ração' } })
  fireEvent.change(screen.getByLabelText('Categoria *'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Unidade de medida *'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Estoque mínimo (kg)'), { target: { value: '2,500' } })
  expect(screen.queryByRole('option', { name: 'Antiga' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar produto' }))
  expect(await screen.findByText('Produto salvo')).toBeTruthy()
  const call = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith('/produtos') && options?.method === 'POST')
  const body = JSON.parse(String(call?.[1]?.body))
  expect(body).toMatchObject({ nome: 'F132 Ração', quantidadeMinima: '2.500', unidadeId: 2, categoriaId: 1 })
  expect(body).not.toHaveProperty('ong_id'); expect(body).not.toHaveProperty('quantidadeDisponivel')
})
it('bloqueia frações em caixas antes do envio e preserva os campos', async () => {
  renderForm(); await screen.findByLabelText('Nome do produto *')
  fireEvent.change(screen.getByLabelText('Nome do produto *'), { target: { value: 'Caixas' } })
  fireEvent.change(screen.getByLabelText('Categoria *'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Unidade de medida *'), { target: { value: '6' } })
  fireEvent.change(screen.getByLabelText('Estoque mínimo (cx)'), { target: { value: '2.5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar produto' }))
  expect(await screen.findByText('Esta unidade exige uma quantidade inteira.')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
})
it('edita somente campos alterados e preserva referências históricas inativas', async () => {
  currentProduct = { ...product, categoria: categories[2], local: locations[1] }
  renderForm(true); await screen.findByLabelText('Nome do produto *')
  fireEvent.change(screen.getByLabelText('Nome do produto *'), { target: { value: 'Nome corrigido' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  expect(await screen.findByText('Produto salvo')).toBeTruthy()
  const call = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({ nome: 'Nome corrigido' })
})
it('mantém dados após erro de validação do servidor', async () => {
  writeError = 422; renderForm(true); await screen.findByLabelText('Nome do produto *')
  fireEvent.change(screen.getByLabelText('Nome do produto *'), { target: { value: 'Nome novo' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  expect(await screen.findByText('Nome já utilizado.')).toBeTruthy()
  expect((screen.getByLabelText('Nome do produto *') as HTMLInputElement).value).toBe('Nome novo')
})
it('veterinário consulta sem ações de escrita e voluntário não desativa', async () => {
  perfil = 'VETERINARIO'; const view = renderList(); await screen.findByText('Ração para cães')
  expect(screen.queryByRole('link', { name: 'Cadastrar produto' })).toBeNull(); view.unmount()
  perfil = 'VOLUNTARIO'; render(<MemoryRouter initialEntries={['/ong/estoque/1']}><Routes><Route path="/ong/estoque/:id" element={<InventoryDetails />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('link', { name: 'Editar produto' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Desativar produto' })).toBeNull()
})
it('administrador pode desativar produto sem exclusão', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<MemoryRouter initialEntries={['/ong/estoque/1']}><Routes><Route path="/ong/estoque/:id" element={<InventoryDetails />} /></Routes></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Desativar produto' }))
  expect(await screen.findByText('Inativo')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/produtos/1/desativar') && options?.method === 'PATCH')).toBe(true)
})
it('categorias globais são somente leitura; administrador cria, renomeia e desativa próprias', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<MemoryRouter><InventoryReferences kind="categorias" /></MemoryRouter>)
  await screen.findByText('Resgate'); expect(screen.getAllByRole('button', { name: 'Renomear' })).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: 'Minha categoria' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar categoria' })); await screen.findByText('Cadastro realizado.')
  fireEvent.click(await screen.findByRole('button', { name: 'Renomear' }))
  fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: 'Novo nome' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' })); await screen.findByText('Dados atualizados.')
  fireEvent.click(await screen.findByRole('button', { name: 'Desativar' })); await screen.findByText(/Desativação realizada/)
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/categorias/9/desativar'))).toBe(true)
})
it('gerencia locais e restringe controles de referências do voluntário', async () => {
  const view = render(<MemoryRouter><InventoryReferences kind="locais" /></MemoryRouter>)
  await screen.findByText('Depósito')
  fireEvent.change(screen.getByLabelText('Nome do local'), { target: { value: 'Sala' } })
  fireEvent.change(screen.getByLabelText('Descrição do local'), { target: { value: 'Clínica' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar local' })); await screen.findByText('Cadastro realizado.')
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' })); fireEvent.change(screen.getByLabelText('Descrição do local'), { target: { value: 'Nova descrição' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' })); await screen.findByText('Dados atualizados.')
  expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/locais/1') && options?.method === 'PATCH')).toBe(true)
  view.unmount(); perfil = 'VOLUNTARIO'
  render(<MemoryRouter><InventoryReferences kind="locais" /></MemoryRouter>)
  await screen.findByText('Depósito'); expect(screen.queryByRole('button', { name: 'Cadastrar local' })).toBeNull()
})
it('identifica estado vazio e conserva Estoque na navegação institucional', async () => {
  empty = true; renderList(); expect(await screen.findByText('Nenhum produto encontrado')).toBeTruthy(); cleanup()
  render(<MemoryRouter initialEntries={['/ong/estoque']}><InstitutionalFrame /></MemoryRouter>)
  const link = screen.getByRole('link', { name: 'Estoque' }); expect(link.getAttribute('aria-current')).toBe('page')
})
it('formata quantidades sem arredondar ou perder precisão', () => {
  expect(formatQuantity('999999999.999')).toBe('999.999.999,999')
  expect(formatQuantity('2.500')).toBe('2,5'); expect(formatQuantity('0.000')).toBe('0')
})
it.each([403, 0])('trata falha %s e permite recuperar a consulta', async status => {
  if (status === 0) fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'))
  else fetchMock.mockResolvedValueOnce(json({ message: 'Sem acesso.' }, status))
  renderList()
  expect(await screen.findByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByText('Ração para cães')).toBeTruthy()
})
