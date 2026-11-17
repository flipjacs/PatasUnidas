import { ApiError, apiUrl, initializeCsrf, request } from '../../shared/api/client'

export type Page<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number } }
export type Species = 'CACHORRO' | 'GATO' | 'OUTRO'
export type Sex = 'MACHO' | 'FEMEA' | 'NAO_INFORMADO'
export type Size = 'PEQUENO' | 'MEDIO' | 'GRANDE' | 'NAO_INFORMADO'
export type Situation = 'DISPONIVEL' | 'INDISPONIVEL' | 'EM_PROCESSO_ADOCAO' | 'ADOTADO' | 'FALECIDO'
export type Animal = { id: number; ongId: number; nome: string; especie: Species; sexo: Sex; porte: Size; idadeAproximada: number; descricao: string | null; situacao: Situation; publicado: boolean; fotoPrincipal?: Photo | null; createdAt: string; updatedAt: string }
export type AnimalInput = { nome: string; especie: Species; sexo: Sex; porte: Size; idade_aproximada: number; descricao: string | null }
export type Photo = { id: number; url: string; principal: boolean }
export type Employee = { id: number; ongId: number; nome: string; email: string; perfil: 'VOLUNTARIO' | 'VETERINARIO'; ativo: boolean }
export type AdoptionStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA' | 'CONCLUIDA'
export type InternalAdoption = { id: number; animal: { id: number; nome: string }; ong: { id: number; nome: string }; solicitante: { id: number; nome: string; email: string }; status: AdoptionStatus; mensagem: string | null; justificativaRejeicao: string | null; justificativaCancelamento: string | null; analisadoEm: string | null; analisadoPor: { id: number; nome: string } | null; canceladoEm: string | null; canceladoPor: { id: number; nome: string } | null; adocao?: { id: number; dataEntrega: string } | null; createdAt: string; updatedAt: string }
export type MedicalType = 'CONSULTA' | 'VACINA' | 'VERMIFUGACAO' | 'EXAME' | 'CIRURGIA' | 'TRATAMENTO' | 'MEDICACAO' | 'OBSERVACAO'
export type MedicalRecord = { id: number; animal: { id: number; nome: string }; tipo: MedicalType; titulo: string; descricao: string; dataProcedimento: string; profissionalResponsavel: string | null; medicamentos: string | null; observacoes: string | null; registradoPor: { id: number; nome: string }; createdAt: string; updatedAt: string }
export type MedicalInput = { tipo: MedicalType; titulo: string; descricao: string; dataProcedimento: string; profissionalResponsavel?: string | null; medicamentos?: string | null; observacoes?: string | null }
export type MedicalCorrection = { id: number; createdAt: string; justificativa: string; corrigidoPor: { id: number; nome: string }; dadosAnteriores: MedicalInput; dadosNovos: MedicalInput }
export type Dashboard = {
  periodo: { de: string | null; ate: string | null }; semanticaPeriodo: string
  animais: { total: number; disponiveis: number; indisponiveis: number; emProcessoAdocao: number; adotados: number; falecidos: number; publicados: number }
  clinico: { totalRegistros: number; consultas: number; vacinas: number; exames: number; cirurgias: number }
  adocoes?: { solicitacoesPendentes: number; solicitacoesAprovadas: number; concluidas: number }
  apadrinhamentos?: { ativos: number; parcelasPendentes: number; parcelasVencidas: number }
  doacoes?: { pendentes: number; confirmadas: number; valorConfirmado: string }
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)) })
  return search.size ? `?${search}` : ''
}

async function page<T>(path: string): Promise<Page<T>> {
  const result = await request<Page<T>>(apiUrl(path))
  if (!result || !Array.isArray(result.data) || !result.meta || typeof result.meta.last_page !== 'number') throw new ApiError(0, 'Resposta inválida do servidor.')
  return result
}

async function write<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  await initializeCsrf()
  return request<T>(apiUrl(path), { method, ...(body === undefined ? {} : { body }), expectedStatus: method === 'POST' ? 201 : 200 })
}

