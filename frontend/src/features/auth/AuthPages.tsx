import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Brand, Button, Field, Header, Notice, TextLink } from '../../shared/components/Ui'
import { errorMessage } from '../../shared/api/client'
import { registerUser, useAuth } from './auth'

export function Login() {
 const [team,setTeam]=useState(false); const [message,setMessage]=useState(''); const [submitting,setSubmitting]=useState(false)
 const navigate=useNavigate(); const location=useLocation(); const {login,status}=useAuth()
 const successMessage = (location.state as {registered?: boolean} | null)?.registered ? 'Conta criada com sucesso. Entre com seu e-mail e senha.' : ''
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault(); if(submitting || status === 'loading') return
  const data=new FormData(e.currentTarget); const email=String(data.get('email')||'').trim(); const senha=String(data.get('senha')||'')
  if (!email || !senha) {setMessage('Informe seu e-mail e sua senha.');return}
  setMessage('');setSubmitting(true)
  try { await login(email,senha); navigate('/',{replace:true}) }
  catch (error) {setMessage(errorMessage(error,'login'))}
  finally {setSubmitting(false)}
 }
 return <main className="auth-shell"><Header><Brand/><h1>Bem-vindo de volta!</h1><p>{team ? 'Acesse o painel para gerenciar animais, adoções, apadrinhamentos e a saúde dos resgatados.' : 'Acompanhe seus pedidos e apadrinhamentos, ou entre como equipe da ONG.'}</p></Header><div className="auth-body"><div className="segment" aria-label="Tipo de acesso"><button type="button" className={!team?'selected':''} aria-pressed={!team} onClick={()=>setTeam(false)}>Adotante ou padrinho</button><button type="button" className={team?'selected':''} aria-pressed={team} onClick={()=>setTeam(true)}>Equipe da ONG</button></div><form onSubmit={submit}><Field name="email" label={team?'E-mail institucional':'E-mail'} type="email" placeholder={team?'equipe@suaong.org.br':'voce@email.com'} autoComplete="email"/><Field name="senha" label="Senha" placeholder="Sua senha" password autoComplete="current-password"/><div className="auth-spacer"/><div className="form-row"><label className="check"><input type="checkbox" disabled/> Manter conectado (indisponível)</label><button type="button" className="text-link" onClick={()=>setMessage('Recuperação de senha ainda não disponível.')}>Esqueci a senha</button></div><Button type="submit" disabled={submitting || status === 'loading'}>{submitting ? 'Entrando...' : team?'Entrar no painel':'Entrar'}</Button><p className="hint centered">Depois de entrar, você volta para os animais.</p><p className="centered">{team?'Sua ONG ainda não tem cadastro? ':'Não tem uma conta? '}{team?<button type="button" className="text-link" onClick={()=>setMessage('Cadastro de ONG ainda não disponível.')}>Cadastrar ONG</button>:<TextLink to="/cadastro">Cadastre-se</TextLink>}</p><p className="hint small">Use o e-mail e a senha da sua conta.</p>{(message || successMessage) && <Notice>{message || successMessage}</Notice>}</form></div></main>
}
export function Cadastro() {
 const [message,setMessage]=useState(''); const [submitting,setSubmitting]=useState(false); const navigate=useNavigate()
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault(); if(submitting) return
  const data=new FormData(e.currentTarget); const nome=String(data.get('nome')||'').trim(), email=String(data.get('email')||'').trim(), senha=String(data.get('senha')||''), confirm=String(data.get('confirmacao')||'')
  if(!nome||!email||!senha||!confirm) {setMessage('Preencha todos os campos');return}
  if(nome.length>100) {setMessage('Nome muito longo');return}
  if(email.length>120||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {setMessage('E-mail inválido');return}
  if(senha.length<12||senha.length>72||new TextEncoder().encode(senha).length>72||!senha.trim()) {setMessage('A senha deve ter entre 12 e 72 caracteres e no máximo 72 bytes');return}
  if(senha!==confirm) {setMessage('As senhas não coincidem');return}
  setMessage('');setSubmitting(true)
  try { await registerUser(nome,email,senha); navigate('/login',{replace:true,state:{registered:true}}) }
  catch(error) {setMessage(errorMessage(error,'cadastro'))}
  finally {setSubmitting(false)}
 }
 return <main className="auth-shell"><Header><Brand/><h1>Crie sua conta</h1><p>Acompanhe os animais e faça parte do Patas Unidas.</p></Header><div className="auth-body"><form onSubmit={submit} noValidate><Field label="Nome completo" name="nome" placeholder="Seu nome completo" autoComplete="name"/><Field label="E-mail" name="email" type="email" placeholder="voce@email.com" autoComplete="email"/><Field label="Senha" name="senha" placeholder="Sua senha" password autoComplete="new-password"/><Field label="Confirmar senha" name="confirmacao" placeholder="Repita sua senha" password autoComplete="new-password"/><div className="auth-spacer"/><Button type="submit" disabled={submitting}>{submitting?'Criando conta...':'Criar conta'}</Button><p className="centered">Já possui uma conta? <TextLink to="/login">Entrar</TextLink></p>{message && <Notice>{message}</Notice>}</form></div></main>
}
