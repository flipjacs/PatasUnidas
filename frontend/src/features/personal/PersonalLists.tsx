import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button, Notice } from '../../shared/components/Ui'
import {
  cancelAdoption, cancelDonation, cancelSponsorship, dateLabel, getOwnSponsorship, listOwnAdoptions,
  listOwnDonations, listOwnInstallments, listOwnSponsorships, money, personalError,
  type Sponsorship,
} from './api'
import { ActionError, ConfirmAction, EmptyState, LoadState, Pager, PersonalHeading, Status } from './PersonalUi'
import { usePaged } from './usePaged'

export function AdoptionList() {
  const records = usePaged(listOwnAdoptions)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)
  const [success, setSuccess] = useState('')

  async function cancel(id: number) {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      await cancelAdoption(id)
      setConfirming(null)
      setSuccess('Solicitação cancelada. O histórico foi preservado.')
      records.reload()
    } catch (cause) {
      setActionError(cause)
      records.reload()
    } finally { setBusy(false) }
  }

  return <>
    <PersonalHeading eyebrow="Minha área" title="Minhas adoções" description="Acompanhe cada solicitação até a decisão da ONG e, quando ocorrer, a entrega do animal." action={records.data?.data.length ? <Link className="button button-secondary" to="/animais">Conhecer animais</Link> : undefined} />
    {success && <Notice variant="success">{success}</Notice>}
    <ActionError error={actionError} />
    <LoadState loading={records.loading} error={records.error} retry={records.reload} />
    {!records.loading && !records.error && records.data && (records.data.data.length ? <div className="personal-list">
      {records.data.data.map(item => <article className="personal-record" key={item.id}>
        <div className="personal-record-head"><div><p className="section-label">Solicitação #{item.id}</p><h2>{item.animal.nome}</h2><p>{item.ong.nome} · {dateLabel(item.createdAt)}</p></div><Status value={item.status} /></div>
        <p className="personal-record-note">{item.status === 'APROVADA' ? 'Aprovada pela ONG. A adoção será concluída após a entrega.' : item.status === 'PENDENTE' ? 'A ONG ainda vai analisar sua solicitação.' : item.status === 'CONCLUIDA' ? `Entrega confirmada em ${dateLabel(item.adocao?.dataEntrega)}.` : item.status === 'REJEITADA' ? 'A ONG encerrou esta solicitação.' : 'Você cancelou esta solicitação.'}</p>
        {item.justificativaRejeicao && <p className="personal-record-reason"><strong>Justificativa:</strong> {item.justificativaRejeicao}</p>}
        {item.justificativaCancelamento && <p className="personal-record-reason"><strong>Motivo registrado:</strong> {item.justificativaCancelamento}</p>}
        {item.mensagem && <details className="personal-details"><summary>Ver minha mensagem</summary><p>{item.mensagem}</p></details>}
        {item.status === 'CONCLUIDA' && item.adocao && <Link className="personal-inline-link" to={`/minha-area/adotados/${item.animal.id}/prontuarios`}>Ver histórico veterinário de {item.animal.nome}</Link>}
        {(item.status === 'PENDENTE' || item.status === 'APROVADA') && (confirming === item.id
          ? <ConfirmAction label="Cancelar solicitação" explanation={item.status === 'APROVADA' ? 'Cancelar agora encerra a aprovação antes da entrega.' : 'A solicitação será mantida no seu histórico.'} busy={busy} onConfirm={() => cancel(item.id)} onDismiss={() => setConfirming(null)} />
          : <Button variant="text" className="personal-record-action" onClick={() => { setSuccess(''); setActionError(null); setConfirming(item.id) }}>Cancelar solicitação</Button>)}
      </article>)}
    </div> : <EmptyState title="Nenhuma solicitação ainda" description="Quando encontrar um animal no catálogo, você poderá enviar uma solicitação à ONG responsável." to="/animais" action="Conhecer animais" />)}
    {records.data && <Pager page={records.page} lastPage={records.data.meta.last_page} onChange={records.changePage} />}
  </>
}

