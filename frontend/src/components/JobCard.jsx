import Badge from './Badge'
import Tag from './Tag'
import Button from './Button'

const SENIOR_REGEX = /senior|s[êe]nior|lead|principal|staff/i

const MODALITY_LABELS = {
  remoto: 'Remoto',
  presencial: 'Presencial',
  hibrido: 'Híbrido',
}

/**
 * Formata a data de publicação/coleta em um texto relativo humanizado (Hoje, Ontem, Há X dias).
 */
function getRelativeDateInfo(postedAt, collectedAt) {
  const targetDate = postedAt ? new Date(postedAt) : collectedAt ? new Date(collectedAt) : null
  if (!targetDate || isNaN(targetDate.getTime())) {
    return { label: 'Data não informada', isFresh: false, isToday: false }
  }

  const now = new Date()
  const diffMs = now.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 24 && now.getDate() === targetDate.getDate()) {
    return { label: '🔥 Publicada Hoje', isFresh: true, isToday: true }
  }
  if (diffDays <= 1) {
    return { label: '⚡ Ontem', isFresh: true, isToday: false }
  }
  if (diffDays < 7) {
    return { label: `⏱️ Há ${diffDays} dias`, isFresh: diffDays <= 3, isToday: false }
  }

  return {
    label: `🗓️ ${targetDate.toLocaleDateString('pt-BR')}`,
    isFresh: false,
    isToday: false,
  }
}

function JobCard({ job, onAdapt, onViewAdaptation }) {
  const isSenior = SENIOR_REGEX.test(job.title)
  const isAdapted = job.status === 'adapted' || job.status === 'approved'
  const dateInfo = getRelativeDateInfo(job.posted_at, job.collected_at)

  return (
    <div
      className={`bg-surface rounded-xl p-4 border transition-all duration-150 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 ${
        dateInfo.isToday
          ? 'border-primary/50 shadow-sm shadow-primary/5'
          : 'border-border hover:border-border-hover'
      }`}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-semibold text-ink text-title flex items-center gap-2">
            {job.title}
          </div>
          <div className="text-ink-secondary text-caption mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-ink/80">{job.company || 'Empresa não informada'}</span>
            {job.location && <span>· {job.location}</span>}
            <span
              className={`font-semibold ${
                dateInfo.isToday
                  ? 'text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]'
                  : dateInfo.isFresh
                  ? 'text-amber-500'
                  : 'text-ink-secondary/70'
              }`}
            >
              · {dateInfo.label}
            </span>
          </div>
        </div>
        <Badge score={job.relevance_score} />
      </div>

      <div className="mt-2.5 flex gap-1.5 flex-wrap">
        {(job.tags || []).slice(0, 3).map((tag) => (
          <Tag key={tag} variant="relevant">{tag}</Tag>
        ))}
        <Tag variant="neutral">{job.source}</Tag>
        {job.modality && <Tag variant="neutral">{MODALITY_LABELS[job.modality] || job.modality}</Tag>}
        {job.state && <Tag variant="neutral">{job.state}</Tag>}
        {isSenior && <Tag variant="danger">Sênior</Tag>}
        {isAdapted && <Tag variant="success">✓ Adaptado</Tag>}
      </div>

      <div className="mt-3 flex gap-2">
        {isAdapted ? (
          <Button variant="secondary" className="flex-1" onClick={() => onViewAdaptation(job)}>
            Ver CV adaptado
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" onClick={() => onAdapt(job)}>
            Adaptar CV
          </Button>
        )}
        <Button variant="secondary" onClick={() => window.open(job.url, '_blank')}>
          Ver vaga ↗
        </Button>
      </div>
    </div>
  )
}

export default JobCard
