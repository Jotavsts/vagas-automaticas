function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-transparent text-ink-secondary border border-border hover:border-primary hover:text-primary font-medium',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export default Button
