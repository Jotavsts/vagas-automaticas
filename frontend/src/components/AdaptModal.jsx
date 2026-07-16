import { useState, useEffect } from 'react'
import { adaptJob, getAdaptation, approveJob } from '../services/api'
import Button from './Button'
import Badge from './Badge'
import Tag from './Tag'

function AdaptModal({ job, onClose, onApproved }) {
  const [loading, setLoading] = useState(true)
  const [adaptation, setAdaptation] = useState(null)
  const [rejected, setRejected] = useState(null)
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      let result
      if (job.status === 'new') {
        result = await adaptJob(job.id)
      } else {
        const existing = await getAdaptation(job.id)
        result = { adapted: true, adaptation: existing.adaptation }
      }
      if (cancelled) return
      if (result.adapted) {
        setAdaptation(result.adaptation)
      } else {
        setRejected(result)
      }
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [job.id, job.status])

  async function handleApprove() {
    setApproving(true)
    const result = await approveJob(job.id)
    const response = await fetch(`http://localhost:5000${result.downloadUrl}`)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = result.downloadUrl.split('/').pop()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
    window.open(result.jobUrl, '_blank')
    setApproving(false)
    onApproved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl shadow-primary/20"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p className="text-ink-secondary text-sm">Adaptando currículo para esta vaga...</p>}

        {!loading && rejected && (
          <div>
            <p className="text-sm text-danger-ink mb-3">
              Não foi possível adaptar com segurança: {rejected.reason}. Mostrando o CV original.
            </p>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )}

        {!loading && adaptation && (
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="text-title font-bold text-ink pr-3">{job.title}</div>
              <Badge score={adaptation.match_score} />
            </div>

            {adaptation.cv_label && (
              <div className="mb-3">
                <Tag variant="neutral">CV usado: {adaptation.cv_label}</Tag>
              </div>
            )}

            <p className="text-caption text-ink leading-relaxed mb-4">
              {adaptation.adapted_content.summary}
            </p>

            <div className="flex gap-1.5 flex-wrap mb-4">
              {Object.values(adaptation.adapted_content.skills || {})
                .flat()
                .slice(0, 6)
                .map((skill) => (
                  <Tag key={skill} variant="relevant">
                    {skill}
                  </Tag>
                ))}
            </div>

            {adaptation.match_notes && (
              <div className="flex gap-2 p-2.5 bg-warning rounded-lg mb-4">
                <span className="text-sm">💬</span>
                <p className="text-xs text-warning-ink leading-snug">{adaptation.match_notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={handleApprove} disabled={approving}>
                {approving ? 'Preparando...' : 'Aprovar e preparar envio'}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Descartar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdaptModal
