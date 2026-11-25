import { ApiError, apiUrl, initializeCsrf, request } from '../../shared/api/client'

export type Page<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number } }
export type InventoryCategory = { id: number; nome: string; ativo: boolean; codigo: string | null; global: boolean; gerenciavel: boolean }
export type InventoryUnit = { id: number; nome: string; codigo: string; sigla: string; fracionavel: boolean }
export type StorageLocation = { id: number; nome: string; descricao: string | null; ativo: boolean }
export type InventoryProduct = { id: number; nome: string; marca: string | null; codigoInterno: string | null; descricao: string | null; observacoes: string | null; categoria: InventoryCategory; unidade: InventoryUnit; local: StorageLocation | null; quantidadeMinima: string; quantidadeDisponivel: string; controlaValidade?: boolean; possuiMovimentacoes?: boolean; quantidadeSemLote?: string; lotesDisponiveis?: number; estadoEstoque?: 'ESGOTADO' | 'BAIXO' | 'REGULAR'; ativo: boolean; createdAt: string; updatedAt: string }
export type InventoryProductInput = { nome: string; categoriaId: number; unidadeId: number; marca?: string | null; codigoInterno?: string | null; descricao?: string | null; observacoes?: string | null; localId?: number | null; quantidadeMinima?: string; controlaValidade?: boolean }
export type InventoryFilters = { busca?: string; categoriaId?: string; unidadeId?: string; localId?: string; ativo?: string; page?: number }
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

