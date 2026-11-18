import { ApiError, apiUrl, initializeCsrf, request } from '../../shared/api/client'
import type { Page, FinancialSummary } from './api'

export type FinancialReport = FinancialSummary & { periodo: { de: string | null; ate: string | null }; semanticaPeriodo: string; quantidadeMovimentacoes: number; receitasPorCategoria: Record<string, string>; despesasPorCategoria: Record<string, string> }
export type PublicReport = { id: number; ong: { id: number; nome: string }; titulo: string; descricao: string | null; periodoInicio: string; periodoFim: string; publicadoEm: string | null; dados: { receitasRealizadas: string; despesasRealizadas: string; resultadoLiquido: string; receitasPorCategoria: Record<string, string>; despesasPorCategoria: Record<string, string>; quantidadeMovimentacoes: number } }
export type InternalReport = PublicReport & { status: 'RASCUNHO' | 'PUBLICADO'; publicadoPor: number | null; despublicadoEm: string | null; createdAt: string; updatedAt: string }
export type ReportInput = { titulo: string; descricao: string | null; periodoInicio: string; periodoFim: string }

function query(params: Record<string, string | number | undefined>) { const search = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)) }); return search.size ? `?${search}` : '' }
async function page<T>(path: string): Promise<Page<T>> { const result = await request<Page<T>>(apiUrl(path)); if (!Array.isArray(result?.data) || !result.meta) throw new ApiError(0, 'Resposta inválida do servidor.'); return result }
async function write<T>(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<T> { await initializeCsrf(); return request<T>(apiUrl(path), { method, ...(body === undefined ? {} : { body }), expectedStatus: method === 'POST' ? 201 : 200 }) }

export const getFinancialReport = (de?: string, ate?: string) => request<FinancialReport>(apiUrl(`/ong/relatorios/financeiro${query({ de, ate })}`))
export const listInternalReports = (params: Record<string, string | number | undefined>) => page<InternalReport>(`/ong/transparencia${query(params)}`)
export const getInternalReport = (id: number) => request<InternalReport>(apiUrl(`/ong/transparencia/${id}`))
export const createInternalReport = (input: ReportInput) => write<InternalReport>('/ong/transparencia', 'POST', input)
export const updateInternalReport = (id: number, input: ReportInput) => write<InternalReport>(`/ong/transparencia/${id}`, 'PATCH', input)
export const setReportPublished = (id: number, published: boolean) => write<InternalReport>(`/ong/transparencia/${id}/${published ? 'publicar' : 'despublicar'}`, 'PATCH')
export const listPublicReports = (ongId: number, pageNumber: number) => page<PublicReport>(`/public/ongs/${ongId}/transparencia${query({ page: pageNumber })}`)
export const getPublicReport = (ongId: number, id: number) => request<PublicReport>(apiUrl(`/public/ongs/${ongId}/transparencia/${id}`))
