import { useQueryClient } from '@tanstack/react-query'
import { Activity, KeyRound, ShieldCheck, Waypoints } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { GithubIcon } from '@/components/layout/icons'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { usePublicInfo } from '@/lib/auth'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const { data: info } = usePublicInfo()
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState<string | null>(params.get('error'))
  const [busy, setBusy] = useState(false)
  const next = params.get('next') || '/'

  const localLogin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/auth/login', new URLSearchParams({ username, password }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      qc.clear()
      window.location.assign(next)
    } catch {
      setError('Invalid username or password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-full overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* visual side */}
      <div className="relative hidden overflow-hidden border-r border-border bg-panel lg:block">
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, var(--accent-soft), transparent 45%), radial-gradient(circle at 80% 70%, var(--violet-soft), transparent 45%)',
          }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden>
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-violet">
              <svg viewBox="0 0 32 32" className="size-5.5" aria-hidden>
                <path d="M9 11.5 16 7.5l7 4v9l-7 4-7-4z M16 15.5v9 M9 11.5l7 4 7-4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold">Platform Portal</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-[34px] leading-[1.15] font-semibold tracking-tight">
              One place to run the platform.
            </h1>
            <p className="mt-3 text-[15px] text-muted">
              Inventory, Kafka operations, sprint boards, pipelines and connectivity checks for the Platform &amp; DevOps teams.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { icon: Waypoints, label: 'Kafka clusters & sinks' },
                { icon: Activity, label: 'Live alerting' },
                { icon: KeyRound, label: 'Secret expiry tracking' },
                { icon: ShieldCheck, label: 'Audited, role-based' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl border border-border bg-card/70 px-3 py-2.5 text-[13px]">
                  <Icon className="size-4 text-accent" />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-subtle">Internal tool · access is limited to members of the {info?.githubOrg ?? 'company'} GitHub organization</p>
        </div>
      </div>

      {/* form side */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-[13px] text-muted">
            {info?.mode === 'mock'
              ? 'Demo mode: use one of the built-in accounts.'
              : `Members of ${info?.githubOrg ?? 'the organization'} can sign in. The ${info?.adminTeam} team gets admin access.`}
          </p>

          {error && <div className="mt-5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</div>}

          {info?.mode === 'mock' ? (
            <form onSubmit={localLogin} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { u: 'admin', label: 'Admin', hint: 'full access' },
                  { u: 'reader', label: 'Reader', hint: 'read-only' },
                ].map((a) => (
                  <button
                    key={a.u}
                    type="button"
                    onClick={() => {
                      setUsername(a.u)
                      setPassword(a.u)
                    }}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition-colors',
                      username === a.u ? 'border-accent bg-accent-soft' : 'border-border hover:bg-hover',
                    )}
                  >
                    <p className="text-[13px] font-medium">{a.label}</p>
                    <p className="text-xs text-muted">{a.hint}</p>
                  </button>
                ))}
              </div>
              <Field label="Username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </Field>
              <Field label="Password">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                Sign in
              </Button>
            </form>
          ) : (
            <div className="mt-6">
              <Button variant="primary" size="lg" className="w-full" onClick={() => window.location.assign('/oauth2/authorization/github')}>
                <GithubIcon className="size-4.5" />
                Continue with GitHub
              </Button>
              <p className="mt-4 text-center text-xs text-subtle">You will be redirected to GitHub to authorize the portal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
