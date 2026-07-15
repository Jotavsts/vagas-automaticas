import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/api'
import Button from '../components/Button'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await login(email, password)
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface rounded-2xl p-6 max-w-sm w-full border border-border shadow-2xl shadow-primary/10"
      >
        <h1 className="text-lg font-bold text-ink mb-1">Entrar</h1>
        <p className="text-sm text-ink-secondary mb-5">Vagas Automáticas</p>

        <label className="block text-xs font-semibold text-ink-secondary mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 px-3.5 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <label className="block text-xs font-semibold text-ink-secondary mb-1">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3.5 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        {error && <p className="text-xs text-danger-ink mb-3">{error}</p>}

        <Button variant="primary" type="submit" className="w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>

        <p className="text-xs text-ink-secondary mt-4 text-center">
          Não tem conta?{' '}
          <Link to="/signup" className="text-primary font-semibold hover:text-primary-hover">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Login
