import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import AdaptModal from './components/AdaptModal'

function App() {
  const [modalJob, setModalJob] = useState(null)

  return (
    <div className="min-h-screen bg-bg p-6">
      <Dashboard onAdapt={setModalJob} onViewAdaptation={setModalJob} />
      {modalJob && (
        <AdaptModal job={modalJob} onClose={() => setModalJob(null)} onApproved={() => {}} />
      )}
    </div>
  )
}

export default App
