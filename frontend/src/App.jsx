import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AdaptModal from './components/AdaptModal'
import ProtectedRoute from './components/ProtectedRoute'

const TABS = [
  { id: 'dashboard', label: 'Vagas' },
  { id: 'history', label: 'Histórico' },
  { id: 'settings', label: 'Configurações' },
]

function AppShell() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [modalJob, setModalJob] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  function handleApproved() {
    setHistoryKey((k) => k + 1)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg">
      <nav className="flex items-center justify-between gap-1 px-6 pt-5">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-surface text-primary border border-border border-b-surface'
                  : 'text-ink-secondary hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pb-2">
          {user?.email && <span className="text-xs text-ink-secondary">{user.email}</span>}
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-ink-secondary hover:text-primary transition-colors"
          >
            Sair
          </button>
        </div>
      </nav>

      <main className="bg-surface border-t border-border p-6 min-h-[calc(100vh-64px)]">
        {activeTab === 'dashboard' && <Dashboard onAdapt={setModalJob} onViewAdaptation={setModalJob} />}
        {activeTab === 'history' && <History key={historyKey} />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {modalJob && (
        <AdaptModal job={modalJob} onClose={() => setModalJob(null)} onApproved={handleApproved} />
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
