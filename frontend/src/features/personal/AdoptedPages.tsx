import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '../../shared/components/Ui'
import {
  dateLabel, getAdoptedMedicalRecord, listAdoptedMedicalRecords, listOwnAdoptions,
  personalError, type MedicalRecord, type OwnAdoption,
} from './api'
import { EmptyState, LoadState, Pager, PersonalHeading } from './PersonalUi'
import { usePaged } from './usePaged'

export function AdoptedAnimals() {
  const [sourcePage, setSourcePage] = useState(1)
  const [sourceLastPage, setSourceLastPage] = useState(1)
  const [adopted, setAdopted] = useState<OwnAdoption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    listOwnAdoptions(sourcePage).then(result => {
      if (!active) return
      const completed = result.data.filter(item => item.status === 'CONCLUIDA' && item.adocao)
      setAdopted(current => sourcePage === 1 ? completed : [...current, ...completed])
      setSourceLastPage(result.meta.last_page)
      setLoading(false)
      setError('')
    }).catch(cause => {
      if (!active) return
      setLoading(false)
      setError(personalError(cause, 'Não foi possível carregar os animais adotados.'))
    })
    return () => { active = false }
  }, [sourcePage, attempt])

  return <>
    <PersonalHeading eyebrow="Minha área" title="Animais adotados" description="Apenas adoções concluídas após a confirmação da entrega aparecem aqui." />
    {adopted.length > 0 && <div className="personal-list">{adopted.map(item => <article className="personal-record" key={item.id}>
      <div className="personal-record-head"><div><p className="section-label">Adoção concluída</p><h2>{item.animal.nome}</h2><p>{item.ong.nome} · entregue em {dateLabel(item.adocao?.dataEntrega)}</p></div></div>
      <Link className="personal-inline-link" to={`/minha-area/adotados/${item.animal.id}/prontuarios`}>Ver histórico veterinário</Link>
    </article>)}</div>}
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />
    {!loading && !error && adopted.length === 0 && (sourcePage < sourceLastPage
      ? <div className="personal-state"><p>Não há adoções concluídas entre as solicitações mais recentes. Consulte os registros anteriores.</p></div>
      : <EmptyState title="Nenhum animal adotado ainda" description="Solicitações aprovadas só se tornam adoções concluídas após a confirmação da entrega pela ONG." to="/minha-area/solicitacoes" action="Ver minhas solicitações" />)}
    {!loading && !error && sourcePage < sourceLastPage && <Button secondary className="personal-more" onClick={() => { setLoading(true); setSourcePage(page => page + 1) }}>Ver registros anteriores</Button>}
  </>
}

export function AdoptedMedicalHistory() {
  const { animalId } = useParams()
  const id = Number(animalId)
  const valid = Number.isSafeInteger(id) && id > 0
  const load = useCallback((page: number) => listAdoptedMedicalRecords(id, page), [id])
  const records = usePaged(load, valid)

  return <>
    <Link className="personal-back" to="/minha-area/adotados">← Animais adotados</Link>
    <PersonalHeading eyebrow="Animais adotados" title="Histórico veterinário" description="Registros clínicos autorizados do animal que você adotou. Consulta somente de leitura." />
    {!valid ? <EmptyState title="Animal inválido" description="Volte para seus animais adotados e escolha um registro." to="/minha-area/adotados" action="Ver animais adotados" /> : <>
      <LoadState loading={records.loading} error={records.error} retry={records.reload} />
      {!records.loading && !records.error && records.data && (records.data.data.length ? <ol className="personal-timeline">
        {records.data.data.map(item => <li key={item.id}><span className="personal-timeline-date">{dateLabel(item.dataProcedimento)}</span><div><p className="section-label">{item.tipo.replaceAll('_', ' ')}</p><h2>{item.titulo}</h2><p>{item.descricao}</p><Link className="personal-inline-link" to={`/minha-area/adotados/${id}/prontuarios/${item.id}`}>Ver registro completo</Link></div></li>)}
      </ol> : <EmptyState title="Nenhum registro clínico encontrado" description="A ONG ainda não registrou procedimentos para este animal no período disponível." />)}
      {records.data && <Pager page={records.page} lastPage={records.data.meta.last_page} onChange={records.changePage} />}
    </>}
  </>
}

export function AdoptedMedicalRecord() {
  const { animalId, recordId } = useParams()
  const id = Number(animalId)
  const record = Number(recordId)
  const valid = Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(record) && record > 0
  const [data, setData] = useState<MedicalRecord | null>(null)
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!valid) return
    let active = true
    getAdoptedMedicalRecord(id, record).then(result => { if (active) { setData(result); setLoading(false); setError('') } })
      .catch(cause => { if (active) { setError(personalError(cause, 'Não foi possível abrir o registro.')); setLoading(false) } })
    return () => { active = false }
  }, [id, record, valid, attempt])

  return <>
    <Link className="personal-back" to={valid ? `/minha-area/adotados/${id}/prontuarios` : '/minha-area/adotados'}>← Histórico veterinário</Link>
    <PersonalHeading eyebrow={data?.animal.nome ?? 'Prontuário'} title={data?.titulo ?? 'Registro clínico'} description={data ? `${data.tipo.replaceAll('_', ' ')} · ${dateLabel(data.dataProcedimento)}` : undefined} />
    {!valid ? <EmptyState title="Registro inválido" description="Volte ao histórico do animal e escolha um registro." to="/minha-area/adotados" action="Ver animais adotados" /> : <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />}
    {!loading && data && <article className="personal-medical-detail"><p>{data.descricao}</p><dl>
      {data.profissionalResponsavel && <div><dt>Profissional responsável</dt><dd>{data.profissionalResponsavel}</dd></div>}
      {data.medicamentos && <div><dt>Medicamentos</dt><dd>{data.medicamentos}</dd></div>}
      {data.observacoes && <div><dt>Observações</dt><dd>{data.observacoes}</dd></div>}
    </dl></article>}
  </>
}