export const loadDashboard = (de?: string, ate?: string) => request<Dashboard>(apiUrl(`/ong/dashboard${query({ de, ate })}`))
export const listAnimals = (params: Record<string, string | number | undefined>) => page<Animal>(`/ong/animais${query(params)}`)
export const getAnimal = (id: number) => request<Animal>(apiUrl(`/ong/animais/${id}`))
export const createAnimal = (value: AnimalInput) => write<Animal>('/ong/animais', 'POST', value)
export const updateAnimal = (id: number, value: AnimalInput) => write<Animal>(`/ong/animais/${id}`, 'PATCH', value)
export const changeSituation = (id: number, situacao: 'DISPONIVEL' | 'INDISPONIVEL' | 'FALECIDO') => write<Animal>(`/ong/animais/${id}/situacao`, 'PATCH', { situacao })
export const setPublication = (id: number, published: boolean) => write<Animal>(`/ong/animais/${id}/${published ? 'publicar' : 'despublicar'}`, 'PATCH')
export const listPhotos = async (animalId: number) => (await request<{ data: Photo[] }>(apiUrl(`/ong/animais/${animalId}/fotos`))).data
export const uploadPhoto = (animalId: number, file: File) => { const body = new FormData(); body.append('foto', file); return write<Photo>(`/ong/animais/${animalId}/fotos`, 'POST', body) }
export const setPrimaryPhoto = (animalId: number, photoId: number) => write<Photo>(`/ong/animais/${animalId}/fotos/${photoId}/principal`, 'PATCH')
export const deletePhoto = (animalId: number, photoId: number) => write<{ message: string }>(`/ong/animais/${animalId}/fotos/${photoId}`, 'DELETE')
export const listEmployees = (pageNumber = 1, busca?: string) => page<Employee>(`/ong/funcionarios${query({ page: pageNumber, busca })}`)
export const getEmployee = (id: number) => request<Employee>(apiUrl(`/ong/funcionarios/${id}`))
export const createEmployee = (value: { nome: string; email: string; senha: string; perfil: Employee['perfil'] }) => write<Employee>('/usuarios/internos', 'POST', value)
export const updateEmployee = (id: number, value: { nome: string; email: string }) => write<Employee>(`/ong/funcionarios/${id}`, 'PATCH', value)
export const setEmployeeActive = (id: number, active: boolean) => write<Employee>(`/ong/funcionarios/${id}/${active ? 'ativar' : 'desativar'}`, 'PATCH')
export const listInternalAdoptions = (params: Record<string, string | number | undefined>) => page<InternalAdoption>(`/ong/adoption-requests${query(params)}`)
export const getInternalAdoption = (id: number) => request<InternalAdoption>(apiUrl(`/ong/adoption-requests/${id}`))
export const rejectAdoption = (id: number, justificativa: string) => write<InternalAdoption>(`/ong/adoption-requests/${id}/rejeitar`, 'PATCH', { justificativa })
export const approveAdoption = (id: number) => write<InternalAdoption>(`/ong/adoption-requests/${id}/aprovar`, 'PATCH')
export const cancelAdoptionApproval = (id: number, justificativa: string) => write<InternalAdoption>(`/ong/adoption-requests/${id}/cancelar-aprovacao`, 'PATCH', { justificativa })
export const confirmAdoptionDelivery = async (id: number) => { await initializeCsrf(); return request<InternalAdoption>(apiUrl(`/ong/adoption-requests/${id}/confirmar-entrega`), { method: 'POST', expectedStatus: 200 }) }
export const listMedicalRecords = (animalId: number, params: Record<string, string | number | undefined>) => page<MedicalRecord>(`/ong/animais/${animalId}/prontuarios${query(params)}`)
export const getMedicalRecord = (animalId: number, id: number) => request<MedicalRecord>(apiUrl(`/ong/animais/${animalId}/prontuarios/${id}`))
export const createMedicalRecord = (animalId: number, value: MedicalInput) => write<MedicalRecord>(`/ong/animais/${animalId}/prontuarios`, 'POST', value)
export const correctMedicalRecord = (animalId: number, id: number, value: Partial<MedicalInput> & { justificativa: string }) => write<MedicalRecord>(`/ong/animais/${animalId}/prontuarios/${id}/corrigir`, 'PATCH', value)
export const listMedicalCorrections = (animalId: number, id: number, pageNumber = 1) => page<MedicalCorrection>(`/ong/animais/${animalId}/prontuarios/${id}/correcoes${query({ page: pageNumber })}`)

export function institutionalError(cause: unknown): string {
  if (!(cause instanceof ApiError)) return 'Não foi possível concluir a operação. Tente novamente.'
  if (cause.status === 0) return cause.message
  if (cause.status === 401) return 'Sua sessão expirou. Entre novamente.'
  if (cause.status === 403) return 'Sua conta ou ONG não possui permissão para esta operação.'
  if (cause.status === 404) return 'Registro não encontrado nesta organização.'
  if (cause.status === 409) return cause.message || 'O estado deste registro mudou. Atualize e tente novamente.'
  if (cause.status === 419) return 'A verificação de segurança expirou. Tente novamente.'
  if (cause.status === 400 || cause.status === 422) return Object.values(cause.errors ?? {}).flat()[0] || cause.message || 'Confira os dados informados.'
  if (cause.status === 429) return 'Muitas tentativas. Aguarde e tente novamente.'
  return 'O servidor não conseguiu concluir a operação. Tente novamente.'
}
