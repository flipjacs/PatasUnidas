import { useNavigate } from 'react-router'
import { animals } from '../animals/data'
import { AnimalCard } from '../animals/AnimalPages'
import { BottomNav, Button, Header } from '../../shared/components/Ui'
export function Home({onSoon}:{onSoon:()=>void}) { const navigate=useNavigate();return <div className="app-shell"><Header onSoon={onSoon}/><main className="page-content home"><p className="eyebrow">Adoção e apadrinhamento</p><h1>Um lar para quem foi resgatado. Contas claras para quem ajuda.</h1><p className="intro">Veja os animais que esperam por uma família e envie o pedido direto para a ONG responsável.</p><div className="home-actions"><Button onClick={()=>navigate('/animais')}>Ver animais para adoção</Button><Button secondary onClick={onSoon}>Quero apadrinhar</Button></div><h2>Esperando por você</h2><div className="carousel">{animals.map(a=><AnimalCard key={a.id} animal={a} compact/>)}</div><h2 className="how">Como adotar</h2></main><BottomNav onSoon={onSoon}/></div>}
