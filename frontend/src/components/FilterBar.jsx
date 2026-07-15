function FilterBar({
  search,
  onSearchChange,
  source,
  onSourceChange,
  status,
  onStatusChange,
  modality,
  onModalityChange,
  state,
  onStateChange,
  sources,
  states,
}) {
  const selectClass =
    'px-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink'

  return (
    <div className="flex gap-2 flex-wrap mb-5">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por título, empresa, tecnologia..."
        className="flex-1 min-w-[200px] px-3.5 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <select value={modality} onChange={(e) => onModalityChange(e.target.value)} className={selectClass}>
        <option value="">Todas as modalidades</option>
        <option value="remoto">Remoto</option>
        <option value="presencial">Presencial</option>
        <option value="hibrido">Híbrido</option>
      </select>
      <select value={state} onChange={(e) => onStateChange(e.target.value)} className={selectClass}>
        <option value="">Todos os estados</option>
        {states.map((uf) => (
          <option key={uf} value={uf}>{uf}</option>
        ))}
      </select>
      <select value={source} onChange={(e) => onSourceChange(e.target.value)} className={selectClass}>
        <option value="">Todas as fontes</option>
        {sources.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={status} onChange={(e) => onStatusChange(e.target.value)} className={selectClass}>
        <option value="">Todos os status</option>
        <option value="new">Novo</option>
        <option value="adapted">Adaptado</option>
        <option value="approved">Aprovado</option>
      </select>
    </div>
  )
}

export default FilterBar
