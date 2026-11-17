import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Login, Cadastro, PrimeiroAcesso } from '../features/auth/AuthPages'
import { AuthProvider } from '../features/auth/AuthContext'
import { profileHome, useAuth, type Perfil } from '../features/auth/auth'
import { Home } from '../features/home/Home'
import { Animals, Details } from '../features/animals/AnimalPages'
import { InstitutionalFrame, PersonalFrame, WorkspaceHome } from '../features/workspace/Workspace'
import { Button, Notice } from '../shared/components/Ui'

const PersonalOverview = lazy(async () => ({ default: (await import('../features/personal/PersonalOverview')).PersonalOverview }))
const AdoptionList = lazy(async () => ({ default: (await import('../features/personal/PersonalLists')).AdoptionList }))
const DonationList = lazy(async () => ({ default: (await import('../features/personal/PersonalLists')).DonationList }))
const SponsorshipList = lazy(async () => ({ default: (await import('../features/personal/PersonalLists')).SponsorshipList }))
const SponsorshipDetails = lazy(async () => ({ default: (await import('../features/personal/PersonalLists')).SponsorshipDetails }))
const AdoptedAnimals = lazy(async () => ({ default: (await import('../features/personal/AdoptedPages')).AdoptedAnimals }))
const AdoptedMedicalHistory = lazy(async () => ({ default: (await import('../features/personal/AdoptedPages')).AdoptedMedicalHistory }))
const AdoptedMedicalRecord = lazy(async () => ({ default: (await import('../features/personal/AdoptedPages')).AdoptedMedicalRecord }))
const PersonalAction = lazy(async () => ({ default: (await import('../features/personal/PersonalActions')).PersonalAction }))
const InstitutionalDashboard = lazy(async () => ({ default: (await import('../features/institutional/Dashboard')).Dashboard }))
const InstitutionalAnimalList = lazy(async () => ({ default: (await import('../features/institutional/Animals')).AnimalList }))
const InstitutionalAnimalCreate = lazy(async () => ({ default: (await import('../features/institutional/Animals')).AnimalCreate }))
const InstitutionalAnimalDetails = lazy(async () => ({ default: (await import('../features/institutional/Animals')).AnimalDetails }))
const InstitutionalEmployeeList = lazy(async () => ({ default: (await import('../features/institutional/Employees')).EmployeeList }))
const InstitutionalEmployeeCreate = lazy(async () => ({ default: (await import('../features/institutional/Employees')).EmployeeCreate }))
const InstitutionalEmployeeDetails = lazy(async () => ({ default: (await import('../features/institutional/Employees')).EmployeeDetails }))
const InstitutionalEmployeeEdit = lazy(async () => ({ default: (await import('../features/institutional/Employees')).EmployeeEdit }))
const InstitutionalAdoptionList = lazy(async () => ({ default: (await import('../features/institutional/Adoptions')).AdoptionList }))
const InstitutionalAdoptionDetails = lazy(async () => ({ default: (await import('../features/institutional/Adoptions')).AdoptionDetails }))
const ClinicalAnimalSelect = lazy(async () => ({ default: (await import('../features/institutional/MedicalRecords')).ClinicalAnimalSelect }))
const MedicalHistory = lazy(async () => ({ default: (await import('../features/institutional/MedicalRecords')).MedicalHistory }))
const MedicalCreate = lazy(async () => ({ default: (await import('../features/institutional/MedicalRecords')).MedicalCreate }))
const MedicalDetails = lazy(async () => ({ default: (await import('../features/institutional/MedicalRecords')).MedicalDetails }))
const MedicalCorrect = lazy(async () => ({ default: (await import('../features/institutional/MedicalRecords')).MedicalCorrect }))
const MedicalCorrections = lazy(async () => ({ default: (await import('../features/institutional/MedicalRecords')).MedicalCorrections }))

