import { useState, useEffect, useMemo } from 'react'
import { getJobs, collectJobs } from '../services/api'
import JobCard from '../components/JobCard'
import FilterBar from '../components/FilterBar'
import Button from '../components/Button'

const SENIOR_WORDS = ['senior', 'sênior', 'sr.', 'lead', 'principal', 'staff', 'head of']

/**
 * Regra de Localização:
 * - Vagas REMOTAS são aceitas de qualquer lugar.
 * - Vagas PRESENCIAIS / HÍBRIDAS só são aceitas se forem em Aracaju / Sergipe (SE).
 * Presenciais de outros estados (SP, RJ, etc.) são ocultadas automaticamente.
 */
function isJobLocationAllowed(j) {
  if (j.modality === 'remoto') return true
  const loc = `${j.location || ''} ${j.state || ''}`.toLowerCase()
  return loc.includes('aracaju') || loc.includes('sergipe') || /\bse\b/.test(loc)
}

function Dashboard({ onAdapt, onViewAdaptation }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [modality, setModality] = useState('')
  const [state, setState] = useState('')
  const [hideSenior, setHideSenior] = useState(true)
  const [minScore, setMinScore] = useState(0)
  const [dateFilter, setDateFilter] = useState('7days')
  const [sortBy, setSortBy] = useState('recent')

  async function loadJobs() {
    setLoading(true)
    try {
      const data = await getJobs()
      setJobs(data)
      setError(null)
    } catch (err) {
      setError('Falha ao carregar vagas. Tente novamente.')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [])

  async function handleCollect() {
    setCollecting(true)
    try {
      await collectJobs()
      await loadJobs()
    } catch (err) {
      setError('Falha ao buscar vagas novas. Tente novamente.')
    }
    setCollecting(false)
  }

  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source))].sort(), [jobs])
  const states = useMemo(
    () => [...new Set(jobs.map((j) => j.state).filter(Boolean))].sort(),
    [jobs]
  )

  const filtered = useMemo(() => {
    const now = new Date()

    return jobs
      .filter(isJobLocationAllowed) // Aplica regra: Presencial só Aracaju/SE; Remoto de qualquer lugar
      .filter((j) => (source ? j.source === source : true))
      .filter((j) => (status ? j.status === status : true))
      .filter((j) => (modality ? j.modality === modality : true))
      .filter((j) => (state ? j.state === state : true))
      .filter((j) => {
        if (!hideSenior) return true
        const titleLower = (j.title || '').toLowerCase()
        return !SENIOR_WORDS.some((sw) => titleLower.includes(sw))
      })
      .filter((j) => (j.relevance_score ?? 0) >= minScore)
      .filter((j) => {
        if (dateFilter === 'all') return true
        const targetDateStr = j.posted_at || j.collected_at
        if (!targetDateStr) return false
        const targetDate = new Date(targetDateStr)
        if (isNaN(targetDate.getTime())) return false

        const diffMs = now.getTime() - targetDate.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        if (dateFilter === 'today') return diffDays <= 1 && now.getDate() === targetDate.getDate()
        if (dateFilter === '3days') return diffDays <= 3
        if (dateFilter === '7days') return diffDays <= 7
        if (dateFilter === '14days') return diffDays <= 14
        return true
      })
      .filter((j) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          j.title.toLowerCase().includes(q) ||
          (j.company || '').toLowerCase().includes(q) ||
          (j.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          const dateA = new Date(a.posted_at || a.collected_at || 0).getTime()
          const dateB = new Date(b.posted_at || b.collected_at || 0).getTime()
          return dateB - dateA
        }
        return (b.relevance_score ?? 0) - (a.relevance_score ?? 0)
      })
  }, [jobs, source, status, modality, state, search, hideSenior, minScore, dateFilter, sortBy])

  return (
    <div>
      <div className="flex justify-between items-baseline mb-5">
        <div>
          <div className="text-wordmark font-bold text-ink">Adapta Aí</div>
          <div className="text-xs text-ink-secondary mt-0.5">
            {filtered.length} vagas exibidas (remotas de todo o Brasil + presenciais em Aracaju/SE)
          </div>
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
        hideSenior={hideSenior}
        onHideSeniorChange={setHideSenior}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sources={sources}
        states={states}
      />

      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}

      {loading ? (
        <p className="text-ink-secondary text-sm">Carregando vagas...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-xl p-6 border border-border text-center">
          <p className="text-ink font-semibold text-sm mb-1">Nenhuma vaga encontrada para este período e localização.</p>
          <p className="text-xs text-ink-secondary mb-3">
            Experimente mudar a opção &quot;Data da vaga&quot; para &quot;Todas as datas&quot; ou clicar em &quot;Buscar vagas agora&quot;.
          </p>
          <Button variant="secondary" onClick={() => { setDateFilter('all'); setHideSenior(false); setMinScore(0); setSearch(''); }}>
            Ver todas as vagas
          </Button>
        </div>
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
