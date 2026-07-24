import { useState, useEffect } from 'react'
import { getApplications, updateApplicationStatus } from '../services/api'

const STATUS_OPTIONS = [
  { value: 'enviado',     label: 'Enviado',      color: '#6B5F94' },
  { value: 'em_processo', label: 'Em processo',  color: '#D97706' },
  { value: 'oferta',      label: 'Oferta 🎉',    color: '#059669' },
  { value: 'rejeitado',   label: 'Rejeitado',    color: '#DC2626' },
  { value: 'desistiu',    label: 'Desisti',      color: '#6B7280' },
]

function StatusBadge({ status, onChange }) {
  const [open, setOpen] = useState(false)
  const current = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0]

  function handleSelect(value) {
    setOpen(false)
    if (value !== status) onChange(value)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Atualizar status"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '6px',
          border: `1.5px solid ${current.color}22`,
          background: `${current.color}11`,
          color: current.color,
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {current.label}
        <span style={{ fontSize: '10px', opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            background: 'var(--color-surface, #1a1a2e)',
            border: '1px solid var(--color-border, #2a2a40)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 50,
            minWidth: '140px',
            overflow: 'hidden',
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: opt.value === status ? 700 : 500,
                color: opt.color,
                background: opt.value === status ? `${opt.color}18` : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function History() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApplications().then((data) => {
      setApplications(data)
      setLoading(false)
    })
  }, [])

  function handleStatusChange(appId, newStatus) {
    // Atualização otimista: muda o estado local imediatamente
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
    )
    updateApplicationStatus(appId, newStatus).catch(() => {
      // Em caso de erro, reverte (recarrega do servidor)
      getApplications().then(setApplications)
    })
  }

  if (loading) return <p className="text-ink-secondary text-sm">Carregando histórico...</p>
  if (applications.length === 0) {
    return <p className="text-ink-secondary text-sm">Nenhuma candidatura aprovada ainda.</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {applications.map((app) => (
        <div
          key={app.id}
          className="bg-surface rounded-xl p-4 border border-border"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-semibold text-ink text-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {app.title}
            </div>
            <div className="text-ink-secondary text-caption" style={{ marginTop: '2px' }}>
              {app.company} · aprovado em {new Date(app.approved_at).toLocaleDateString('pt-BR')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <StatusBadge
              status={app.status || 'enviado'}
              onChange={(newStatus) => handleStatusChange(app.id, newStatus)}
            />
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
