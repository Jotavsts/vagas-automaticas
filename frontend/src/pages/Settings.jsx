import { useState, useEffect } from 'react'
import { getCvs, addCv, renameCv, deleteCv, getChannels, addChannel, removeChannel } from '../services/api'
import Button from '../components/Button'

// Espelha FREE_TIER_MAX_CVS do backend. Gancho de assinatura futura.
const MAX_CVS = 2

// Canais verificados como ativos (têm web preview público habilitado)
const SUGGESTED_CHANNELS = [
  { username: 'canalvagasdeti', label: 'Canal Vagas de TI' },
  { username: 'devsjobs', label: 'DevJobs' },
]

function Settings() {
  const [cvs, setCvs] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  // Canais Telegram
  const [channels, setChannels] = useState(null)
  const [newChannel, setNewChannel] = useState('')
  const [channelError, setChannelError] = useState(null)
  const [addingChannel, setAddingChannel] = useState(false)

  async function load() {
    const data = await getCvs()
    setCvs(data)
  }

  async function loadChannels() {
    try {
      const data = await getChannels()
      setChannels(data.channels || [])
    } catch {
      setChannels([])
    }
  }

  useEffect(() => {
    load()
    loadChannels()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    if (!file) { setError('Selecione um arquivo PDF ou DOCX.'); return }
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

  async function handleAddChannel(username) {
    const ch = (username || newChannel).trim().replace(/^@/, '')
    if (!ch) return
    setChannelError(null)
    setAddingChannel(true)
    try {
      const data = await addChannel(ch)
      setChannels(data.channels)
      setNewChannel('')
    } catch (err) {
      setChannelError(err.response?.data?.error || 'Falha ao adicionar canal.')
    } finally {
      setAddingChannel(false)
    }
  }

  async function handleRemoveChannel(ch) {
    try {
      const data = await removeChannel(ch)
      setChannels(data.channels)
    } catch {
      await loadChannels()
    }
  }

  if (!cvs) return <p className="text-ink-secondary text-sm">Carregando...</p>

  const atLimit = cvs.length >= MAX_CVS

  return (
    <div className="max-w-2xl flex flex-col gap-8">

      {/* ── Seção: Meus Currículos ── */}
      <section>
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
                        aria-label="Novo nome do currículo"
                        className="px-2.5 py-1 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <Button variant="primary" onClick={() => handleRename(cv.id)}>Salvar</Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <div className="font-semibold text-ink text-title flex items-center gap-2">
                      {cv.label || 'Currículo'}
                      <button
                        onClick={() => { setEditingId(cv.id); setEditLabel(cv.label || '') }}
                        className="text-xs font-medium text-ink-secondary hover:text-primary transition-colors"
                      >
                        renomear
                      </button>
                    </div>
                  )}
                  <div className="text-caption text-ink-secondary mt-0.5">{cv.full_name}</div>
                  <p className="text-xs text-ink-secondary mt-1.5 line-clamp-2">{cv.summary}</p>
                </div>
                {cvs.length > 1 && (
                  <Button variant="secondary" onClick={() => handleDelete(cv.id)}>Excluir</Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {cvs.length === 0 && (
          <p className="text-sm text-ink-secondary mb-3">Você ainda não tem nenhum currículo cadastrado.</p>
        )}

        <form onSubmit={handleAdd} className="bg-surface rounded-xl p-4 border border-border">
          <div className="font-semibold text-ink text-sm mb-2">Adicionar currículo</div>
          {atLimit ? (
            <p className="text-xs text-ink-secondary">
              Você atingiu o limite de {MAX_CVS} currículos do plano gratuito. Em breve dá pra adicionar mais com uma assinatura.
            </p>
          ) : (
            <>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                aria-label="Selecionar arquivo de currículo (PDF ou DOCX)"
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
      </section>

      {/* ── Seção: Canais do Telegram ── */}
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <span>🔎</span> Canais do Telegram
          </h2>
          <p className="text-sm text-ink-secondary mt-0.5">
            Vagas dos canais que você adicionar serão coletadas automaticamente a cada ciclo de busca e aparecem no Dashboard.
            Use apenas canais <strong>públicos</strong> com web preview ativo.
          </p>
        </div>

        {/* Lista de canais ativos */}
        <div className="flex flex-col gap-2 mb-4">
          {channels === null && <p className="text-sm text-ink-secondary">Carregando...</p>}
          {channels !== null && channels.length === 0 && (
            <p className="text-sm text-ink-secondary">Nenhum canal adicionado ainda.</p>
          )}
          {channels !== null && channels.map((ch) => (
            <div key={ch} className="bg-surface rounded-xl px-4 py-3 border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span style={{ fontSize: '18px' }}>✈️</span>
                <div>
                  <span className="font-semibold text-ink text-sm">@{ch}</span>
                  <a
                    href={`https://t.me/${ch}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-ink-secondary hover:text-primary ml-2"
                  >
                    ver canal ↗
                  </a>
                </div>
              </div>
              <button
                onClick={() => handleRemoveChannel(ch)}
                className="text-xs font-semibold text-ink-secondary hover:text-danger-ink transition-colors"
                title="Remover canal"
              >
                remover
              </button>
            </div>
          ))}
        </div>

        {/* Sugestões de canais verificados */}
        {channels !== null && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-ink-secondary mb-2 uppercase tracking-wide">Canais verificados</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_CHANNELS
                .filter((s) => !channels.includes(s.username))
                .map((s) => (
                  <button
                    key={s.username}
                    onClick={() => handleAddChannel(s.username)}
                    disabled={addingChannel}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-tag text-tag-ink hover:bg-primary hover:text-white hover:border-primary transition-all"
                  >
                    + @{s.username}
                    <span className="ml-1 opacity-60">({s.label})</span>
                  </button>
                ))}
              {SUGGESTED_CHANNELS.every((s) => channels.includes(s.username)) && (
                <span className="text-xs text-ink-secondary">✓ Todos os canais verificados já adicionados</span>
              )}
            </div>
          </div>
        )}

        {/* Input para canal personalizado */}
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="font-semibold text-ink text-sm mb-2">Adicionar canal personalizado</div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary text-sm font-semibold">@</span>
              <input
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value.replace(/^@/, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()}
                placeholder="username_do_canal"
                aria-label="Username do canal Telegram"
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-ink-secondary/50"
              />
            </div>
            <Button variant="primary" onClick={() => handleAddChannel()} disabled={addingChannel || !newChannel.trim()}>
              {addingChannel ? '...' : 'Adicionar'}
            </Button>
          </div>
          {channelError && <p className="text-xs text-danger-ink mt-2">{channelError}</p>}
          <p className="text-xs text-ink-secondary mt-2">
            Somente canais com preview público funcionam (t.me/s/username). Grupos privados são ignorados.
          </p>
        </div>
      </section>

    </div>
  )
}

export default Settings
