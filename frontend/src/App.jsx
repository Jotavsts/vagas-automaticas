import JobCard from './components/JobCard'

const FAKE_JOB = {
  id: 999,
  title: 'Backend Developer Jr.',
  company: 'Empresa Teste',
  location: 'Remoto',
  tags: ['Python', 'Junior'],
  source: 'arbeitnow',
  relevance_score: 72,
  status: 'new',
  url: 'https://example.com',
}

function App() {
  return (
    <div className="min-h-screen bg-bg p-6 max-w-md">
      <JobCard job={FAKE_JOB} onAdapt={() => {}} onViewAdaptation={() => {}} />
    </div>
  )
}

export default App
