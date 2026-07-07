import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import AdaptModal from './components/AdaptModal'

const TABS = [
  { id: 'dashboard', label: 'Vagas' },
  { id: 'history', label: 'Histórico' },
  { id: 'settings', label: 'Configurações' },
]

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [modalJob, setModalJob] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)

  function handleApproved() {
    setHistoryKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-bg">
      <nav className="flex gap-1 px-6 pt-5">
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

export default App
