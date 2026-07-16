import { useState, useEffect, useMemo } from 'react'
import { getJobs, collectJobs } from '../services/api'
import JobCard from '../components/JobCard'
import FilterBar from '../components/FilterBar'
import Button from '../components/Button'

function Dashboard({ onAdapt, onViewAdaptation }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [modality, setModality] = useState('')
  const [state, setState] = useState('')

  async function loadJobs() {
    setLoading(true)
    const data = await getJobs()
    setJobs(data)
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [])

  async function handleCollect() {
    setCollecting(true)
    await collectJobs()
    await loadJobs()
    setCollecting(false)
  }

  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source))].sort(), [jobs])
  const states = useMemo(
    () => [...new Set(jobs.map((j) => j.state).filter(Boolean))].sort(),
    [jobs]
  )

  const filtered = useMemo(() => {
    return jobs
      .filter((j) => (source ? j.source === source : true))
      .filter((j) => (status ? j.status === status : true))
      .filter((j) => (modality ? j.modality === modality : true))
      .filter((j) => (state ? j.state === state : true))
      .filter((j) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          j.title.toLowerCase().includes(q) ||
          (j.company || '').toLowerCase().includes(q) ||
          (j.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
  }, [jobs, source, status, modality, state, search])

  return (
    <div>
      <div className="flex justify-between items-baseline mb-5">
        <div>
          <div className="text-wordmark font-bold text-ink">Adapta Aí</div>
          <div className="text-xs text-ink-secondary mt-0.5">{jobs.length} vagas coletadas</div>
        </div>
        <Button variant="primary" onClick={handleCollect} disabled={collecting}>
          {collecting ? 'Buscando...' : '↻ Buscar vagas agora'}
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        source={source}
        onSourceChange={setSource}
        status={status}
        onStatusChange={setStatus}
        modality={modality}
        onModalityChange={setModality}
        state={state}
        onStateChange={setState}
        sources={sources}
        states={states}
      />

      {loading ? (
        <p className="text-ink-secondary text-sm">Carregando vagas...</p>
      ) : filtered.length === 0 ? (
        <p className="text-ink-secondary text-sm">Nenhuma vaga encontrada com esses filtros.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} onAdapt={onAdapt} onViewAdaptation={onViewAdaptation} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