export function DonationList() {
  const records = usePaged(listOwnDonations)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)
  const [success, setSuccess] = useState('')
  async function cancel(id: number) {
    if (busy) return
    setBusy(true); setActionError(null)
    try { await cancelDonation(id); setConfirming(null); setSuccess('Doação pendente cancelada. O registro permanece no histórico.'); records.reload() }
    catch (cause) { setActionError(cause); records.reload() }
    finally { setBusy(false) }
  }
  return <>
    <PersonalHeading eyebrow="Minha área" title="Minhas doações" description="Contribuições registradas e seus estados de confirmação pela ONG." action={records.data?.data.length ? <Link className="button button-secondary" to="/animais">Ver animais e ONGs</Link> : undefined} />
    {success && <Notice variant="success">{success}</Notice>}
    <ActionError error={actionError} />
    <LoadState loading={records.loading} error={records.error} retry={records.reload} />
    {!records.loading && !records.error && records.data && (records.data.data.length ? <div className="personal-list">
      {records.data.data.map(item => <article className="personal-record" key={item.id}>
        <div className="personal-record-head"><div><p className="section-label">Doação #{item.id}</p><h2>{item.ong.nome}</h2><p>Registrada em {dateLabel(item.createdAt)}</p></div><Status value={item.status} /></div>
        <strong className="personal-amount">{money(item.valor)}</strong>
        <p className="personal-record-note">{item.status === 'PENDENTE' ? 'Aguardando confirmação manual da ONG. O registro não confirma um pagamento.' : item.status === 'CONFIRMADA' ? `Recebimento confirmado em ${dateLabel(item.confirmadoEm)}.` : `Registro cancelado em ${dateLabel(item.canceladoEm)}.`}</p>
        {item.status === 'PENDENTE' && (confirming === item.id ? <ConfirmAction label="Cancelar doação" explanation="Esta intenção de doação será cancelada e continuará no histórico. Nenhum pagamento será revertido." busy={busy} onConfirm={() => void cancel(item.id)} onDismiss={() => setConfirming(null)} /> : <Button variant="text" className="personal-record-action" onClick={() => { setSuccess(''); setActionError(null); setConfirming(item.id) }}>Cancelar doação</Button>)}
      </article>)}
    </div> : <EmptyState title="Nenhuma doação registrada" description="Você pode escolher uma ONG a partir do detalhe de um animal no catálogo." to="/animais" action="Explorar catálogo" />)}
    {records.data && <Pager page={records.page} lastPage={records.data.meta.last_page} onChange={records.changePage} />}
  </>
}

export function SponsorshipList() {
  const records = usePaged(listOwnSponsorships)
  return <>
    <PersonalHeading eyebrow="Minha área" title="Meus apadrinhamentos" description="Acompanhe seus apoios e as parcelas previstas ou confirmadas pela ONG." action={records.data?.data.length ? <Link className="button button-secondary" to="/animais">Conhecer animais</Link> : undefined} />
    <LoadState loading={records.loading} error={records.error} retry={records.reload} />
    {!records.loading && !records.error && records.data && (records.data.data.length ? <div className="personal-list">
      {records.data.data.map(item => <article className="personal-record" key={item.id}>
        <div className="personal-record-head"><div><p className="section-label">{item.modalidade === 'MENSAL' ? 'Apoio mensal' : 'Apoio único'} · #{item.id}</p><h2>{item.animal.nome}</h2><p>{item.ong.nome} · iniciado em {dateLabel(item.dataInicio)}</p></div><Status value={item.status} /></div>
        <strong className="personal-amount">{money(item.valor)}{item.modalidade === 'MENSAL' ? ' / mês' : ''}</strong>
        {item.status === 'ATIVO' && item.proximoVencimento && <p className="personal-record-note">Próxima parcela prevista: {dateLabel(item.proximoVencimento)}.</p>}
        {item.status === 'ENCERRADO' && <p className="personal-record-note">Encerrado em {dateLabel(item.dataEncerramento)}. O histórico das parcelas permanece disponível.</p>}
        <Link className="personal-inline-link" to={`/minha-area/apadrinhamentos/${item.id}`}>Ver parcelas e detalhes</Link>
      </article>)}
    </div> : <EmptyState title="Nenhum apadrinhamento ainda" description="Conheça os animais no catálogo e escolha se deseja registrar um apoio único ou mensal." to="/animais" action="Conhecer animais" />)}
    {records.data && <Pager page={records.page} lastPage={records.data.meta.last_page} onChange={records.changePage} />}
  </>
}

