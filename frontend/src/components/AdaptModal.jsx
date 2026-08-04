import { useState, useEffect } from 'react'
import { adaptJob, getAdaptation, approveJob, getCvs } from '../services/api'
import Button from './Button'
import Badge from './Badge'
import Tag from './Tag'

function AdaptModal({ job, onClose, onApproved }) {
  const [loading, setLoading] = useState(true)
  const [adaptation, setAdaptation] = useState(null)
  const [rejected, setRejected] = useState(null)
  const [approving, setApproving] = useState(false)
  const [cvs, setCvs] = useState(null)
  const [pickedCvId, setPickedCvId] = useState(null)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function runAdapt(cvBaseId) {
    setLoading(true)
    const result = await adaptJob(job.id, cvBaseId)
    if (result.adapted) {
      setAdaptation(result.adaptation)
    } else {
      setRejected(result)
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (job.status !== 'new') {
        setLoading(true)
        const existing = await getAdaptation(job.id)
        if (cancelled) return
        setAdaptation(existing.adaptation)
        setLoading(false)
        return
      }
      // Vaga nova: se tiver mais de 1 currículo, deixa escolher antes de adaptar.
      const cvList = await getCvs()
      if (cancelled) return
      if (cvList.length > 1) {
        setCvs(cvList)
        setLoading(false)
      } else {
        await runAdapt()
      }
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
    // Fechamento imediato é intencional — o download do PDF e a aba da vaga já servem como confirmação visual, sem precisar de um estado de sucesso adicional no modal.
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adapt-modal-title"
        className="bg-surface rounded-2xl p-6 max-w-md w-full border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p className="text-ink-secondary text-sm">Adaptando currículo para esta vaga...</p>}

        {!loading && cvs && !adaptation && !rejected && (
          <div>
            <div id="adapt-modal-title" className="text-title font-bold text-ink mb-1">{job.title}</div>
            <p className="text-sm text-ink-secondary mb-4">Qual currículo usar pra adaptar essa vaga?</p>
            <div className="flex flex-col gap-2 mb-4">
              {cvs.map((cv) => (
                <button
                  key={cv.id}
                  onClick={() => setPickedCvId(cv.id)}
                  className={`text-left px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                    pickedCvId === cv.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-ink hover:border-primary/40'
                  }`}
                >
                  {cv.label || 'Currículo'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                disabled={!pickedCvId}
                onClick={() => runAdapt(pickedCvId)}
              >
                Adaptar com esse currículo
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

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
              <div id="adapt-modal-title" className="text-title font-bold text-ink pr-3">{job.title}</div>
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

        {!loading && !rejected && !adaptation && (
          <p className="text-sm text-ink-secondary">Nenhuma adaptação disponível pra essa vaga.</p>
        )}
      </div>
    </div>
  )
}

export default AdaptModal
