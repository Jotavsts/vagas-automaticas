import { useState, useEffect } from 'react'
import { getCvs, addCv, renameCv, deleteCv } from '../services/api'
import Button from '../components/Button'

// Espelha FREE_TIER_MAX_CVS do backend. Gancho de assinatura futura.
const MAX_CVS = 2

function Settings() {
  const [cvs, setCvs] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  async function load() {
    const data = await getCvs()
    setCvs(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Selecione um arquivo PDF ou DOCX.')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('cv', file)
      await addCv(formData)
      setFile(null)
      e.target.reset()
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao adicionar currículo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRename(id) {
    if (!editLabel.trim()) return
    await renameCv(id, editLabel.trim())
    setEditingId(null)
    await load()
  }

  async function handleDelete(id) {
    await deleteCv(id)
    await load()
  }

  if (!cvs) return <p className="text-ink-secondary text-sm">Carregando currículos...</p>

  const atLimit = cvs.length >= MAX_CVS

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-ink">Meus currículos</h1>
        <p className="text-sm text-ink-secondary mt-0.5">
          Suba versões diferentes (ex: uma da sua área, outra pra um trampo alternativo). A IA
          escolhe sozinha a mais alinhada a cada vaga na hora de adaptar.
        </p>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {cvs.map((cv) => (
          <div key={cv.id} className="bg-surface rounded-xl p-4 border border-border">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                {editingId === cv.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <Button variant="primary" onClick={() => handleRename(cv.id)}>
                      Salvar
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="font-semibold text-ink text-[15px] flex items-center gap-2">
                    {cv.label || 'Currículo'}
                    <button
                      onClick={() => {
                        setEditingId(cv.id)
                        setEditLabel(cv.label || '')
                      }}
                      className="text-xs font-medium text-ink-secondary hover:text-primary transition-colors"
                    >
                      renomear
                    </button>
                  </div>
                )}
                <div className="text-[13px] text-ink-secondary mt-0.5">{cv.full_name}</div>
                <p className="text-xs text-ink-secondary mt-1.5 line-clamp-2">{cv.summary}</p>
              </div>
              {cvs.length > 1 && (
                <Button variant="secondary" onClick={() => handleDelete(cv.id)}>
                  Excluir
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="bg-surface rounded-xl p-4 border border-border">
        <div className="font-semibold text-ink text-sm mb-2">Adicionar currículo</div>
        {atLimit ? (
          <p className="text-xs text-ink-secondary">
            Você atingiu o limite de {MAX_CVS} currículos do plano gratuito. Em breve dá pra
            adicionar mais com uma assinatura.
          </p>
        ) : (
          <>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full mb-3 text-sm text-ink-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-tag file:text-tag-ink file:text-xs file:font-semibold"
            />
            {error && <p className="text-xs text-danger-ink mb-2">{error}</p>}
            <Button variant="primary" type="submit" disabled={uploading}>
              {uploading ? 'Lendo currículo...' : 'Adicionar'}
            </Button>
          </>
        )}
      </form>

      <p className="text-xs text-ink-secondary mt-4">
        A edição do conteúdo do CV (experiências, skills) ainda é feita direto no banco nesta fase —
        aqui você gerencia quais currículos existem e seus rótulos.
      </p>
    </div>
  )
}

export default Settings
