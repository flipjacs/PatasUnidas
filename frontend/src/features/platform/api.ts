import { ApiError, apiUrl, initializeCsrf, request } from '../../shared/api/client'
import type { Page } from '../institutional/api'

export type Ong = { id: number; nome: string; cnpjCpf: string | null; email: string; telefone: string | null; cidade: string | null; estado: string | null; status: 'ATIVA' | 'SUSPENSA' }
export type OngInput = { nome: string; email: string; cnpj_cpf: string | null; telefone: string | null; cidade: string | null; estado: string | null }
export type FirstAdmin = { id: number; nome: string; email: string; perfil: 'ADMINISTRADOR'; ativo: boolean; ongId: number }

async function write<T>(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<T> {
  await initializeCsrf()
  return request<T>(apiUrl(path), { method, ...(body === undefined ? {} : { body }), expectedStatus: method === 'POST' ? 201 : 200 })
}

export async function listOngs(page: number): Promise<Page<Ong>> {
  const result = await request<Page<Ong>>(apiUrl(`/platform/ongs?page=${page}`))
  if (!Array.isArray(result?.data) || !result.meta) throw new ApiError(0, 'Resposta inválida do servidor.')
  return result
}
export const getOng = (id: number) => request<Ong>(apiUrl(`/platform/ongs/${id}`))
export const createOng = (input: OngInput) => write<Ong>('/platform/ongs', 'POST', input)
export const updateOng = (id: number, input: OngInput) => write<Ong>(`/platform/ongs/${id}`, 'PATCH', input)
export const setOngActive = (id: number, active: boolean) => write<Ong>(`/platform/ongs/${id}/${active ? 'reativar' : 'suspender'}`, 'PATCH')
export const createFirstAdmin = (id: number, input: { nome: string; email: string }) => write<FirstAdmin>(`/platform/ongs/${id}/administradores`, 'POST', input)
