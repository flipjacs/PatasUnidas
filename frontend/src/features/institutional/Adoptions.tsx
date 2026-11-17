import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { Notice, Photo as AnimalPhoto } from '../../shared/components/Ui'
import { approveAdoption, cancelAdoptionApproval, confirmAdoptionDelivery, getInternalAdoption, institutionalError, listInternalAdoptions, listPhotos, rejectAdoption, type AdoptionStatus, type InternalAdoption, type Page, type Photo } from './api'
import { Empty, LoadState, PageHeading, Pager, Status } from './InstitutionalUi'

const states: AdoptionStatus[] = ['PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA', 'CONCLUIDA']
const stateNames: Record<AdoptionStatus, string> = { PENDENTE: 'Pendente', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada', CANCELADA: 'Cancelada', CONCLUIDA: 'Concluída' }
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '—'

export function AdoptionList() {
  const [search, setSearch] = useSearchParams()
  const [animalTerm, setAnimalTerm] = useState(search.get('animalId') ?? '')
  const [result, setResult] = useState<Page<InternalAdoption> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const location = useLocation()
  const key = search.toString()
  useEffect(() => {
    let active = true
    listInternalAdoptions({ page: search.get('page') || 1, status: search.get('status') || undefined, animalId: search.get('animalId') || undefined })
      .then(data => { if (active) { setResult(data); setError(''); setLoading(false) } })
      .catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } })
    return () => { active = false }
  }, [key, attempt, search])
  function filter(name: string, value: string) { const next = new URLSearchParams(search); if (value) next.set(name, value); else next.delete(name); next.delete('page'); setSearch(next); setLoading(true) }
  return <>
    <PageHeading title="Solicitações de adoção" description="Acompanhe os pedidos recebidos e as decisões da sua ONG." />
    <div className="institutional-toolbar institutional-filters" aria-label="Filtrar solicitações">
      <div><label htmlFor="adoption-status">Situação</label><select id="adoption-status" value={search.get('status') ?? ''} onChange={event => filter('status', event.target.value)}><option value="">Todas</option>{states.map(value => <option key={value} value={value}>{stateNames[value]}</option>)}</select></div>
      <form className="institutional-inline-search" role="search" onSubmit={(event: FormEvent) => { event.preventDefault(); filter('animalId', animalTerm.trim()) }}><label htmlFor="adoption-animal">ID do animal</label><div><input id="adoption-animal" type="number" min="1" step="1" value={animalTerm} onChange={event => setAnimalTerm(event.target.value)} placeholder="Ex.: 25" /><button type="submit" className="button button-secondary">Filtrar</button></div></form>
      {search.size > 0 && <button type="button" className="institutional-clear" onClick={() => { setSearch(new URLSearchParams()); setAnimalTerm(''); setLoading(true) }}>Limpar filtros</button>}
    </div>
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />
    {!loading && !error && result && (result.data.length ? <><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th scope="col">Animal</th><th scope="col">Solicitante</th><th scope="col">Recebida em</th><th scope="col">Situação</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead><tbody>{result.data.map(item => <tr key={item.id}><td data-label="Animal"><strong>{item.animal.nome}</strong><small className="institutional-muted">Solicitação #{item.id}</small></td><td data-label="Solicitante">{item.solicitante.nome}</td><td data-label="Recebida em">{date(item.createdAt)}</td><td data-label="Situação"><Status value={item.status} /></td><td data-label="Ação"><Link className="institutional-row-link" to={`/ong/adocoes/${item.id}`} state={{ from: location.pathname + location.search }}>{item.status === 'PENDENTE' ? 'Analisar' : 'Ver'} solicitação →</Link></td></tr>)}</tbody></table></div><Pager page={result.meta.current_page} last={result.meta.last_page} total={result.meta.total} onPage={page => { const next = new URLSearchParams(search); next.set('page', String(page)); setSearch(next); setLoading(true) }} /></> : <Empty title="Nenhuma solicitação encontrada">{search.size ? 'Ajuste os filtros para ver outros pedidos.' : 'Novos pedidos aparecerão aqui quando forem enviados.'}</Empty>)}
  </>
}

type Decision = 'approve' | 'reject' | 'cancel' | 'complete'
export function AdoptionDetails() {
  const id = Number(useParams().id)
  const location = useLocation()
  const back = (location.state as { from?: string } | null)?.from ?? '/ong/adocoes'
  const [record, setRecord] = useState<InternalAdoption | null>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; getInternalAdoption(id).then(value => { if (active) { setRecord(value); setError(''); setLoading(false); listPhotos(value.animal.id).then(images => { if (active) setPhoto(images.find(image => image.principal) ?? images[0] ?? null) }).catch(() => undefined) } }).catch(cause => { if (active) { setError(institutionalError(cause)); setLoading(false) } }); return () => { active = false } }, [id, attempt])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!decision || busy || (['reject', 'cancel'].includes(decision) && !reason.trim()) || (decision === 'complete' && !deliveryConfirmed)) return
    setBusy(true); setError(''); setFeedback('')
    try {
      if (decision === 'approve') await approveAdoption(id)
      if (decision === 'reject') await rejectAdoption(id, reason.trim())
      if (decision === 'cancel') await cancelAdoptionApproval(id, reason.trim())
      if (decision === 'complete') await confirmAdoptionDelivery(id)
      setRecord(await getInternalAdoption(id)); setDecision(null); setReason(''); setDeliveryConfirmed(false)
      setFeedback(decision === 'approve' ? 'Solicitação aprovada. O animal está reservado; a adoção ainda não foi concluída.' : decision === 'complete' ? 'Entrega confirmada. A adoção foi concluída.' : decision === 'reject' ? 'Solicitação rejeitada; o histórico foi preservado.' : 'Aprovação cancelada. O animal voltou a ficar disponível conforme o servidor.')
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409 ? `O estado desta solicitação mudou. ${institutionalError(cause)}` : institutionalError(cause))
      if (cause instanceof ApiError && cause.status === 409) getInternalAdoption(id).then(setRecord).catch(() => undefined)
    } finally { setBusy(false) }
  }
  return <>
    <PageHeading title={record ? `Solicitação #${record.id}` : 'Solicitação de adoção'} description="Análise e histórico da decisão" back={back} />
    {feedback && <Notice variant="success">{feedback}</Notice>}
    {error && record && <Notice variant="error">{error}</Notice>}
    <LoadState loading={loading} error={!record ? error : ''} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />
    {!loading && record && <div className="institutional-detail-grid"><section className="institutional-section"><div className="institutional-section-head"><div><p className="section-label">Pedido recebido em {date(record.createdAt)}</p><h2>{record.animal.nome}</h2></div><Status value={record.status} /></div>{photo?.url && <div className="institutional-adoption-photo"><AnimalPhoto src={photo.url} name={record.animal.nome} species="animal" /></div>}<dl className="institutional-facts"><div><dt>Animal</dt><dd><Link to={`/ong/animais/${record.animal.id}`}>{record.animal.nome}</Link></dd></div><div><dt>Solicitante</dt><dd>{record.solicitante.nome}</dd></div><div><dt>E-mail</dt><dd>{record.solicitante.email}</dd></div><div><dt>Mensagem</dt><dd>{record.mensagem || 'Nenhuma mensagem enviada.'}</dd></div></dl><div className="institutional-history"><h3>Histórico</h3><p>Solicitação registrada em {date(record.createdAt)}.</p>{record.analisadoEm && <p>Analisada em {date(record.analisadoEm)}{record.analisadoPor ? ` por ${record.analisadoPor.nome}` : ''}.</p>}{record.justificativaRejeicao && <p><strong>Justificativa da rejeição:</strong> {record.justificativaRejeicao}</p>}{record.canceladoEm && <p>Cancelada em {date(record.canceladoEm)}{record.canceladoPor ? ` por ${record.canceladoPor.nome}` : ''}.</p>}{record.justificativaCancelamento && <p><strong>Motivo:</strong> {record.justificativaCancelamento}</p>}{record.adocao && <p>Entrega confirmada em {date(record.adocao.dataEntrega)}. Adoção concluída.</p>}</div></section><aside className="institutional-section institutional-detail-side"><h2>{record.status === 'PENDENTE' ? 'Decidir solicitação' : record.status === 'APROVADA' ? 'Animal reservado' : 'Situação da solicitação'}</h2><p className="institutional-help">{record.status === 'PENDENTE' ? 'A aprovação reserva o animal. A entrega será confirmada depois.' : record.status === 'APROVADA' ? 'A adoção ainda não foi concluída. Confirme a entrega somente quando ela ocorrer.' : 'Esta solicitação permanece no histórico da ONG.'}</p>{record.status === 'PENDENTE' && !decision && <div className="institutional-action-list"><button type="button" className="button button-primary" onClick={() => setDecision('approve')}>Aprovar solicitação</button><button type="button" className="button button-secondary" onClick={() => setDecision('reject')}>Rejeitar solicitação</button></div>}{record.status === 'APROVADA' && !decision && <div className="institutional-action-list"><button type="button" className="button button-primary" onClick={() => setDecision('complete')}>Confirmar entrega</button><button type="button" className="button button-secondary" onClick={() => setDecision('cancel')}>Cancelar aprovação</button></div>}{decision && <form className="institutional-form institutional-decision" onSubmit={submit}><h3>{decision === 'approve' ? 'Aprovar e reservar' : decision === 'reject' ? 'Rejeitar solicitação' : decision === 'cancel' ? 'Cancelar aprovação' : 'Concluir adoção'}</h3><p>{decision === 'approve' ? 'O animal ficará reservado para esta pessoa. A adoção só será concluída após confirmar a entrega.' : decision === 'complete' ? 'Esta ação formaliza a entrega, conclui a adoção e encerra os pedidos concorrentes conforme o servidor.' : decision === 'cancel' ? 'A reserva será liberada e os outros pedidos pendentes continuarão para análise.' : 'Informe a justificativa para preservar a decisão no histórico.'}</p>{['reject', 'cancel'].includes(decision) && <div className="institutional-field"><label htmlFor="adoption-reason">Justificativa</label><textarea id="adoption-reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} rows={4} /></div>}{decision === 'complete' && <label className="institutional-checkbox"><input type="checkbox" checked={deliveryConfirmed} onChange={event => setDeliveryConfirmed(event.target.checked)} required /> Confirmo que o animal foi entregue ao adotante.</label>}<div className="institutional-form-actions"><button type="submit" className={`button ${decision === 'reject' || decision === 'cancel' ? 'button-secondary' : 'button-primary'}`} disabled={busy || (decision === 'complete' && !deliveryConfirmed)}>{busy ? 'Salvando…' : decision === 'approve' ? 'Reservar animal' : decision === 'reject' ? 'Rejeitar pedido' : decision === 'cancel' ? 'Liberar reserva' : 'Concluir adoção'}</button><button type="button" className="button button-text" disabled={busy} onClick={() => { setDecision(null); setReason(''); setDeliveryConfirmed(false) }}>Voltar às ações</button></div></form>}</aside></div>}
  </>
}