export function SponsorshipDetails() {
  const { id } = useParams()
  const sponsorshipId = Number(id)
  const valid = Number.isSafeInteger(sponsorshipId) && sponsorshipId > 0
  const [record, setRecord] = useState<Sponsorship | null>(null)
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)
  const [success, setSuccess] = useState('')
  const loadInstallments = useCallback((page: number) => listOwnInstallments(sponsorshipId, page), [sponsorshipId])
  const installments = usePaged(loadInstallments, valid)

  useEffect(() => {
    if (!valid) return
    let active = true
    getOwnSponsorship(sponsorshipId).then(result => { if (active) { setRecord(result); setError(''); setLoading(false) } })
      .catch(cause => { if (active) { setError(personalError(cause, 'Não foi possível abrir o apadrinhamento.')); setLoading(false) } })
    return () => { active = false }
  }, [sponsorshipId, valid, attempt])

  async function cancel() {
    if (busy || !record) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await cancelSponsorship(record.id)
      setRecord(updated)
      setConfirming(false)
      setSuccess('Apadrinhamento encerrado. As parcelas anteriores continuam no histórico.')
      installments.reload()
    } catch (cause) { setActionError(cause); setAttempt(value => value + 1) }
    finally { setBusy(false) }
  }

  return <>
    <Link className="personal-back" to="/minha-area/apadrinhamentos">← Meus apadrinhamentos</Link>
    <PersonalHeading eyebrow="Apadrinhamento" title={record?.animal.nome ?? 'Detalhes do apoio'} description="A confirmação de cada parcela é registrada manualmente pela ONG." />
    {success && <Notice variant="success">{success}</Notice>}
    <ActionError error={actionError} />
    {!valid ? <EmptyState title="Apadrinhamento inválido" description="Volte à sua lista de apoios." to="/minha-area/apadrinhamentos" action="Ver apadrinhamentos" /> : <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />}
    {!loading && record && <section className="personal-summary" aria-label="Resumo do apadrinhamento">
      <div><span>Organização</span><strong>{record.ong.nome}</strong></div>
      <div><span>Modalidade</span><strong>{record.modalidade === 'MENSAL' ? 'Apoio mensal' : 'Apoio único'}</strong></div>
      <div><span>Valor</span><strong>{money(record.valor)}</strong></div>
      <div><span>Situação</span><Status value={record.status} /></div>
      {record.status === 'ENCERRADO' && <div><span>Encerrado em</span><strong>{dateLabel(record.dataEncerramento)}</strong></div>}
    </section>}
    {!loading && record?.status === 'ATIVO' && (confirming
      ? <ConfirmAction label="Encerrar apadrinhamento" explanation="O encerramento impede novas parcelas futuras. Parcelas anteriores permanecem no histórico." busy={busy} onConfirm={cancel} onDismiss={() => setConfirming(false)} />
      : <Button variant="text" className="personal-record-action" onClick={() => setConfirming(true)}>Encerrar apadrinhamento</Button>)}
    {!loading && record && <section className="personal-subsection"><h2>Parcelas</h2><p>Uma parcela pendente é uma previsão, não uma cobrança automática.</p>
      <LoadState loading={installments.loading} error={installments.error} retry={installments.reload} />
      {!installments.loading && !installments.error && installments.data && (installments.data.data.length ? <ol className="personal-installments">
        {installments.data.data.map(item => <li key={item.id}><div><strong>Parcela {item.numero}</strong><span>Prevista para {dateLabel(item.vencimento)}</span></div><strong>{money(item.valor)}</strong><Status value={item.status} />{item.confirmadoEm && <small>Confirmada em {dateLabel(item.confirmadoEm)}</small>}</li>)}
      </ol> : <EmptyState title="Nenhuma parcela encontrada" description="As parcelas previstas aparecerão aqui quando forem geradas pelo sistema." />)}
      {installments.data && <Pager page={installments.page} lastPage={installments.data.meta.last_page} onChange={installments.changePage} />}
    </section>}
  </>
}
