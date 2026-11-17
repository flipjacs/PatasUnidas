import { ApiError, apiUrl, request } from '../../shared/api/client'

export type Species = 'CACHORRO' | 'GATO' | 'OUTRO'
export type AnimalPhoto = { id: number; url: string; principal: boolean }

export type PublicAnimal = {
  id: number
  nome: string
  especie: Species
  sexo: 'MACHO' | 'FEMEA' | 'NAO_INFORMADO'
  porte: 'PEQUENO' | 'MEDIO' | 'GRANDE' | 'NAO_INFORMADO'
  idadeAproximada: number
  descricao: string | null
  situacao: 'DISPONIVEL'
  fotoPrincipal: AnimalPhoto | null
  fotos?: AnimalPhoto[]
  ong: { id: number; nome: string; cidade: string; estado: string }
}

export type PublicAnimalsPage = {
  data: PublicAnimal[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
}

export async function listPublicAnimals({ especie, page = 1 }: { especie?: Species; page?: number } = {}): Promise<PublicAnimalsPage> {
  const query = new URLSearchParams()
  if (especie) query.set('especie', especie)
  if (page > 1) query.set('page', String(page))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const result = await request<PublicAnimalsPage>(apiUrl(`/public/animais${suffix}`))
  if (!result || !Array.isArray(result.data) || !result.meta || typeof result.meta.total !== 'number') {
    throw new ApiError(0, 'O catálogo não pôde ser carregado. Tente novamente.')
  }
  return result
}

export async function getPublicAnimal(id: number): Promise<PublicAnimal> {
  const result = await request<PublicAnimal>(apiUrl(`/public/animais/${id}`))
  if (!result || typeof result.id !== 'number' || typeof result.nome !== 'string') {
    throw new ApiError(0, 'Os detalhes do animal não puderam ser carregados. Tente novamente.')
  }
  return result
}

export const speciesLabel: Record<Species, string> = {
  CACHORRO: 'Cão',
  GATO: 'Gato',
  OUTRO: 'Outro animal',
}

export function approximateAge(months: number): string {
  if (!Number.isFinite(months) || months < 0) return 'Idade não informada'
  if (months === 0) return 'Menos de 1 mês'
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  const parts = []
  if (years) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`)
  if (remainingMonths) parts.push(`${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`)
  return parts.join(' e ')
}
