import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../shared/api/client'
import { getPublicAnimal, speciesLabel, type PublicAnimal } from '../animals/catalog'
import { Button, Notice, Photo } from '../../shared/components/Ui'
import { amountInput, createAdoption, createDonation, createSponsorship, personalError, type Sponsorship } from './api'
import { EmptyState, LoadState, PersonalHeading } from './PersonalUi'

type Action = 'solicitar' | 'doar' | 'apadrinhar'

const titles: Record<Action, string> = {
  solicitar: 'Solicitar adoção',
  doar: 'Registrar uma doação',
  apadrinhar: 'Apadrinhar animal',
}

const destinations: Record<Action, { to: string; label: string }> = {
  solicitar: { to: '/minha-area/solicitacoes', label: 'Acompanhar solicitação' },
  doar: { to: '/minha-area/doacoes', label: 'Ver minhas doações' },
  apadrinhar: { to: '/minha-area/apadrinhamentos', label: 'Ver meus apadrinhamentos' },
}

export function PersonalAction({ action }: { action: Action }) {
  const { id } = useParams()
  const animalId = Number(id)
  const valid = Number.isSafeInteger(animalId) && animalId > 0
  const [animal, setAnimal] = useState<PublicAnimal | null>(null)
  const [loading, setLoading] = useState(valid)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [value, setValue] = useState('')
  const [modality, setModality] = useState<Sponsorship['modalidade']>('UNICO')
  const [fieldError, setFieldError] = useState<{ field: 'valor' | 'mensagem' | 'modalidade'; message: string } | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(false)

  useEffect(() => {
    if (!valid) return
    let active = true
    getPublicAnimal(animalId).then(result => {
      if (!active) return
      setAnimal(result)
      setLoadError('')
      setLoading(false)
    }).catch(cause => {
      if (!active) return
      setLoadError(personalError(cause, 'Não foi possível carregar o animal.'))
      setLoading(false)
    })
    return () => { active = false }
  }, [animalId, valid, attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!animal || busy) return
    setFieldError(null)
    setSubmitError('')
    const note = message.trim()
    if (action !== 'apadrinhar' && note.length > 2000) { setFieldError({ field: 'mensagem', message: 'A mensagem deve ter no máximo 2.000 caracteres.' }); return }
    const amount = action === 'solicitar' ? null : amountInput(value)
    if (action !== 'solicitar' && !amount) { setFieldError({ field: 'valor', message: 'Informe um valor positivo, com até duas casas decimais.' }); return }
    setBusy(true)
    try {
      if (action === 'solicitar') await createAdoption(animal.id, note)
      else if (action === 'doar' && amount) await createDonation(animal.ong.id, amount, note)
      else if (amount) await createSponsorship(animal.id, modality, amount)
      setCreated(true)
    } catch (cause) {
      if (cause instanceof ApiError) {
        const field = (['valor', 'mensagem', 'modalidade'] as const).find(name => cause.errors?.[name]?.length)
        if (field) { setFieldError({ field, message: cause.errors?.[field][0] ?? 'Confira este campo.' }); return }
      }
      setSubmitError(personalError(cause, 'Não foi possível concluir a operação. Tente novamente.'))
    } finally { setBusy(false) }
  }

  return <>
    <Link className="personal-back" to={valid ? `/animais/${animalId}` : '/animais'}>← Voltar ao animal</Link>
    <PersonalHeading eyebrow="Patas Unidas" title={titles[action]} description={action === 'doar' ? 'Registre sua intenção de contribuir com a ONG. Não há pagamento automático nesta plataforma.' : action === 'apadrinhar' ? 'Escolha um apoio único ou mensal. A ONG confirmará manualmente as parcelas recebidas.' : 'Envie uma mensagem breve à ONG responsável pelo animal.'} />
    {!valid ? <EmptyState title="Animal inválido" description="Escolha um animal no catálogo para continuar." to="/animais" action="Ver animais" /> : <LoadState loading={loading} error={loadError} retry={() => { setLoading(true); setAttempt(value => value + 1) }} />}
    {!loading && animal && (created ? <section className="personal-success" role="status">
      <span aria-hidden="true">✓</span>
      <h2>{action === 'solicitar' ? 'Solicitação enviada' : action === 'doar' ? 'Doação registrada' : 'Apadrinhamento iniciado'}</h2>
      <p>{action === 'solicitar' ? 'A solicitação está pendente de análise pela ONG. Você pode acompanhar o andamento na sua área.' : action === 'doar' ? 'A doação está pendente. A ONG confirmará o recebimento manualmente.' : 'As parcelas previstas aparecerão na sua área. Elas não representam cobrança automática.'}</p>
      <Link className="button button-primary" to={destinations[action].to}>{destinations[action].label}</Link>
    </section> : <div className="personal-action-layout">
      <section className="personal-action-context" aria-label="Animal e organização"><Photo name={animal.nome} species={speciesLabel[animal.especie]} src={animal.fotoPrincipal?.url} /><div><p className="section-label">{action === 'doar' ? 'ONG beneficiária' : 'Animal'}</p><h2>{action === 'doar' ? animal.ong.nome : animal.nome}</h2><p>{action === 'doar' ? `Conhecida por ${animal.nome}` : animal.ong.nome} · {animal.ong.cidade}, {animal.ong.estado}</p></div></section>
      <form className="personal-form" onSubmit={submit} noValidate>
        {action === 'apadrinhar' && <fieldset className="personal-choice" aria-describedby={fieldError?.field === 'modalidade' ? 'personal-modalidade-error' : undefined}><legend>Modalidade do apoio</legend><label><input type="radio" name="modalidade" value="UNICO" checked={modality === 'UNICO'} onChange={() => setModality('UNICO')} /> Apoio único</label><label><input type="radio" name="modalidade" value="MENSAL" checked={modality === 'MENSAL'} onChange={() => setModality('MENSAL')} /> Apoio mensal</label>{fieldError?.field === 'modalidade' && <p className="personal-field-error" id="personal-modalidade-error" role="alert">{fieldError.message}</p>}</fieldset>}
        {action !== 'solicitar' && <div className="personal-form-field"><label htmlFor="personal-valor">Valor em reais</label><div className="personal-money-input"><span aria-hidden="true">R$</span><input id="personal-valor" name="valor" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={value} onChange={event => setValue(event.target.value)} aria-invalid={fieldError?.field === 'valor'} aria-describedby={fieldError?.field === 'valor' ? 'personal-valor-error' : 'personal-amount-help'} required /></div><p id="personal-amount-help">Use vírgula ou ponto para os centavos.</p>{fieldError?.field === 'valor' && <p className="personal-field-error" id="personal-valor-error" role="alert">{fieldError.message}</p>}</div>}
        {action !== 'apadrinhar' && <div className="personal-form-field"><label htmlFor="personal-mensagem">Mensagem para a ONG <span>(opcional)</span></label><textarea id="personal-mensagem" name="mensagem" maxLength={2000} rows={4} value={message} onChange={event => setMessage(event.target.value)} aria-invalid={fieldError?.field === 'mensagem'} aria-describedby={fieldError?.field === 'mensagem' ? 'personal-mensagem-error' : undefined} />{fieldError?.field === 'mensagem' && <p className="personal-field-error" id="personal-mensagem-error" role="alert">{fieldError.message}</p>}</div>}
        {submitError && <Notice variant="error">{submitError}</Notice>}
        {action === 'doar' && <p className="personal-form-note">Registrar não confirma que a ONG recebeu o valor.</p>}
        {action === 'apadrinhar' && <p className="personal-form-note">O apoio mensal gera parcelas previstas. A confirmação de recebimento é manual.</p>}
        <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Enviando…' : action === 'solicitar' ? 'Enviar solicitação' : action === 'doar' ? 'Registrar doação' : 'Iniciar apadrinhamento'}</Button>
      </form>
    </div>)}
  </>
}
