import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ADMIN_USERNAMES = ['london', 'josh']

export async function isAdminAuthed(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

export function clearAdminSession() {
  supabase.auth.signOut()
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!ADMIN_USERNAMES.includes(username.trim().toLowerCase())) {
      setError('Invalid username or password.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError('Invalid username or password.')
        setLoading(false)
        return
      }
      // Establish a real Supabase session so RLS policies (is_admin / auth.uid) pass
      if (data.accessToken && data.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        })
        if (sessionError) {
          setError('Session error. Please try again.')
          setLoading(false)
          return
        }
      }
      navigate('/admin')
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-brand-black bg-grain">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/images/London_icon.png" alt="London Tint & Detail" className="mx-auto mb-4 h-16 w-16 object-contain" />
          <div className="font-badge text-xs tracking-[0.3em] text-brand-blue uppercase mt-1">Admin Dashboard</div>
        </div>
        <form onSubmit={submit} className="card p-8 space-y-4 bg-card-gradient">
          {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-brand-silver mb-2">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder="london"
            />
          </div>
          <div>
            <label className="block text-sm text-brand-silver mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-silver-dark hover:text-brand-silver transition-colors">
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" /><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="text-center mt-6">
          <a href="/" className="text-brand-silver-dark text-sm hover:text-brand-blue transition-colors">← Back to site</a>
        </div>
      </div>
    </div>
  )
}
