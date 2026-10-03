import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  ExternalLink,
  GitBranch,
  Loader2,
  MinusCircle,
  RotateCw,
  Timer,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbs } from '@/components/layout/crumbs'
import { GithubIcon } from '@/components/layout/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { DataTable } from '@/components/ui/data-table'
import { Input, SearchInput, Select } from '@/components/ui/input'
import { Avatar, EmptyState, ErrorState, Menu, Mono, Segmented, Skeleton, Tabs, Tooltip } from '@/components/ui/misc'
import { Page, PageHeader, Toolbar } from '@/components/ui/page'
import { StatCard, StatStrip } from '@/components/ui/stat-card'
import { del, enc, errorMessage, get, post } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Member, Repo, Team, WorkflowRun } from '@/lib/types'
import { cn, duration, timeAgo } from '@/lib/utils'

export default function GithubPage() {
  const { tab = 'workflows' } = useParams()
  const navigate = useNavigate()
  useCrumbs([{ label: 'GitHub', to: '/github' }, { label: tab === 'teams' ? 'Teams' : 'Workflows' }])
  const { data: org } = useQuery({ queryKey: ['github', 'org'], queryFn: () => get<{ org: string }>('/github/org') })
  return (
    <Page>
      <PageHeader
        title={
          <>
            <GithubIcon className="size-6" /> GitHub
          </>
        }
        description="Pipeline status across repositories and team membership for the organization. Actions use your own GitHub OAuth permissions."
        meta={org && <Badge tone="neutral">org: {org.org}</Badge>}
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate(v === 'workflows' ? '/github' : `/github/${v}`)}
        className="mb-5"
        items={[
          { value: 'workflows', label: 'Workflows', icon: RotateCw },
          { value: 'teams', label: 'Teams', icon: Users },
        ]}
      />
      {tab === 'teams' ? <TeamsTab /> : <WorkflowsTab />}
    </Page>
  )
}

// ------------------------------------------------------------------ workflows

export function RunStatusIcon({ run }: { run: Pick<WorkflowRun, 'status' | 'conclusion'> }) {
  if (run.status !== 'completed') {
    return run.status === 'in_progress' ? <Loader2 className="size-4 animate-spin text-warning" /> : <CircleDashed className="size-4 text-info" />
  }
  switch (run.conclusion) {
    case 'success':
      return <CheckCircle2 className="size-4 text-success" />
    case 'failure':
    case 'timed_out':
      return <XCircle className="size-4 text-danger" />
    case 'cancelled':
      return <Ban className="size-4 text-muted" />
    default:
      return <MinusCircle className="size-4 text-subtle" />
  }
}

