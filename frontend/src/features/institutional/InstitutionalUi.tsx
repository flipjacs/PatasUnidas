import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { Notice } from '../../shared/components/Ui'
import '../../styles/institutional.css'

export function PageHeading({ title, description, action, back }: { title: string; description?: string; action?: ReactNode; back?: string }) {
  return <header className="institutional-heading">
    <div>{back && <Link className="institutional-back" to={back}>← Voltar</Link>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action && <div className="institutional-heading-action">{action}</div>}
  </header>
}

export function LoadState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="institutional-loading" role="status" aria-label="Carregando dados"><span /><span /><span /></div>
  if (error) return <div className="institutional-error"><Notice variant="error">{error}</Notice><button className="button button-secondary" type="button" onClick={retry}>Tentar novamente</button></div>
  return null
}

export function Status({ value }: { value: string | boolean }) {
  const key = typeof value === 'boolean' ? (value ? 'ATIVO' : 'INATIVO') : value
  const labels: Record<string, string> = { DISPONIVEL: 'Disponível', INDISPONIVEL: 'Indisponível', EM_PROCESSO_ADOCAO: 'Em adoção', ADOTADO: 'Adotado', FALECIDO: 'Falecido', ATIVO: 'Ativo', INATIVO: 'Inativo', PENDENTE: 'Pendente', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada', CANCELADA: 'Cancelada', CONCLUIDA: 'Concluída', REALIZADA: 'Realizada', CONFIRMADA: 'Confirmada', ENCERRADO: 'Encerrado', SUSPENSA: 'Suspensa', RASCUNHO: 'Rascunho', PUBLICADO: 'Publicado' }
  return <span className={`institutional-status institutional-status--${key.toLowerCase()}`}>{labels[key] ?? key}</span>
}

export function Pager({ page, last, total, onPage }: { page: number; last: number; total: number; onPage: (page: number) => void }) {
  if (last <= 1) return null
  return <nav className="institutional-pager" aria-label="Paginação"><span>{total} registros · Página {page} de {last}</span><div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page >= last} onClick={() => onPage(page + 1)}>Próxima</button></div></nav>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="institutional-empty"><h2>{title}</h2>{children && <p>{children}</p>}</div>
}
