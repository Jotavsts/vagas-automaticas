import { useState, useEffect } from 'react'
import { getCv } from '../services/api'

function Settings() {
  const [cv, setCv] = useState(null)

  useEffect(() => {
    getCv().then(setCv)
  }, [])

  if (!cv) return <p className="text-ink-secondary text-sm">Carregando CV...</p>

  return (
    <div className="bg-surface rounded-xl p-5 border border-border">
      <div className="font-semibold text-ink text-base mb-1">{cv.full_name}</div>
      <p className="text-ink-secondary text-sm mb-4">
        {cv.contact?.email} · {cv.contact?.location}
      </p>
      <p className="text-[13px] text-ink leading-relaxed mb-4">{cv.summary}</p>
      <p className="text-xs text-ink-secondary">
        Edição de CV e preferências ainda não tem formulário nesta fase — ajuste direto no banco
        (tabelas <code>cv_base</code> e <code>preferences</code>) e rode{' '}
        <code>node src/db/seed.js</code> novamente com os dados atualizados.
      </p>
    </div>
  )
}

export default Settings