export type FinancialStatus = 'PENDENTE' | 'APROVADA' | 'REALIZADA' | 'CANCELADA'
export type ExpenseCategory = { id: number; nome: string; codigo: string | null; global: boolean; ativo: boolean; gerenciavel: boolean }
export type FinancialMovement = { id: number; tipo: 'RECEITA' | 'DESPESA'; categoria: string; categoriaDespesa: Pick<ExpenseCategory, 'id' | 'nome' | 'ativo'> | null; descricao: string; valor: string; status: FinancialStatus; origem: { tipo: string; id: number | null }; registradoPor: { id: number; nome: string } | null; aprovadoPor: { id: number; nome: string } | null; confirmadoPor: { id: number; nome: string } | null; canceladoPor: { id: number; nome: string } | null; aprovadoEm: string | null; confirmadoEm: string | null; canceladoEm: string | null; createdAt: string }
export type FinancialSummary = { receitasRealizadas: string; despesasRealizadas: string; saldoRealizado: string; receitasPendentes: string; despesasPendentes: string; despesasAprovadas: string }
export type CategoryExpense = { categoriaId: number | null; nome: string; global: boolean | null; ativo: boolean | null; totalPago: string; quantidade: number }
export type ExpenseAnalysis = {
  periodo: { de: string; ate: string }
  criteriosTemporais: { pago: 'confirmado_em'; pendente: 'created_at'; aprovado: 'aprovado_em' }
  indicadores: { totalPago: string; quantidadePago: number; totalPendente: string; quantidadePendente: number; totalAprovado: string; quantidadeAprovado: number; quantidadeDespesas: number; totalPagoSemCategoria: string; categoriaMaiorGasto: CategoryExpense | null }
  categorias: CategoryExpense[]
  meses: { competencia: string; totalPago: string; totalPendente: string; totalAprovado: string; quantidade: number }[]
}
export type InternalDonation = { id: number; ong: { id: number; nome: string }; doador: { id: number; nome: string } | null; valor: string; status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA'; mensagem: string | null; confirmadoPor: { id: number; nome: string } | null; canceladoPor: { id: number; nome: string } | null; confirmadoEm: string | null; canceladoEm: string | null; createdAt: string }
export type InternalSponsorship = { id: number; animal: { id: number; nome: string }; padrinho: { id: number; nome: string; email: string }; modalidade: 'UNICO' | 'MENSAL'; valor: string; status: 'ATIVO' | 'ENCERRADO'; dataInicio: string; dataEncerramento: string | null; motivoEncerramento: string | null; justificativaEncerramento: string | null; proximoVencimento: string | null; createdAt: string }
export type SponsorshipInstallment = { id: number; numero: number; valor: string; vencimento: string; status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA'; vencida: boolean; confirmadoEm: string | null; confirmadoPor?: { id: number; nome: string } | null }

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

export const listInventoryProducts = (filters: InventoryFilters) => page<InventoryProduct>(`/ong/estoque/produtos${query(filters)}`)
export const getInventoryProduct = (id: number) => request<InventoryProduct>(apiUrl(`/ong/estoque/produtos/${id}`))
export const createInventoryProduct = (value: InventoryProductInput) => write<InventoryProduct>('/ong/estoque/produtos', 'POST', value)
export const updateInventoryProduct = (id: number, value: Partial<InventoryProductInput>) => write<InventoryProduct>(`/ong/estoque/produtos/${id}`, 'PATCH', value)
export const deactivateInventoryProduct = (id: number) => write<InventoryProduct>(`/ong/estoque/produtos/${id}/desativar`, 'PATCH')
export const listInventoryCategories = async () => (await request<{ data: InventoryCategory[] }>(apiUrl('/ong/estoque/categorias'))).data
export const createInventoryCategory = (nome: string) => write<InventoryCategory>('/ong/estoque/categorias', 'POST', { nome })
export const updateInventoryCategory = (id: number, nome: string) => write<InventoryCategory>(`/ong/estoque/categorias/${id}`, 'PATCH', { nome })
export const deactivateInventoryCategory = (id: number) => write<InventoryCategory>(`/ong/estoque/categorias/${id}/desativar`, 'PATCH')
export const listInventoryUnits = async () => (await request<{ data: InventoryUnit[] }>(apiUrl('/ong/estoque/unidades'))).data
export const listStorageLocations = async () => (await request<{ data: StorageLocation[] }>(apiUrl('/ong/estoque/locais'))).data
export const createStorageLocation = (value: { nome: string; descricao: string | null }) => write<StorageLocation>('/ong/estoque/locais', 'POST', value)
export const updateStorageLocation = (id: number, value: { nome: string; descricao: string | null }) => write<StorageLocation>(`/ong/estoque/locais/${id}`, 'PATCH', value)
export const deactivateStorageLocation = (id: number) => write<StorageLocation>(`/ong/estoque/locais/${id}/desativar`, 'PATCH')

export const loadDashboard = (de?: string, ate?: string) => request<Dashboard>(apiUrl(`/ong/dashboard${query({ de, ate })}`))
export const loadFinancialSummary = (de?: string, ate?: string) => request<FinancialSummary>(apiUrl(`/ong/finance/resumo${query({ de, ate })}`))
export const loadExpenseAnalysis = (period: { de?: string; ate?: string } = {}) => request<ExpenseAnalysis>(apiUrl(`/ong/relatorios/financeiro/analise-despesas${query(period)}`))
export const listFinancialMovements = (params: Record<string, string | number | undefined>) => page<FinancialMovement>(`/ong/finance/movimentacoes${query(params)}`)
export const listExpenseCategories = async () => (await request<{ data: ExpenseCategory[] }>(apiUrl('/ong/finance/categorias-despesa'))).data
export const createExpenseCategory = (nome: string) => write<ExpenseCategory>('/ong/finance/categorias-despesa', 'POST', { nome })
export const renameExpenseCategory = (id: number, nome: string) => write<ExpenseCategory>(`/ong/finance/categorias-despesa/${id}`, 'PATCH', { nome })
export const deactivateExpenseCategory = (id: number) => write<ExpenseCategory>(`/ong/finance/categorias-despesa/${id}/desativar`, 'PATCH')
export const getFinancialMovement = (id: number) => request<FinancialMovement>(apiUrl(`/ong/finance/movimentacoes/${id}`))
export const createFinancialMovement = (value: { tipo: 'RECEITA' | 'DESPESA'; categoria?: string; categoriaId?: number; descricao: string; valor: string }) => write<FinancialMovement>('/ong/finance/movimentacoes', 'POST', value)
export const decideFinancialMovement = (id: number, action: 'aprovar' | 'confirmar-pagamento' | 'confirmar-recebimento' | 'cancelar') => write<FinancialMovement>(`/ong/finance/movimentacoes/${id}/${action}`, 'PATCH')
export const listInternalDonations = (params: Record<string, string | number | undefined>) => page<InternalDonation>(`/ong/donations${query(params)}`)
export const getInternalDonation = (id: number) => request<InternalDonation>(apiUrl(`/ong/donations/${id}`))
export const decideInternalDonation = (id: number, action: 'confirmar' | 'cancelar') => write<InternalDonation>(`/ong/donations/${id}/${action}`, 'PATCH')
export const listInternalSponsorships = (params: Record<string, string | number | undefined>) => page<InternalSponsorship>(`/ong/sponsorships${query(params)}`)
export const getInternalSponsorship = (id: number) => request<InternalSponsorship>(apiUrl(`/ong/sponsorships/${id}`))
export const listInternalInstallments = (id: number, params: Record<string, string | number | undefined>) => page<SponsorshipInstallment>(`/ong/sponsorships/${id}/parcelas${query(params)}`)
export const confirmInternalInstallment = (id: number, installment: number) => write<SponsorshipInstallment>(`/ong/sponsorships/${id}/parcelas/${installment}/confirmar`, 'PATCH')
export const closeInternalSponsorship = (id: number, justificativa: string) => write<InternalSponsorship>(`/ong/sponsorships/${id}/encerrar`, 'PATCH', { justificativa })
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

export type InventoryOperation = 'entrada' | 'saida' | 'ajuste'
export type InventoryMovementType = 'ENTRADA_COMPRA' | 'ENTRADA_DOACAO' | 'ENTRADA_DEVOLUCAO' | 'SAIDA_CONSUMO' | 'SAIDA_PERDA' | 'SAIDA_DESCARTE' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO'
export type InventoryLot = { id: number; produtoId: number; codigo: string; validade: string | null; quantidadeDisponivel: string; vencido: boolean; createdAt: string; produto?: { id: number; nome: string } }
export type InventoryMovement = { id: number; produto: { id: number; nome: string }; tipo: InventoryMovementType; quantidade: string; unidade: InventoryUnit; saldoAnterior: string; saldoPosterior: string; motivo: string; observacoes: string | null; responsavel: { id: number; nome: string }; lote: InventoryLot | null; despesa?: InventoryExpenseLink | null; chaveOperacao: string; createdAt: string }
export type InventoryMovementInput = { produtoId: number; tipo: InventoryMovementType; quantidade: string; motivo: string; observacoes?: string | null; chaveOperacao: string; despesaId?: number; loteId?: number; lote?: { codigo: string; validade: string | null } }
export type InventoryMovementFilters = { despesaId?: string; produtoId?: string; tipo?: string; loteId?: string; responsavelId?: string; de?: string; ate?: string; page?: number }
export type InventoryAlertType = 'BAIXO' | 'ESGOTADO' | 'VENCIDO' | 'PROXIMO_VENCIMENTO'
export async function registerInventoryMovement(operation: InventoryOperation, value: InventoryMovementInput) {
  await initializeCsrf()
  const routes = { entrada: 'entradas', saida: 'saidas', ajuste: 'ajustes' }
  return request<InventoryMovement>(apiUrl(`/ong/estoque/${routes[operation]}`), { method: 'POST', body: value })
}
export const listInventoryMovements = (filters: InventoryMovementFilters) => page<InventoryMovement>(`/ong/estoque/movimentacoes${query(filters)}`)
export const getInventoryMovement = (id: number) => request<InventoryMovement>(apiUrl(`/ong/estoque/movimentacoes/${id}`))
export const listInventoryLots = (productId: number, currentPage = 1) => page<InventoryLot>(`/ong/estoque/produtos/${productId}/lotes${query({ page: currentPage })}`)
export function listInventoryAlerts(type: 'BAIXO' | 'ESGOTADO', currentPage?: number, days?: number): Promise<Page<InventoryProduct>>
export function listInventoryAlerts(type: 'VENCIDO' | 'PROXIMO_VENCIMENTO', currentPage?: number, days?: number): Promise<Page<InventoryLot>>
export function listInventoryAlerts(type: InventoryAlertType, currentPage = 1, days = 30): Promise<Page<InventoryProduct> | Page<InventoryLot>> {
  return page<InventoryProduct | InventoryLot>(`/ong/estoque/alertas${query({ tipo: type, page: currentPage, ...(type === 'PROXIMO_VENCIMENTO' ? { dias: days } : {}) })}`) as Promise<Page<InventoryProduct> | Page<InventoryLot>>
}

export type InventoryExpenseLink = { id: number; descricao?: string; status?: FinancialStatus }
export type InventoryExpense = Pick<FinancialMovement, 'id' | 'descricao' | 'valor' | 'status' | 'categoriaDespesa' | 'createdAt'>
export const listInventoryExpenses = (filters: { page?: number; status?: FinancialStatus } = {}) => page<InventoryExpense>(`/ong/finance/movimentacoes${query({ vinculavelEstoque: '1', ...filters })}`)

export type InventoryReportFilters = { de?: string; ate?: string; categoriaId?: string; produtoId?: string; unidadeId?: string }
export type InventoryReportCounts = { totalOperacoes: number; produtosDistintos: number; entradas: number; saidas: number; ajustes: number; porTipo: Record<InventoryMovementType, number> }
export type InventoryReportUnit = Pick<InventoryUnit, 'id' | 'codigo' | 'sigla'>
export type InventoryReportCategory = Pick<InventoryCategory, 'id' | 'nome' | 'ativo' | 'global'>
export type InventoryReport = {
  periodo: { de: string; ate: string }
  referencias: { estoqueEm: string; validadeEm: string; proximosDias: number; campoMovimentacao: 'created_at'; fusoHorario: string; classificacao: 'CATEGORIA_ATUAL_DO_PRODUTO' }
  filtros: { categoriaId: number | null; produtoId: number | null; unidadeId: number | null; limiteRanking: number }
  catalogo: { total: number; ativos: number; inativos: number; comSaldo: number; esgotados: number; estoqueBaixo: number }
  movimentacoes: InventoryReportCounts
  consumoPorCategoria: { categoria: InventoryReportCategory; unidade: InventoryReportUnit; quantidadeConsumida: string; operacoes: number; produtosDistintos: number }[]
  ranking: { criterio: 'FREQUENCIA_SAIDAS_CONSUMO'; itens: { produtoId: number; nome: string; ativo: boolean; categoria: InventoryReportCategory; unidade: InventoryReportUnit; quantidadeConsumida: string; operacoes: number }[] }
  meses: (InventoryReportCounts & { competencia: string })[]
  validade: { lotesVencidos: number; produtosComLotesVencidos: number; lotesProximos: number; produtosComLotesProximos: number; quantidadesPorUnidade: ({ unidade: InventoryReportUnit } & Record<'vencida' | 'proxima' | 'validaAposJanela' | 'semValidade', string>)[] }
}
export type InventoryCriticalProduct = { id: number; nome: string; categoria: Pick<InventoryCategory, 'id' | 'nome' | 'ativo'>; unidade: InventoryReportUnit; quantidadeDisponivel: string; quantidadeMinima: string; estadoEstoque: 'ESGOTADO' | 'BAIXO' }
export const getInventoryReport = (filters: InventoryReportFilters = {}) => request<InventoryReport>(apiUrl(`/ong/estoque/relatorios/resumo${query(filters)}`))
export const listCriticalInventoryProducts = (filters: Omit<InventoryReportFilters, 'de' | 'ate'> & { page?: number } = {}) => page<InventoryCriticalProduct>(`/ong/estoque/relatorios/produtos-criticos${query(filters)}`)