function WorkflowsTab() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [repo, setRepo] = useState('')
  const [status, setStatus] = useState<'all' | 'failure' | 'in_progress' | 'success'>('all')
  const [q, setQ] = useState('')
  const repos = useQuery({ queryKey: ['github', 'repos'], queryFn: () => get<Repo[]>('/github/repos'), staleTime: 5 * 60_000 })
  const runs = useQuery({
    queryKey: ['github', 'runs', repo],
    queryFn: () => get<WorkflowRun[]>('/github/runs', { repo: repo || undefined, limit: 60 }),
    refetchInterval: 20_000,
  })
  const action = useMutation({
    mutationFn: ({ run, op }: { run: WorkflowRun; op: 'rerun' | 'rerun-failed' | 'cancel' }) =>
      post(`/github/repos/${enc(run.repo)}/runs/${run.id}/${op === 'cancel' ? 'cancel' : 'rerun'}`, null, op === 'rerun-failed' ? { failedOnly: true } : undefined),
    onSuccess: (_, { op }) => {
      toast.success(op === 'cancel' ? 'Cancellation requested' : 'Re-run requested')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['github', 'runs'] }), 800)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const all = useMemo(() => runs.data ?? [], [runs.data])
  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (status === 'all' || (status === 'in_progress' ? r.status !== 'completed' : r.conclusion === status)) &&
          (!q || [r.title, r.name, r.branch, r.actor, r.repo].some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
      ),
    [all, status, q],
  )
  const completed = all.filter((r) => r.status === 'completed' && r.conclusion !== 'skipped' && r.conclusion !== 'cancelled')
  const successRate = completed.length ? Math.round((completed.filter((r) => r.conclusion === 'success').length / completed.length) * 100) : null
  const failures = all.filter((r) => r.conclusion === 'failure').length
  const running = all.filter((r) => r.status !== 'completed').length
  const durations = all.filter((r) => r.durationSeconds).map((r) => r.durationSeconds!)
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

  if (runs.error) return <ErrorState error={runs.error} onRetry={() => runs.refetch()} />

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard label="Success rate" value={successRate === null ? '—' : `${successRate}%`} icon={CheckCircle2} tone={successRate !== null && successRate < 80 ? 'warning' : 'success'} loading={runs.isLoading} hint={`${completed.length} completed runs`} />
        <StatCard label="Failed runs" value={failures} icon={XCircle} tone={failures ? 'danger' : 'neutral'} loading={runs.isLoading} hint="In the current list" />
        <StatCard label="Running / queued" value={running} icon={Loader2} tone="warning" loading={runs.isLoading} hint="Auto-refresh every 20s" />
        <StatCard label="Avg duration" value={duration(avg)} icon={Timer} tone="violet" loading={runs.isLoading} hint="Completed runs" />
      </StatStrip>
      <Card className="overflow-hidden">
        <Toolbar>
          <Select value={repo} onChange={(e) => setRepo(e.target.value)} className="w-56">
            <option value="">Recently active repositories</option>
            {repos.data?.filter((r) => !r.archived).map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </Select>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'failure', label: 'Failed' },
              { value: 'in_progress', label: 'Running' },
              { value: 'success', label: 'Succeeded' },
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder="Title, branch, actor…" className="w-full sm:w-60" />
        </Toolbar>
        <DataTable
          rows={rows}
          loading={runs.isLoading}
          rowKey={(r) => r.id}
          defaultSort={{ key: 'created', dir: 'desc' }}
          empty={<EmptyState icon={GithubIcon} title="No workflow runs" />}
          columns={[
            {
              key: 'run',
              header: 'Run',
              sortValue: (r) => r.title,
              cell: (r) => (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5"><RunStatusIcon run={r} /></span>
                  <div className="min-w-0">
                    <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="block max-w-[420px] truncate font-medium hover:text-accent">
                      {r.title}
                    </a>
                    <p className="text-xs text-muted">
                      <span className="text-fg/80">{r.name}</span> #{r.runNumber}
                      {r.attempt > 1 && <span> · attempt {r.attempt}</span>} · {r.event.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              ),
            },
            { key: 'repo', header: 'Repository', sortValue: (r) => r.repo, cell: (r) => <span className="text-[13px]">{r.repo}</span> },
            {
              key: 'branch',
              header: 'Branch',
              sortValue: (r) => r.branch,
              cell: (r) => (
                <span className="inline-flex max-w-[200px] items-center gap-1 rounded-md bg-card-2 px-1.5 py-0.5 text-xs">
                  <GitBranch className="size-3 shrink-0 text-muted" />
                  <Mono className="truncate text-[11.5px]">{r.branch}</Mono>
                </span>
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              sortValue: (r) => r.actor,
              cell: (r) => (
                <span className="flex items-center gap-1.5 text-[13px]">
                  <Avatar name={r.actor} src={r.actorAvatar} size={20} /> {r.actor}
                </span>
              ),
            },
            {
              key: 'created',
              header: 'Started',
              sortValue: (r) => r.createdAt,
              cell: (r) => (
                <div className="text-xs whitespace-nowrap">
                  <p>{timeAgo(r.createdAt)}</p>
                  <p className="flex items-center gap-1 text-subtle"><Clock className="size-3" /> {r.status === 'completed' ? duration(r.durationSeconds) : r.status.replace('_', ' ')}</p>
                </div>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (r) => (
                <div className="flex justify-end gap-1">
                  {isAdmin && r.status === 'completed' && (
                    <Menu
                      trigger={<Button size="icon-sm" variant="ghost" aria-label="Re-run"><RotateCw /></Button>}
                      items={[
                        { label: 'Re-run all jobs', icon: RotateCw, onSelect: () => action.mutate({ run: r, op: 'rerun' }) },
                        { label: 'Re-run failed jobs', icon: XCircle, onSelect: () => action.mutate({ run: r, op: 'rerun-failed' }), disabled: r.conclusion !== 'failure' },
                      ]}
                    />
                  )}
                  {isAdmin && r.status !== 'completed' && (
                    <Tooltip content="Cancel run">
                      <Button size="icon-sm" variant="ghost" onClick={() => action.mutate({ run: r, op: 'cancel' })}><Ban /></Button>
                    </Tooltip>
                  )}
                  <Tooltip content="Open on GitHub">
                    <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Tooltip>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ teams

function TeamsTab() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [slug, setSlug] = useState<string | null>(null)
  const [newUser, setNewUser] = useState('')
  const [role, setRole] = useState('member')
  const teams = useQuery({ queryKey: ['github', 'teams'], queryFn: () => get<Team[]>('/github/teams') })
  const current = slug ?? teams.data?.[0]?.slug ?? null
  const team = teams.data?.find((t) => t.slug === current)
  const members = useQuery({ queryKey: ['github', 'members', current], queryFn: () => get<Member[]>(`/github/teams/${enc(current!)}/members`), enabled: !!current })
  const invites = useQuery({ queryKey: ['github', 'invites', current], queryFn: () => get<Member[]>(`/github/teams/${enc(current!)}/invitations`), enabled: !!current })
  const orgMembers = useQuery({ queryKey: ['github', 'org-members'], queryFn: () => get<Member[]>('/github/members'), enabled: isAdmin, staleTime: 5 * 60_000 })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['github', 'members', current] })
    qc.invalidateQueries({ queryKey: ['github', 'invites', current] })
    qc.invalidateQueries({ queryKey: ['github', 'teams'] })
  }
  const add = useMutation({
    mutationFn: () => post<{ username: string; state: string }>(`/github/teams/${enc(current!)}/members`, { username: newUser.trim(), role }),
    onSuccess: (r) => {
      toast.success(r.state === 'pending' ? `Invitation sent to ${r.username}` : `${r.username} added to ${team?.name}`)
      setNewUser('')
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (login: string) => del(`/github/teams/${enc(current!)}/members/${enc(login)}`),
    onSuccess: (_, login) => {
      toast.success(`${login} removed from ${team?.name}`)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (teams.error) return <ErrorState error={teams.error} onRetry={() => teams.refetch()} />
  const filtered = (teams.data ?? []).filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  const memberLogins = new Set((members.data ?? []).map((m) => m.login))

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit overflow-hidden">
        <div className="border-b border-border p-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Find a team…" />
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-1.5">
          {teams.isLoading && <Skeleton className="m-2 h-40" />}
          {filtered.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setSlug(t.slug)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors', current === t.slug ? 'bg-accent-soft' : 'hover:bg-hover')}
            >
              <Avatar name={t.name} size={30} className="rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{t.name}</p>
                <p className="truncate text-xs text-muted">{t.description || t.slug}</p>
              </div>
              {t.membersCount !== null && t.membersCount !== undefined && <span className="text-xs text-subtle tabular">{t.membersCount}</span>}
            </button>
          ))}
        </div>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        {team ? (
          <>
            <CardHeader
              icon={Users}
              title={team.name}
              description={team.description}
              actions={
                <>
                  <Badge tone="neutral">{team.privacy}</Badge>
                  <a href={team.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    GitHub <ExternalLink className="size-3" />
                  </a>
                </>
              }
            />
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 border-y border-border bg-card-2/40 px-5 py-3">
                <UserPlus className="size-4 text-muted" />
                <Input
                  list="org-members"
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newUser.trim() && add.mutate()}
                  placeholder="GitHub username"
                  className="w-56"
                />
                <datalist id="org-members">
                  {orgMembers.data?.filter((m) => !memberLogins.has(m.login)).map((m) => <option key={m.login} value={m.login} />)}
                </datalist>
                <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-36">
                  <option value="member">Member</option>
                  <option value="maintainer">Maintainer</option>
                </Select>
                <Button variant="primary" onClick={() => add.mutate()} loading={add.isPending} disabled={!newUser.trim()}>
                  Add to team
                </Button>
                <span className="text-xs text-subtle">Non-members of the org receive an invitation.</span>
              </div>
            )}
            <DataTable
              rows={[...(members.data ?? []), ...(invites.data ?? [])]}
              loading={members.isLoading}
              rowKey={(m) => `${m.login}-${m.state}`}
              defaultSort={{ key: 'login', dir: 'asc' }}
              empty={<EmptyState icon={Users} title="No members" />}
              columns={[
                {
                  key: 'login',
                  header: 'Member',
                  sortValue: (m) => m.login,
                  cell: (m) => (
                    <span className="flex items-center gap-2.5">
                      <Avatar name={m.login} src={m.avatarUrl} size={28} />
                      {m.htmlUrl ? (
                        <a href={m.htmlUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">{m.login}</a>
                      ) : (
                        <span className="font-medium">{m.login}</span>
                      )}
                    </span>
                  ),
                },
                { key: 'role', header: 'Role', sortValue: (m) => m.role, cell: (m) => <Badge tone={m.role === 'maintainer' ? 'violet' : 'neutral'}>{m.role ?? 'member'}</Badge> },
                { key: 'state', header: 'Status', sortValue: (m) => m.state, cell: (m) => <Badge tone={m.state === 'pending' ? 'warning' : 'success'} dot>{m.state === 'pending' ? 'invitation pending' : 'active'}</Badge> },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (m) =>
                    isAdmin && (
                      <Button
                        size="sm"
                        variant="danger-ghost"
                        onClick={async () => {
                          if (await confirm({ title: `Remove ${m.login} from ${team.name}?`, description: 'They lose any repository access granted through this team.', danger: true, confirmText: 'Remove' })) remove.mutate(m.login)
                        }}
                      >
                        <UserMinus /> Remove
                      </Button>
                    ),
                },
              ]}
            />
          </>
        ) : (
          !teams.isLoading && <EmptyState icon={Users} title="No teams found" />
        )}
      </Card>
    </div>
  )
}
