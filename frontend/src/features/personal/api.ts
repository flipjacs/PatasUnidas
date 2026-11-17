import { ApiError, apiUrl, initializeCsrf, request } from '../../shared/api/client'

export type Page<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number; per_page: number } }

export type OwnAdoption = {
  id: number
  animal: { id: number; nome: string }
  ong: { id: number; nome: string }
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA' | 'CONCLUIDA'
  mensagem: string | null
  justificativaRejeicao: string | null
  justificativaCancelamento: string | null
  analisadoEm: string | null
  canceladoEm: string | null
  adocao?: { id: number; dataEntrega: string } | null
  createdAt: string
}

export type OwnDonation = {
  id: number
  ong: { id: number; nome: string }
  valor: string
  status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA'
  mensagem: string | null
  confirmadoEm: string | null
  canceladoEm: string | null
  createdAt: string
}

export type Sponsorship = {
  id: number
  animal: { id: number; nome: string }
  ong: { id: number; nome: string }
  modalidade: 'UNICO' | 'MENSAL'
  valor: string
  status: 'ATIVO' | 'ENCERRADO'
  dataInicio: string
  dataEncerramento: string | null
  motivoEncerramento: string | null
  proximoVencimento: string | null
  primeiraParcela?: Installment
  createdAt: string
}

export type Installment = {
  id: number
  numero: number
  valor: string
  vencimento: string
  status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA'
  vencida: boolean
  confirmadoEm: string | null
}

export type MedicalRecord = {
  id: number
  animal: { id: number; nome: string }
  tipo: string
  titulo: string
  descricao: string
  dataProcedimento: string
  profissionalResponsavel: string | null
  medicamentos: string | null
  observacoes: string | null
}

function pagePath(path: string, page: number): string {
  return page > 1 ? `${path}?page=${page}` : path
}

async function loadPage<T>(path: string, page = 1): Promise<Page<T>> {
  const result = await request<Page<T>>(apiUrl(pagePath(path, page)))
  if (!result || !Array.isArray(result.data) || !result.meta || typeof result.meta.last_page !== 'number') {
    throw new ApiError(0, 'A resposta do servidor não pôde ser lida. Tente novamente.')
  }
  return result
}

async function write<T>(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<T> {
  await initializeCsrf()
  return request<T>(apiUrl(path), { method, expectedStatus: method === 'POST' ? 201 : 200, ...(body === undefined ? {} : { body }) })
}

export const listOwnAdoptions = (page = 1) => loadPage<OwnAdoption>('/me/adoption-requests', page)
export const createAdoption = (animalId: number, mensagem?: string) => write<OwnAdoption>('/adoption-requests', 'POST', { animalId, ...(mensagem ? { mensagem } : {}) })
export const cancelAdoption = (id: number) => write<OwnAdoption>(`/me/adoption-requests/${id}/cancelar`, 'PATCH')

export const listOwnDonations = (page = 1) => loadPage<OwnDonation>('/me/donations', page)
export const createDonation = (ongId: number, valor: string, mensagem?: string) => write<OwnDonation>('/donations', 'POST', { ongId, valor, ...(mensagem ? { mensagem } : {}) })
export const cancelDonation = (id: number) => write<OwnDonation>(`/me/donations/${id}/cancelar`, 'PATCH')

export const listOwnSponsorships = (page = 1) => loadPage<Sponsorship>('/me/sponsorships', page)
export const getOwnSponsorship = (id: number) => request<Sponsorship>(apiUrl(`/me/sponsorships/${id}`))
export const listOwnInstallments = (id: number, page = 1) => loadPage<Installment>(`/me/sponsorships/${id}/parcelas`, page)
export const createSponsorship = (animalId: number, modalidade: Sponsorship['modalidade'], valor: string) => write<Sponsorship>('/sponsorships', 'POST', { animalId, modalidade, valor })
export const cancelSponsorship = (id: number) => write<Sponsorship>(`/me/sponsorships/${id}/cancelar`, 'PATCH')

export const listAdoptedMedicalRecords = (animalId: number, page = 1) => loadPage<MedicalRecord>(`/me/animais-adotados/${animalId}/prontuarios`, page)
export const getAdoptedMedicalRecord = (animalId: number, recordId: number) => request<MedicalRecord>(apiUrl(`/me/animais-adotados/${animalId}/prontuarios/${recordId}`))

export function money(value: string): string {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return value
  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${integer},${(match[2] ?? '00').padEnd(2, '0')}`
}

export function amountInput(value: string): string | null {
  const normalized = value.trim().replace(',', '.')
  return /^(?!0(?:\.0{1,2})?$)(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(normalized) ? normalized : null
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR').format(parsed)
}

export function personalError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 0) return error.message
  if (error.status === 409) return error.message || 'Este registro mudou. Atualize a página e tente novamente.'
  if (error.status === 419) return 'A verificação de segurança expirou. Tente novamente.'
  if (error.status === 403) return 'Sua conta não tem permissão para esta ação.'
  if (error.status === 404) return 'Este registro não está mais disponível.'
  if (error.status === 401) return 'Sua sessão expirou. Entre novamente.'
  if (error.status === 400 || error.status === 422) return Object.values(error.errors ?? {}).flat()[0] || 'Confira os dados informados.'
  return fallback
}