function Protected({ children, allowed }: { children: ReactNode; allowed: Perfil[] }) {
  const { status, user, sessionError, refresh } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <main className="auth-state" role="status">Verificando sua sessão…</main>
  if (status === 'error') return <main className="auth-state"><Notice variant="error">{sessionError}</Notice><Button onClick={refresh}>Tentar novamente</Button></main>
  if (status === 'expired') return <Navigate to="/login" replace state={{ from: location.pathname + location.search, sessionExpired: true }} />
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!user || !allowed.includes(user.perfil) || (user.perfil !== 'USUARIO' && user.perfil !== 'CRIADOR_PLATAFORMA' && user.ongId === null)) {
    return <main className="auth-state"><h1>Acesso não permitido</h1><p>Esta área não está disponível para sua conta.</p><Link className="button button-primary" to={user ? profileHome(user.perfil) : '/'}>Ir para minha área</Link></main>
  }
  return children
}

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/cadastro" element={<Cadastro />} />
    <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
    <Route path="/" element={<Home />} />
    <Route path="/minha-area" element={<Protected allowed={['USUARIO']}><PersonalFrame><Outlet /></PersonalFrame></Protected>}>
      <Route index element={<PersonalOverview />} />
      <Route path="solicitacoes" element={<AdoptionList />} />
      <Route path="doacoes" element={<DonationList />} />
      <Route path="apadrinhamentos" element={<SponsorshipList />} />
      <Route path="apadrinhamentos/:id" element={<SponsorshipDetails />} />
      <Route path="adotados" element={<AdoptedAnimals />} />
      <Route path="adotados/:animalId/prontuarios" element={<AdoptedMedicalHistory />} />
      <Route path="adotados/:animalId/prontuarios/:recordId" element={<AdoptedMedicalRecord />} />
    </Route>
    <Route path="/ong" element={<Protected allowed={['ADMINISTRADOR', 'VOLUNTARIO', 'VETERINARIO']}><InstitutionalFrame /></Protected>}>
      <Route index element={<InstitutionalDashboard />} />
      <Route path="animais" element={<Protected allowed={['ADMINISTRADOR', 'VOLUNTARIO', 'VETERINARIO']}><InstitutionalAnimalList /></Protected>} />
      <Route path="animais/novo" element={<Protected allowed={['ADMINISTRADOR', 'VOLUNTARIO']}><InstitutionalAnimalCreate /></Protected>} />
      <Route path="animais/:id" element={<Protected allowed={['ADMINISTRADOR', 'VOLUNTARIO', 'VETERINARIO']}><InstitutionalAnimalDetails /></Protected>} />
      <Route path="funcionarios" element={<Protected allowed={['ADMINISTRADOR']}><InstitutionalEmployeeList /></Protected>} />
      <Route path="funcionarios/novo" element={<Protected allowed={['ADMINISTRADOR']}><InstitutionalEmployeeCreate /></Protected>} />
      <Route path="funcionarios/:id" element={<Protected allowed={['ADMINISTRADOR']}><InstitutionalEmployeeDetails /></Protected>} />
      <Route path="funcionarios/:id/editar" element={<Protected allowed={['ADMINISTRADOR']}><InstitutionalEmployeeEdit /></Protected>} />
      <Route path="adocoes" element={<Protected allowed={['ADMINISTRADOR', 'VOLUNTARIO']}><InstitutionalAdoptionList /></Protected>} />
      <Route path="adocoes/:id" element={<Protected allowed={['ADMINISTRADOR', 'VOLUNTARIO']}><InstitutionalAdoptionDetails /></Protected>} />
      <Route path="prontuarios" element={<ClinicalAnimalSelect />} />
      <Route path="animais/:animalId/prontuarios" element={<MedicalHistory />} />
      <Route path="animais/:animalId/prontuarios/novo" element={<Protected allowed={['ADMINISTRADOR', 'VETERINARIO']}><MedicalCreate /></Protected>} />
      <Route path="animais/:animalId/prontuarios/:recordId" element={<MedicalDetails />} />
      <Route path="animais/:animalId/prontuarios/:recordId/corrigir" element={<Protected allowed={['ADMINISTRADOR', 'VETERINARIO']}><MedicalCorrect /></Protected>} />
      <Route path="animais/:animalId/prontuarios/:recordId/correcoes" element={<MedicalCorrections />} />
    </Route>
    <Route path="/plataforma" element={<Protected allowed={['CRIADOR_PLATAFORMA']}><WorkspaceHome area="platform" /></Protected>} />
    <Route path="/animais" element={<Animals />} />
    <Route path="/animais/:id" element={<Details />} />
    <Route path="/animais/:id/solicitar" element={<Protected allowed={['USUARIO']}><PersonalFrame><PersonalAction action="solicitar" /></PersonalFrame></Protected>} />
    <Route path="/animais/:id/doar" element={<Protected allowed={['USUARIO']}><PersonalFrame><PersonalAction action="doar" /></PersonalFrame></Protected>} />
    <Route path="/animais/:id/apadrinhar" element={<Protected allowed={['USUARIO']}><PersonalFrame><PersonalAction action="apadrinhar" /></PersonalFrame></Protected>} />
    <Route path="*" element={<Navigate to="/animais" replace />} />
  </Routes>
}

export function App() { return <AuthProvider><Suspense fallback={<main className="auth-state" role="status">Carregando página…</main>}><AppRoutes /></Suspense></AuthProvider> }
