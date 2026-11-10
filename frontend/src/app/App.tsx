import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Login, Cadastro } from '../features/auth/AuthPages'
import { Home } from '../features/home/Home'
import { Animals, Details } from '../features/animals/AnimalPages'
import { Notice } from '../shared/components/Ui'

export function App() {
 const [demo,setDemo]=useState(()=>sessionStorage.getItem('patas-demo')==='1'); const [message,setMessage]=useState('')
 const startDemo=()=>{sessionStorage.setItem('patas-demo','1');setDemo(true)}
 const soon=()=>{setMessage('Funcionalidade ainda não disponível nesta demonstração.');window.setTimeout(()=>setMessage(''),4000)}
 return <><Routes><Route path="/login" element={<Login startDemo={startDemo}/>}/><Route path="/cadastro" element={<Cadastro/>}/><Route path="/" element={demo?<Home onSoon={soon}/>:<Navigate to="/login" replace/>}/><Route path="/animais" element={demo?<Animals onSoon={soon}/>:<Navigate to="/login" replace/>}/><Route path="/animais/:id" element={demo?<Details onSoon={soon}/>:<Navigate to="/login" replace/>}/><Route path="*" element={<Navigate to={demo?'/':'/login'} replace/>}/></Routes>{message && <div className="toast"><Notice>{message}</Notice></div>}</>
}
