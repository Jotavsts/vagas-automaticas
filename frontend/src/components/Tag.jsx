function Tag({ variant = 'neutral', children }) {
  const variants = {
    relevant: 'bg-tag text-tag-ink font-semibold',
    neutral: 'bg-muted text-muted-ink',
    success: 'bg-success text-success-ink font-semibold',
    danger: 'bg-danger text-danger-ink font-semibold',
  }
  return (
    <span className={`text-[11px] px-2 py-1 rounded-md ${variants[variant]}`}>
      {children}
    </span>
  )
}

export default Tag
