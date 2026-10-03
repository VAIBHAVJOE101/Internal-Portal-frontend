import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  GitPullRequestArrow,
  HeartPulse,
  KeyRound,
  RefreshCw,
  ScrollText,
  Sparkles,
  Waypoints,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Avatar, EmptyState, ErrorState, Meter, Skeleton } from '@/components/ui/misc'
import { Page, PageHeader } from '@/components/ui/page'
import { StatCard, StatStrip } from '@/components/ui/stat-card'
import { get } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AlertSummary, AuditEntry, ExpiringItem, InstanceCard, Iteration, WorkflowRun } from '@/lib/types'
import { cn, duration, formatDate, timeAgo } from '@/lib/utils'

interface Summary {
  kafka: { instances: InstanceCard[]; byStatus: Record<string, number>; failedConnectors: number; connectors: number } | null
  alerts: { summary: AlertSummary; trend: { day: string; critical: number; warning: number; info: number }[] } | null
  expiring: { count: number; expired: number; items: ExpiringItem[] } | null
  inventory: { pages: number; records: number; byPage: { slug: string; name: string; count: number }[] } | null
  connectivity: { id: number; name: string; status: string; uptime: number }[] | null
  sprint: { iteration: Iteration; total: number; done: number; byState: Record<string, number> } | null
  runs: WorkflowRun[] | null
  audit: AuditEntry[] | null
  errors: Record<string, string>
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  useCrumbs([{ label: 'Dashboard' }])
  const { me } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => get<Summary>('/dashboard/summary'),
    refetchInterval: 60_000,
  })

  if (error) return <Page><ErrorState error={error} onRetry={refetch} /></Page>

  const k = data?.kafka
  const healthy = k?.byStatus?.HEALTHY ?? 0
  const totalClusters = k?.instances.length ?? 0
  const trend = data?.alerts?.trend ?? []
  const conn = data?.connectivity ?? []
  const upCount = conn.filter((c) => c.status === 'UP').length
  const uptimeAvg = conn.filter((c) => c.uptime >= 0).reduce((s, c, _, arr) => s + c.uptime / arr.length, 0)
  const sprint = data?.sprint

  return (
    <Page>
      <PageHeader
        title={`${greeting()}, ${(me.name || me.username).split(' ')[0]}`}
        description="Platform health at a glance: clusters, pipelines, expiring credentials and what changed recently."
        actions={
          <>
            <Button onClick={() => refetch()} loading={isFetching && !isLoading}>
              {!isFetching && <RefreshCw />} Refresh
            </Button>
            <Button variant="primary" onClick={() => navigate('/alerts')}>
              <AlertTriangle /> Open alerts
            </Button>
          </>
        }
      />

      <StatStrip>
        <StatCard
          label="Kafka clusters healthy"
          value={
            <>
              {healthy}
              <span className="text-base font-normal text-muted">/{totalClusters}</span>
            </>
          }
          hint={k ? `${k.connectors} connectors across clusters` : undefined}
          icon={Waypoints}
          tone={healthy === totalClusters ? 'success' : 'warning'}
          loading={isLoading}
          onClick={() => navigate('/kafka')}
        />
        <StatCard
          label="Failed sinks / connectors"
          value={k?.failedConnectors ?? 0}
          hint={k?.failedConnectors ? 'Needs attention' : 'All tasks running'}
          icon={HeartPulse}
          tone={k?.failedConnectors ? 'danger' : 'success'}
          loading={isLoading}
          onClick={() => navigate('/kafka')}
        />
        <StatCard
          label="Credentials expiring ≤ 30d"
          value={data?.expiring?.count ?? 0}
          hint={data?.expiring?.expired ? `${data.expiring.expired} already expired` : 'Nothing expired'}
          icon={KeyRound}
          tone={data?.expiring?.expired ? 'danger' : data?.expiring?.count ? 'warning' : 'success'}
          loading={isLoading}
          onClick={() => navigate('/inventory/secrets')}
        />
        <StatCard
          label="Active alerts"
          value={data?.alerts?.summary.active ?? 0}
          hint={`${data?.alerts?.summary.critical ?? 0} critical · ${data?.alerts?.summary.warning ?? 0} warning`}
          icon={AlertTriangle}
          tone={data?.alerts?.summary.critical ? 'danger' : 'accent'}
          spark={trend.map((t) => t.critical + t.warning + t.info)}
          loading={isLoading}
          onClick={() => navigate('/alerts')}
        />
      </StatStrip>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={BarChart3}
            title="Alert activity"
            description="New alerts per day over the last two weeks, by severity"
            actions={
              <div className="hidden gap-3 text-xs text-muted sm:flex">
                <Legend color="var(--danger)" label="Critical" />
                <Legend color="var(--warning)" label="Warning" />
                <Legend color="var(--info)" label="Info" />
              </div>
            }
          />
          <div className="h-[260px] px-2 pb-3">
            {isLoading ? (
              <Skeleton className="mx-3 h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <defs>
                    {['danger', 'warning', 'info'].map((t) => (
                      <linearGradient key={t} id={`g-${t}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={`var(--${t})`} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={`var(--${t})`} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fill: 'var(--subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <ChartTooltip
                    contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: 'var(--fg)' }}
                  />
                  <Area type="monotone" dataKey="info" stackId="1" stroke="var(--info)" fill="url(#g-info)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="warning" stackId="1" stroke="var(--warning)" fill="url(#g-warning)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke="var(--danger)" fill="url(#g-danger)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Sparkles} title="Platform health" description="Live signals from every module" />
          <CardBody className="space-y-5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)
            ) : (
              <>
                <Meter label="Kafka clusters healthy" value={healthy} max={totalClusters || 1} display={`${healthy}/${totalClusters}`} tone={healthy === totalClusters ? 'success' : 'warning'} />
                <Meter
                  label="Connectivity targets up"
                  value={upCount}
                  max={conn.length || 1}
                  display={conn.length ? `${upCount}/${conn.length} · ${uptimeAvg.toFixed(1)}% 24h` : '—'}
                  tone={upCount === conn.length ? 'success' : 'danger'}
                />
                <Meter
                  label="Sprint completion"
                  value={sprint?.done ?? 0}
                  max={sprint?.total || 1}
                  display={sprint ? `${sprint.done}/${sprint.total} items` : 'not connected'}
                  tone="accent"
                />
                <Meter
                  label="Credentials expiring soon"
                  value={data?.expiring?.count ?? 0}
                  max={Math.max(10, data?.expiring?.count ?? 0)}
                  display={`${data?.expiring?.count ?? 0}`}
                  tone={data?.expiring?.expired ? 'danger' : 'warning'}
                />
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={Waypoints}
            title="Kafka clusters"
            actions={<Link to="/kafka" className="text-xs font-medium text-accent hover:underline">View all</Link>}
          />
          <div className="divide-y divide-border border-t border-border">
            {isLoading && <div className="p-5"><Skeleton className="h-24" /></div>}
            {k?.instances.length === 0 && <EmptyState title="No Kafka instances" description="Add clusters in Inventory → Kafka Instances." />}
            {k?.instances.map(({ instance, lastHealth }) => (
              <Link key={instance.id} to={`/kafka/${instance.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover/60">
                <span className={cn('size-2 rounded-full', statusDot(lastHealth?.status))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{instance.name}</p>
                  <p className="truncate text-xs text-muted">
                    {lastHealth ? `${lastHealth.brokersOnline}/${lastHealth.brokersTotal} brokers · ${lastHealth.topics} topics · ${lastHealth.connectorsTotal} connectors` : 'Waiting for first health check'}
                  </p>
                </div>
                {lastHealth?.connectorsFailed ? <Badge tone="danger">{lastHealth.connectorsFailed} failed</Badge> : <StatusBadge status={lastHealth?.status ?? 'UNKNOWN'} />}
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={CalendarClock}
            title="Expiring soon"
            actions={<Link to="/inventory/secrets" className="text-xs font-medium text-accent hover:underline">Secrets</Link>}
          />
          <div className="divide-y divide-border border-t border-border">
            {isLoading && <div className="p-5"><Skeleton className="h-24" /></div>}
            {data?.expiring?.items.length === 0 && <EmptyState icon={KeyRound} title="Nothing expiring" description="No tracked dates within 30 days." />}
            {data?.expiring?.items.map((item) => (
              <Link key={`${item.recordId}-${item.columnKey}`} to={`/inventory/${item.pageSlug}?record=${item.recordId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-hover/60">
                <ExpiryChip days={item.daysLeft} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted">
                    {item.pageName} · {item.columnLabel} {formatDate(item.expiresOn)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={Activity}
            title={sprint ? sprint.iteration.name : 'Current sprint'}
            description={sprint ? `${formatDate(sprint.iteration.startDate)} – ${formatDate(sprint.iteration.finishDate)}` : undefined}
            actions={<Link to="/boards" className="text-xs font-medium text-accent hover:underline">Board</Link>}
          />
          <CardBody>
            {isLoading && <Skeleton className="h-28" />}
            {!isLoading && !sprint && <EmptyState title="Azure Boards not connected" description={data?.errors?.sprint} className="py-6" />}
            {sprint && (
              <div className="space-y-4">
                <SprintTimeline start={sprint.iteration.startDate} end={sprint.iteration.finishDate} />
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(sprint.byState).map(([state, count]) => (
                    <div key={state} className="flex items-center justify-between rounded-lg border border-border bg-card-2/50 px-3 py-2">
                      <span className="text-xs text-muted">{state}</span>
                      <span className="text-sm font-semibold tabular">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            icon={GitPullRequestArrow}
            title="Recent pipeline runs"
            actions={<Link to="/github" className="text-xs font-medium text-accent hover:underline">All workflows</Link>}
          />
          <div className="overflow-x-auto border-t border-border">
            {isLoading && <div className="p-5"><Skeleton className="h-40" /></div>}
            {!isLoading && !data?.runs && <EmptyState title="GitHub not connected" description={data?.errors?.runs} />}
            <table className="w-full text-[13px]">
              <tbody>
                {data?.runs?.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-hover/60">
                    <td className="py-2.5 pr-2 pl-5">
                      <StatusBadge status={r.conclusion ?? r.status} />
                    </td>
                    <td className="max-w-[280px] px-2 py-2.5">
                      <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-accent">
                        {r.title}
                      </a>
                      <span className="text-xs text-muted">
                        {r.repo} · {r.name} · <span className="font-mono">{r.branch}</span>
                      </span>
                    </td>
                    <td className="hidden px-2 py-2.5 sm:table-cell">
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <Avatar name={r.actor} src={r.actorAvatar} size={18} /> {r.actor}
                      </span>
                    </td>
                    <td className="py-2.5 pr-5 pl-2 text-right text-xs whitespace-nowrap text-muted">
                      {duration(r.durationSeconds)} · {timeAgo(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            icon={ScrollText}
            title="Recent activity"
            actions={<Link to="/audit" className="text-xs font-medium text-accent hover:underline">Audit log</Link>}
          />
          <div className="border-t border-border px-5 py-2">
            {isLoading && <Skeleton className="my-3 h-40" />}
            <ol className="relative">
              {data?.audit?.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 py-2.5">
                  {i < (data.audit?.length ?? 0) - 1 && <span className="absolute top-8 bottom-0 left-[11px] w-px bg-border" />}
                  <Avatar name={a.username} size={22} />
                  <div className="min-w-0 flex-1 text-[13px]">
                    <p className="truncate">
                      <span className="font-medium">{a.username}</span>{' '}
                      <span className="text-muted">{humanAction(a.action)}</span>{' '}
                      <span className="font-mono text-[12px]">{a.targetId}</span>
                    </p>
                    <p className="text-xs text-subtle">
                      {timeAgo(a.ts)}
                      {!a.success && <span className="ml-1.5 text-danger">failed</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>
      {data && Object.keys(data.errors).length > 0 && (
        <p className="mt-4 text-xs text-subtle">Some sections could not load: {Object.keys(data.errors).join(', ')}.</p>
      )}
    </Page>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function statusDot(status?: string) {
  switch (status) {
    case 'HEALTHY':
      return 'bg-success shadow-[0_0_0_3px_var(--success-soft)]'
    case 'DEGRADED':
      return 'bg-warning shadow-[0_0_0_3px_var(--warning-soft)]'
    case 'DOWN':
    case 'UNREACHABLE':
      return 'bg-danger shadow-[0_0_0_3px_var(--danger-soft)]'
    default:
      return 'bg-subtle'
  }
}

export function ExpiryChip({ days }: { days: number }) {
  const tone = days < 0 ? 'bg-danger text-white' : days <= 7 ? 'bg-danger-soft text-danger' : days <= 30 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'
  return (
    <span className={cn('grid h-9 w-11 shrink-0 place-items-center rounded-lg text-center leading-none', tone)}>
      <span>
        <span className="block text-[13px] font-semibold tabular">{Math.abs(days)}</span>
        <span className="block text-[9.5px] opacity-80">{days < 0 ? 'ago' : 'days'}</span>
      </span>
    </span>
  )
}

function SprintTimeline({ start, end }: { start?: string; end?: string }) {
  if (!start || !end) return null
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const now = Date.now()
  const pct = Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100))
  const daysLeft = Math.max(0, Math.ceil((e - now) / 86_400_000))
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-muted">
        <span>{Math.round(pct)}% of sprint elapsed</span>
        <span>{daysLeft} days left</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-violet" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function humanAction(action: string) {
  return action.toLowerCase().replace(/_/g, ' ')
}
