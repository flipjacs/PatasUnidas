import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Button, Notice } from '../../shared/components/Ui'
import { personalError } from './api'
import '../../styles/personal.css'

export function PersonalHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="personal-heading"><div><p className="section-label">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>
}

export function LoadState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="personal-state" role="status">Carregando informações…</div>
  if (error) return <div className="personal-state"><Notice variant="error">{error}</Notice><Button secondary onClick={retry}>Tentar novamente</Button></div>
  return null
}

export function EmptyState({ title, description, to, action }: { title: string; description: string; to?: string; action?: string }) {
  return <section className="personal-state"><h2>{title}</h2><p>{description}</p>{to && action && <Link className="button button-secondary" to={to}>{action}</Link>}</section>
}

export function Pager({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (page: number) => void }) {
  if (lastPage <= 1) return null
  return <nav className="pagination" aria-label="Páginas de resultados">
    <Button secondary disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
    <span aria-live="polite">Página {page} de {lastPage}</span>
    <Button secondary disabled={page >= lastPage} onClick={() => onChange(page + 1)}>Próxima</Button>
  </nav>
}

const statusNames: Record<string, string> = {
  PENDENTE: 'Pendente', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada', CANCELADA: 'Cancelada', CONCLUIDA: 'Concluída',
  CONFIRMADA: 'Confirmada', ATIVO: 'Ativo', ENCERRADO: 'Encerrado',
}

export function Status({ value }: { value: string }) {
  const tone = value === 'REJEITADA' || value === 'CANCELADA' ? 'muted'
    : value === 'PENDENTE' || value === 'APROVADA' ? 'pending'
      : value === 'ENCERRADO' ? 'muted' : 'success'
  return <span className={`personal-status personal-status--${tone}`}>{statusNames[value] ?? value}</span>
}

export function ActionError({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof ApiError && error.status === 409
    ? personalError(error, 'O registro mudou. Atualize a lista.')
    : personalError(error, 'Não foi possível concluir esta ação. Tente novamente.')
  return <Notice variant="error">{message}</Notice>
}

export function ConfirmAction({ label, explanation, busy, onConfirm, onDismiss }: { label: string; explanation: string; busy: boolean; onConfirm: () => void; onDismiss: () => void }) {
  return <div className="personal-confirm"><p>{explanation}</p><div><Button variant="destructive" disabled={busy} aria-busy={busy} onClick={onConfirm}>{busy ? 'Aguarde…' : label}</Button><Button variant="text" disabled={busy} onClick={onDismiss}>Manter registro</Button></div></div>
}
