import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeSituation, createAnimal, createEmployee, deletePhoto, listAnimals, listPhotos, setEmployeeActive, uploadPhoto } from './api'

const fetchMock = vi.fn<typeof fetch>()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); document.cookie = 'XSRF-TOKEN=csrf-test' })

describe('contratos institucionais', () => {
  it('envia somente filtros reais e paginação para a ONG autenticada', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [], meta: { current_page: 2, last_page: 3, total: 33 } }))
    await listAnimals({ especie: 'GATO', page: 2 })
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/ong/animais?especie=GATO&page=2')
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ credentials: 'include' }))
  })

  it('cadastra animal sem ONG, situação ou publicação definidos pelo cliente', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ id: 5, situacao: 'DISPONIVEL' }, 201))
    await createAnimal({ nome: 'Luna', especie: 'GATO', sexo: 'FEMEA', porte: 'PEQUENO', idade_aproximada: 5, descricao: null })
    const request = fetchMock.mock.calls[1][1]
    expect(JSON.parse(String(request?.body))).toEqual({ nome: 'Luna', especie: 'GATO', sexo: 'FEMEA', porte: 'PEQUENO', idade_aproximada: 5, descricao: null })
    expect(request?.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-test' }))
  })

  it('faz upload multipart e exclui fotografia por rota autenticada', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ id: 9, principal: true }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ message: 'Fotografia removida.' }))
    const file = new File(['imagem'], 'animal.webp', { type: 'image/webp' })
    await uploadPhoto(5, file)
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/ong/animais/5/fotos')
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData)
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string> | undefined
    expect(headers?.['Content-Type']).toBeUndefined()
    await deletePhoto(5, 9)
    expect(fetchMock.mock.calls[3][1]).toEqual(expect.objectContaining({ method: 'DELETE', credentials: 'include' }))
  })

  it('limita mudança de situação à operação específica do backend', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ id: 5, situacao: 'INDISPONIVEL' }))
    await changeSituation(5, 'INDISPONIVEL')
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/ong/animais/5/situacao')
    expect(fetchMock.mock.calls[1][1]?.body).toBe(JSON.stringify({ situacao: 'INDISPONIVEL' }))
  })

  it('funcionário só recebe perfil permitido, sem ongId', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ id: 8, perfil: 'VOLUNTARIO' }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ id: 8, ativo: false }))
    await createEmployee({ nome: 'Bia', email: 'bia@patas.test', senha: 'senhaSegura', perfil: 'VOLUNTARIO' })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ nome: 'Bia', email: 'bia@patas.test', senha: 'senhaSegura', perfil: 'VOLUNTARIO' })
    await setEmployeeActive(8, false)
    expect(fetchMock.mock.calls[3][0]).toContain('/api/v1/ong/funcionarios/8/desativar')
  })

  it('lê lista de fotos sem usar caminhos públicos de storage', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ id: 1, url: 'http://localhost:8001/api/v1/ong/animais/5/fotos/1/arquivo', principal: true }] }))
    const photos = await listPhotos(5)
    expect(photos[0].url).toContain('/api/v1/ong/animais/5/fotos/1/arquivo')
  })
})
