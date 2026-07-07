import { useState, useEffect } from 'react'
import { getApplications } from '../services/api'

function History() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApplications().then((data) => {
      setApplications(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-ink-secondary text-sm">Carregando histórico...</p>
  if (applications.length === 0) {
    return <p className="text-ink-secondary text-sm">Nenhuma candidatura aprovada ainda.</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {applications.map((app) => (
        <div
          key={app.id}
          className="bg-surface rounded-xl p-4 border border-border flex justify-between items-center"
        >
          <div>
            <div className="font-semibold text-ink text-[15px]">{app.title}</div>
            <div className="text-ink-secondary text-[13px] mt-0.5">
              {app.company} · aprovado em {new Date(app.approved_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div className="flex gap-3">
            <a
              href={`http://localhost:5000${app.pdf_path}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Ver PDF
            </a>
            <a
              href={app.job_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-ink-secondary hover:text-primary"
            >
              Ver vaga ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

export default History
