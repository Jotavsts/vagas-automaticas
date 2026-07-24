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
  hideSenior,
  onHideSeniorChange,
  minScore,
  onMinScoreChange,
  dateFilter,
  onDateFilterChange,
  sortBy,
  onSortByChange,
  sources,
  states,
}) {
  const selectClass =
    'px-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40'

  return (
    <div className="flex flex-col gap-3 mb-5">
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por título, empresa, tecnologia..."
          aria-label="Buscar vagas"
          className="flex-1 min-w-[200px] px-3.5 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select value={modality} onChange={(e) => onModalityChange(e.target.value)} aria-label="Filtrar por modalidade" className={selectClass}>
          <option value="">Todas as modalidades</option>
          <option value="remoto">Remoto</option>
          <option value="presencial">Presencial</option>
          <option value="hibrido">Híbrido</option>
        </select>
        <select value={state} onChange={(e) => onStateChange(e.target.value)} aria-label="Filtrar por estado" className={selectClass}>
          <option value="">Todos os estados</option>
          {states.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => onSourceChange(e.target.value)} aria-label="Filtrar por fonte" className={selectClass}>
          <option value="">Todas as fontes</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => onStatusChange(e.target.value)} aria-label="Filtrar por status" className={selectClass}>
          <option value="">Todos os status</option>
          <option value="new">Novo</option>
          <option value="adapted">Adaptado</option>
          <option value="approved">Aprovado</option>
        </select>
      </div>

      {/* Controles avançados de recência, ordenação e senioridade */}
      <div className="flex items-center gap-4 flex-wrap text-xs bg-surface/50 p-2.5 rounded-lg border border-border/60">
        
        {/* Filtro de Data / Recência */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink flex items-center gap-1">
            <span>🗓️</span> Data da vaga:
          </span>
          <select
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-border bg-surface text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todas as datas</option>
            <option value="today">🔥 Hoje</option>
            <option value="3days">⚡ Últimos 3 dias</option>
            <option value="7days">📅 Última semana (7d)</option>
            <option value="14days">🗓️ Últimos 14 dias</option>
          </select>
        </div>

        {/* Tipo de Ordenação */}
        <div className="flex items-center gap-2 border-l border-border pl-4">
          <span className="font-semibold text-ink flex items-center gap-1">
            <span>🔀</span> Ordenar por:
          </span>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-border bg-surface text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="recent">🕒 Mais recentes primeiro</option>
            <option value="relevance">🎯 Maior relevância primeiro</option>
          </select>
        </div>

        {/* Relevância Mínima */}
        <div className="flex items-center gap-2 border-l border-border pl-4">
          <span className="font-medium text-ink-secondary">Score mín.:</span>
          <select
            value={minScore}
            onChange={(e) => onMinScoreChange(Number(e.target.value))}
            className="px-2 py-1 rounded border border-border bg-surface text-xs font-semibold text-ink focus:outline-none"
          >
            <option value={0}>0%+</option>
            <option value={30}>30%+</option>
            <option value={50}>50%+</option>
            <option value={70}>70%+</option>
          </select>
        </div>

        {/* Checkbox Ocultar Sênior */}
        <label className="flex items-center gap-2 cursor-pointer font-medium text-ink border-l border-border pl-4">
          <input
            type="checkbox"
            checked={hideSenior}
            onChange={(e) => onHideSeniorChange(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary/40 w-4 h-4 cursor-pointer"
          />
          <span>Ocultar Sênior / Lead</span>
        </label>

      </div>
    </div>
  )
}

export default FilterBar
