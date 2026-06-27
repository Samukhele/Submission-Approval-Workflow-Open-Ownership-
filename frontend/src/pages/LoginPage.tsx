import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Message } from '../components/Feedback'

export function LoginPage() {
  const { user, login, loading } = useAuth()
  const [email, setEmail] = useState('applicant@demo.com')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to={user.role === 'REVIEWER' ? '/review' : '/'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error: string }).error)
          : 'Login failed'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p className="muted">Use seeded demo accounts to explore the workflow.</p>
        <Message type="error" message={error} />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <button type="submit" disabled={submitting || loading}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="demo-hints">
          <p><strong>Applicant:</strong> applicant@demo.com / password123</p>
          <p><strong>Reviewer:</strong> reviewer@demo.com / password123</p>
        </div>
      </form>
    </div>
  )
}
