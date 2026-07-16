import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../services/api'
import Button from '../components/Button'

function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cvFile, setCvFile] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!cvFile) {
      setError('Envie seu currículo em PDF ou DOCX.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('password', password)
      formData.append('cv', cvFile)

      const result = await register(formData)
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao criar conta. Tente novamente.')
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
        <h1 className="text-lg font-bold text-ink mb-1">Criar conta</h1>
        <p className="text-sm text-ink-secondary mb-5">
          Envie seu currículo e a IA já deixa tudo pronto pra você adaptar CVs por vaga.
        </p>

        <label htmlFor="signup-email" className="block text-xs font-semibold text-ink-secondary mb-1">Email</label>
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 px-3.5 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <label htmlFor="signup-password" className="block text-xs font-semibold text-ink-secondary mb-1">Senha</label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-3 px-3.5 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <label htmlFor="signup-cv" className="block text-xs font-semibold text-ink-secondary mb-1">
          Currículo (PDF ou DOCX)
        </label>
        <input
          id="signup-cv"
          type="file"
          required
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setCvFile(e.target.files?.[0] || null)}
          className="w-full mb-4 text-sm text-ink-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-tag file:text-tag-ink file:text-xs file:font-semibold"
        />

        {error && <p role="alert" className="text-xs text-danger-ink mb-3">{error}</p>}

        <Button variant="primary" type="submit" className="w-full" disabled={loading}>
          {loading ? 'Criando conta e lendo seu CV...' : 'Criar conta'}
        </Button>

        <p className="text-xs text-ink-secondary mt-4 text-center">
          Já tem conta?{' '}
          <Link to="/login" className="text-primary font-semibold hover:text-primary-hover">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Signup
