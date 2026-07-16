function Badge({ score }) {
  const value = score ?? 0
  let classes
  if (value >= 50) {
    classes = 'bg-primary text-white'
  } else if (value >= 25) {
    classes = 'bg-tag text-tag-ink'
  } else {
    classes = 'bg-muted text-muted-ink'
  }
  return (
    <span
      className={`font-mono text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap ${classes}`}
      aria-label={`${value}% de compatibilidade com a vaga`}
    >
      {value}%
    </span>
  )
}

export default Badge
