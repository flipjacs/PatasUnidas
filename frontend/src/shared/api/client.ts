const apiBase = (import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8001/api/v1`).replace(/\/+$/, '')
const backendOrigin = new URL(apiBase, window.location.origin).origin

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

function xsrfToken(): string | undefined {
  const cookie = document.cookie.split('; ').find(item => item.startsWith('XSRF-TOKEN='))
  if (!cookie) return undefined
  try { return decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) } catch { return undefined }
}

export async function request<T>(url: string, options: { method?: 'GET' | 'POST'; body?: unknown; expectedStatus?: number } = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    const token = xsrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token
  }
  let response: Response
  try {
    response = await fetch(url, { method, headers, credentials: 'include', ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
  }
  const data = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null
  if (!response.ok || (options.expectedStatus !== undefined && response.status !== options.expectedStatus)) {
    throw new ApiError(response.status, data?.message ?? 'Não foi possível concluir a solicitação.', data?.errors)
  }
  return data as T
}

let csrfRequest: Promise<void> | null = null
export function initializeCsrf(): Promise<void> {
  if (!csrfRequest) {
    csrfRequest = request<unknown>(`${backendOrigin}/sanctum/csrf-cookie`).then(() => undefined).finally(() => { csrfRequest = null })
  }
  return csrfRequest
}

export const apiUrl = (path: string) => `${apiBase}${path}`

export function errorMessage(error: unknown, context: 'login' | 'cadastro' | 'sessao' | 'logout'): string {
  if (!(error instanceof ApiError)) return 'Não foi possível concluir a solicitação. Tente novamente.'
  if (error.status === 0) return error.message
  if (error.status === 401) return context === 'login' ? 'E-mail ou senha inválidos.' : 'Sua sessão não está mais ativa.'
  if (error.status === 403) return 'Você não tem permissão para realizar esta ação.'
  if (error.status === 409) return 'Este e-mail já está cadastrado.'
  if (error.status === 419) return 'A verificação de segurança expirou. Tente novamente.'
  if (error.status === 429) return 'Muitas tentativas. Aguarde um minuto e tente novamente.'
  if (error.status === 400 || error.status === 422) {
    if (error.errors?.nome) return 'Confira o nome informado (até 100 caracteres).'
    if (error.errors?.email) return 'Confira o e-mail informado.'
    if (error.errors?.senha) return 'Confira a senha: use de 12 a 72 caracteres e no máximo 72 bytes.'
    return 'Confira os dados informados e tente novamente.'
  }
  if (error.status >= 500) return 'O servidor está indisponível. Tente novamente mais tarde.'
  return 'Não foi possível concluir a solicitação. Tente novamente.'
}
