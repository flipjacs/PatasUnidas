import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/auth'
import { Notice } from '../../shared/components/Ui'
import { loadDashboard, institutionalError, type Dashboard as DashboardData } from './api'
import { LoadState, PageHeading } from './InstitutionalUi'

function Metric({ label, value, emphasis = false }: { label: string; value: number | string; emphasis?: boolean }) {
  return <div className={`institutional-metric ${emphasis ? 'institutional-metric--emphasis' : ''}`}><dt>{label}</dt><dd>{value}</dd></div>
}

function PeriodFilters({ de, ate, onApply }: { de: string; ate: string; onApply: (de: string, ate: string) => void }) {
  const [draftDe, setDraftDe] = useState(de)
  const [draftAte, setDraftAte] = useState(ate)
  const [validation, setValidation] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (draftDe && draftAte && draftAte < draftDe) { setValidation('A data final deve ser igual ou posterior à data inicial.'); return }
    setValidation('')
    onApply(draftDe, draftAte)
  }
  return <><form className="institutional-toolbar institutional-period" onSubmit={submit}>
    <div><label htmlFor="period-de">De</label><input id="period-de" type="date" value={draftDe} onChange={event => setDraftDe(event.target.value)} /></div>
    <div><label htmlFor="period-ate">Até</label><input id="period-ate" type="date" value={draftAte} onChange={event => setDraftAte(event.target.value)} /></div>
    <button className="button button-secondary" type="submit">Aplicar período</button>
    {(de || ate) && <button className="institutional-clear" type="button" onClick={() => onApply('', '')}>Limpar</button>}
  </form>{validation && <div className="institutional-feedback"><Notice variant="error">{validation}</Notice></div>}</>
}

export function Dashboard() {
  const { user } = useAuth()
  const [search, setSearchParams] = useSearchParams()
  const de = search.get('de') ?? ''
  const ate = search.get('ate') ?? ''
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const key = `${de}:${ate}:${attempt}`
  const loading = loadedKey !== key

  useEffect(() => {
    let active = true
    loadDashboard(de || undefined, ate || undefined).then(result => { if (active) { setData(result); setError(''); setLoadedKey(key) } })
      .catch(cause => { if (active) { setError(institutionalError(cause)); setLoadedKey(key) } })
    return () => { active = false }
  }, [de, ate, attempt, key])

  function applyPeriod(from: string, to: string) {
    const next = new URLSearchParams()
    if (from) next.set('de', from)
    if (to) next.set('ate', to)
    setSearchParams(next)
  }

  return <>
    <PageHeading title={`Olá, ${user?.nome ?? 'equipe'}.`} description={user?.perfil === 'VETERINARIO' ? 'Acompanhe os indicadores de cuidado clínico da sua ONG.' : 'Acompanhe os animais e as atividades da sua ONG.'} action={user?.perfil !== 'VETERINARIO' ? <Link className="button button-primary" to="/ong/animais">Gerenciar animais</Link> : undefined} />
    <PeriodFilters key={`${de}|${ate}`} de={de} ate={ate} onApply={applyPeriod} />
    <LoadState loading={loading} error={error} retry={() => setAttempt(n => n + 1)} />
    {!loading && !error && data && <>
      <section className="institutional-section" aria-labelledby="animals-metrics"><div className="institutional-section-head"><h2 id="animals-metrics">Animais da ONG</h2></div>
        <dl className="institutional-metrics"><Metric label="Cadastrados" value={data.animais.total} emphasis /><Metric label="Disponíveis" value={data.animais.disponiveis} /><Metric label="Em adoção" value={data.animais.emProcessoAdocao} /><Metric label="Publicados" value={data.animais.publicados} /></dl>
      </section>
      <div className="institutional-dashboard-grid">
        <section className="institutional-section" aria-labelledby="clinical-metrics"><div className="institutional-section-head"><h2 id="clinical-metrics">Registros clínicos</h2></div><dl className="institutional-mini-metrics"><Metric label="Total" value={data.clinico.totalRegistros} /><Metric label="Consultas" value={data.clinico.consultas} /><Metric label="Vacinas" value={data.clinico.vacinas} /><Metric label="Exames" value={data.clinico.exames} /></dl></section>
        {data.adocoes && user?.perfil !== 'VETERINARIO' && <section className="institutional-section" aria-labelledby="adoption-metrics"><div className="institutional-section-head"><h2 id="adoption-metrics">Adoções</h2></div><dl className="institutional-mini-metrics"><Metric label="Solicitações pendentes" value={data.adocoes.solicitacoesPendentes} /><Metric label="Aprovadas" value={data.adocoes.solicitacoesAprovadas} /><Metric label="Concluídas" value={data.adocoes.concluidas} /></dl></section>}
        {data.apadrinhamentos && user?.perfil !== 'VETERINARIO' && <section className="institutional-section" aria-labelledby="sponsor-metrics"><div className="institutional-section-head"><h2 id="sponsor-metrics">Apadrinhamentos</h2></div><dl className="institutional-mini-metrics"><Metric label="Ativos" value={data.apadrinhamentos.ativos} /><Metric label="Parcelas pendentes" value={data.apadrinhamentos.parcelasPendentes} /><Metric label="Parcelas vencidas" value={data.apadrinhamentos.parcelasVencidas} /></dl></section>}
        {data.doacoes && user?.perfil === 'ADMINISTRADOR' && <section className="institutional-section" aria-labelledby="donation-metrics"><div className="institutional-section-head"><h2 id="donation-metrics">Doações</h2></div><dl className="institutional-mini-metrics"><Metric label="Pendentes" value={data.doacoes.pendentes} /><Metric label="Confirmadas no período" value={data.doacoes.confirmadas} /><Metric label="Valor confirmado" value={`R$ ${data.doacoes.valorConfirmado.replace('.', ',')}`} /></dl></section>}
      </div>
      <p className="institutional-period-note">{data.semanticaPeriodo}</p>
    </>}
  </>
}
