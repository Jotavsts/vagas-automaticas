import Badge from './Badge'
import Tag from './Tag'
import Button from './Button'

const SENIOR_REGEX = /senior|s[êe]nior|lead|principal|staff/i

const MODALITY_LABELS = {
  remoto: 'Remoto',
  presencial: 'Presencial',
  hibrido: 'Híbrido',
}

function JobCard({ job, onAdapt, onViewAdaptation }) {
  const isSenior = SENIOR_REGEX.test(job.title)
  const isAdapted = job.status === 'adapted' || job.status === 'approved'

  return (
    <div className="bg-surface rounded-xl p-4 border border-border transition-all duration-150 hover:border-border-hover hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5">
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-semibold text-ink text-title">{job.title}</div>
          <div className="text-ink-secondary text-caption mt-0.5">
            {job.company || 'Empresa não informada'}
            {job.location ? ` · ${job.location}` : ''}
            {job.posted_at ? ` · Publicada em ${new Date(job.posted_at).toLocaleDateString('pt-BR')}` : ''}
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
