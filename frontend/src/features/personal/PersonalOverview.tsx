import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/auth'
import { Button } from '../../shared/components/Ui'
import { dateLabel, listOwnAdoptions, listOwnDonations, listOwnSponsorships, money, personalError, type OwnAdoption, type OwnDonation, type Sponsorship } from './api'
import { LoadState, PersonalHeading, Status } from './PersonalUi'

type Overview = { adoptions: OwnAdoption[]; donations: OwnDonation[]; sponsorships: Sponsorship[] }

export function PersonalOverview() {
  const { user } = useAuth()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([listOwnAdoptions(), listOwnDonations(), listOwnSponsorships()]).then(([adoptions, donations, sponsorships]) => {
      if (active) { setData({ adoptions: adoptions.data.slice(0, 2), donations: donations.data.slice(0, 2), sponsorships: sponsorships.data.slice(0, 2) }); setLoading(false); setError('') }
    }).catch(cause => { if (active) { setError(personalError(cause, 'Não foi possível carregar sua área.')); setLoading(false) } })
    return () => { active = false }
  }, [attempt])

  return <>
    <PersonalHeading eyebrow="Minha área" title={`Olá, ${user?.nome ?? 'bem-vindo'}.`} description="Acompanhe seus registros e encontre os próximos passos em um só lugar." action={<Link className="button button-primary" to="/animais">Conhecer animais</Link>} />
    <LoadState loading={loading} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />
    {!loading && !error && data && <div className="personal-overview-grid">
      <section className="personal-overview-section"><div className="personal-overview-head"><h2>Adoções</h2><Link to="/minha-area/solicitacoes">Ver solicitações</Link></div>
        {data.adoptions.length ? <ul>{data.adoptions.map(item => <li key={item.id}><div><strong>{item.animal.nome}</strong><span>{item.ong.nome} · {dateLabel(item.createdAt)}</span></div><Status value={item.status} /></li>)}</ul> : <p>Você ainda não enviou solicitações de adoção.</p>}
      </section>
      <section className="personal-overview-section"><div className="personal-overview-head"><h2>Apadrinhamentos</h2><Link to="/minha-area/apadrinhamentos">Ver apoios</Link></div>
        {data.sponsorships.length ? <ul>{data.sponsorships.map(item => <li key={item.id}><div><strong>{item.animal.nome}</strong><span>{item.modalidade === 'MENSAL' ? 'Mensal' : 'Único'} · {money(item.valor)}</span></div><Status value={item.status} /></li>)}</ul> : <p>Seus apoios registrados aparecerão aqui.</p>}
      </section>
      <section className="personal-overview-section"><div className="personal-overview-head"><h2>Doações</h2><Link to="/minha-area/doacoes">Ver doações</Link></div>
        {data.donations.length ? <ul>{data.donations.map(item => <li key={item.id}><div><strong>{item.ong.nome}</strong><span>{money(item.valor)} · {dateLabel(item.createdAt)}</span></div><Status value={item.status} /></li>)}</ul> : <p>Você ainda não registrou doações.</p>}
      </section>
      <section className="personal-overview-section personal-overview-section--adopted"><div className="personal-overview-head"><h2>Animais adotados</h2><Link to="/minha-area/adotados">Ver animais</Link></div><p>Consulte adoções concluídas e o histórico veterinário autorizado de cada animal.</p></section>
    </div>}
    {!loading && !error && !data && <Button secondary onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Atualizar</Button>}
  </>
}
