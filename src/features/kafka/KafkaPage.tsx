import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Database, Plug, Plus, Server, Settings2, Waypoints } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton, Tooltip } from '@/components/ui/misc'
import { Page, PageHeader } from '@/components/ui/page'
import { get } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { InstanceCard } from '@/lib/types'
import { cn, compact, timeAgo } from '@/lib/utils'
import { usePage } from '../inventory/api'
import { choiceTone } from '../inventory/CellValue'
import { RecordDrawer } from '../inventory/RecordDrawer'

export default function KafkaPage() {
  useCrumbs([{ label: 'Kafka' }])
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [adding, setAdding] = useState(false)
  const { data: instancesPage } = usePage('kafka-instances')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kafka', 'instances'],
    queryFn: () => get<InstanceCard[]>('/kafka/instances'),
    refetchInterval: 30_000,
  })

  const envColumn = instancesPage?.columns.find((c) => c.key === 'environment')

  return (
    <Page>
      <PageHeader
        title="Kafka"
        description="Clusters come from the Kafka Instances inventory page. Broker and Connect / sink IPs are maintained there."
        actions={
          <>
            <Button onClick={() => navigate('/inventory/kafka-instances')}>
              <Settings2 /> Manage instances
            </Button>
            {isAdmin && (
              <Button variant="primary" onClick={() => setAdding(true)} disabled={!instancesPage}>
                <Plus /> Add instance
              </Button>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        {data?.map(({ instance, lastHealth }) => {
          const status = !instance.enabled ? 'DISABLED' : (lastHealth?.status ?? 'UNKNOWN')
          const failed = lastHealth?.connectorsFailed ?? 0
          return (
            <Link key={instance.id} to={`/kafka/${instance.id}`} className="group">
              <Card className={cn('h-full overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:border-border-strong', !instance.enabled && 'opacity-60')}>
                <div className="flex items-start gap-4 p-5">
                  <HealthRing status={status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold">{instance.name}</p>
                      <ArrowUpRight className="ml-auto size-4 shrink-0 text-subtle group-hover:text-fg" />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {instance.environment && envColumn && <Badge tone={choiceTone(envColumn, instance.environment)}>{instance.environment}</Badge>}
                      {status === 'DISABLED' ? <Badge>disabled</Badge> : <StatusBadge status={status} />}
                      <Badge tone="neutral">{instance.securityProtocol}</Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 border-y border-border bg-card-2/40 text-center">
                  <Metric label="Brokers" value={lastHealth ? `${lastHealth.brokersOnline}/${lastHealth.brokersTotal}` : '—'} />
                  <Metric label="Topics" value={lastHealth?.topics ?? '—'} />
                  <Metric label="Connectors" value={lastHealth?.connectorsTotal ?? '—'} danger={failed > 0} sub={failed ? `${failed} failed` : undefined} />
                  <Metric label="Max lag" value={lastHealth?.maxLag !== undefined ? compact(lastHealth.maxLag) : '—'} />
                </div>
                <div className="space-y-3 p-5 text-xs">
                  <AddressRow icon={Server} label="Broker IPs" values={instance.brokers} />
                  <AddressRow icon={Plug} label="Connect / sink IPs" values={instance.connectUrls.map((u) => u.replace(/^https?:\/\//, ''))} />
                  <p className="text-subtle">{lastHealth ? `Checked ${timeAgo(lastHealth.ts)}` : 'Waiting for first health check…'}</p>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
      {data?.length === 0 && (
        <Card>
          <EmptyState
            icon={Waypoints}
            title="No Kafka instances yet"
            description="Register a cluster with its broker and Kafka Connect / sink IPs. It is stored in Inventory → Kafka Instances."
            action={
              isAdmin && (
                <Button variant="primary" onClick={() => setAdding(true)}>
                  <Plus /> Add instance
                </Button>
              )
            }
          />
        </Card>
      )}
      {instancesPage && <RecordDrawer page={instancesPage} record={null} open={adding} onOpenChange={setAdding} />}
    </Page>
  )
}

function Metric({ label, value, sub, danger }: { label: string; value: React.ReactNode; sub?: string; danger?: boolean }) {
  return (
    <div className="border-r border-border px-2 py-3 last:border-0">
      <p className={cn('text-[15px] font-semibold tabular', danger && 'text-danger')}>{value}</p>
      <p className="text-[11px] text-muted">{sub ?? label}</p>
    </div>
  )
}

function AddressRow({ icon: Icon, label, values }: { icon: typeof Database; label: string; values: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <Tooltip content={label}>
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted" />
      </Tooltip>
      <div className="flex min-w-0 flex-wrap gap-1">
        {values.length === 0 && <span className="text-subtle">No {label.toLowerCase()}</span>}
        {values.map((v) => (
          <span key={v} className="rounded-md border border-border bg-card-2 px-1.5 py-px font-mono text-[11px]">
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

export function HealthRing({ status, size = 52 }: { status: string; size?: number }) {
  const color =
    status === 'HEALTHY' ? 'var(--success)' : status === 'DEGRADED' ? 'var(--warning)' : status === 'DOWN' || status === 'UNREACHABLE' ? 'var(--danger)' : 'var(--subtle)'
  const pct = status === 'HEALTHY' ? 100 : status === 'DEGRADED' ? 65 : status === 'UNKNOWN' || status === 'DISABLED' ? 0 : 25
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 52 52" className="size-full -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--card-2)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <Waypoints className="absolute inset-0 m-auto size-5" style={{ color }} />
    </div>
  )
}
