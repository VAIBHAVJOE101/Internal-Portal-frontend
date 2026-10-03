import { useQuery } from '@tanstack/react-query'
import { Activity, Boxes, Crown, Layers, Pencil, Plug, RefreshCw, Server, SquareTerminal, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { ErrorState, Mono, Skeleton, Tabs } from '@/components/ui/misc'
import { Page, PageHeader } from '@/components/ui/page'
import { StatCard, StatStrip } from '@/components/ui/stat-card'
import { get } from '@/lib/api'
import type { BrokerInfo, ClusterOverview, HealthSnapshot } from '@/lib/types'
import { compact, number } from '@/lib/utils'
import { kafkaBase } from './api'
import { ConnectorsTab } from './ConnectorsTab'
import { ConsoleTab } from './ConsoleTab'
import { GroupsTab } from './GroupsTab'
import { HealthRing } from './KafkaPage'
import { TopicsTab } from './TopicsTab'

const TABS = ['overview', 'topics', 'groups', 'connectors', 'brokers', 'console'] as const

export default function ClusterPage() {
  const { id = '', tab = 'overview' } = useParams()
  const navigate = useNavigate()
  const overview = useQuery({
    queryKey: ['kafka', id, 'overview'],
    queryFn: () => get<ClusterOverview>(`${kafkaBase(id)}/overview`),
    refetchInterval: 30_000,
  })
  const o = overview.data
  useCrumbs([{ label: 'Kafka', to: '/kafka' }, { label: o?.instance.name ?? 'Cluster' }])

  if (overview.error) return <Page><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Page>

  const current = (TABS as readonly string[]).includes(tab) ? tab : 'overview'

  return (
    <Page>
      <PageHeader
        title={
          o ? (
            <>
              <HealthRing status={o.status} size={40} />
              {o.instance.name}
            </>
          ) : (
            <Skeleton className="h-9 w-72" />
          )
        }
        meta={
          o && (
            <>
              <StatusBadge status={o.status} />
              {o.instance.environment && <Badge tone="neutral">{o.instance.environment}</Badge>}
              <Badge tone="neutral">{o.instance.securityProtocol}</Badge>
              {o.clusterId && <Badge tone="neutral"><Mono className="text-[11px]">{o.clusterId}</Mono></Badge>}
              <span className="text-xs text-subtle">{o.latencyMs} ms</span>
            </>
          )
        }
        actions={
          <>
            <Button onClick={() => overview.refetch()} loading={overview.isFetching}>
              {!overview.isFetching && <RefreshCw />} Refresh
            </Button>
            <Button onClick={() => navigate(`/inventory/kafka-instances?record=${id}`)}>
              <Pencil /> Edit IPs in inventory
            </Button>
          </>
        }
      />

      {o?.error && (
        <div className="mb-5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-[13px] text-danger">{o.error}</div>
      )}

      <Tabs
        value={current}
        onValueChange={(v) => navigate(`/kafka/${id}/${v === 'overview' ? '' : v}`)}
        className="mb-5"
        items={[
          { value: 'overview', label: 'Overview', icon: Activity },
          { value: 'topics', label: 'Topics', icon: Layers, count: o?.topics },
          { value: 'groups', label: 'Consumer groups', icon: Users, count: o?.consumerGroups },
          { value: 'connectors', label: 'Connectors & sinks', icon: Plug, count: o?.connectorsTotal },
          { value: 'brokers', label: 'Brokers', icon: Server, count: o?.brokersOnline },
          { value: 'console', label: 'Connect REST console', icon: SquareTerminal },
        ]}
      />

      {current === 'overview' && <OverviewTab id={id} o={o} loading={overview.isLoading} />}
      {current === 'topics' && <TopicsTab id={id} />}
      {current === 'groups' && <GroupsTab id={id} />}
      {current === 'connectors' && <ConnectorsTab id={id} hasConnect={!!o?.instance.connectUrls.length} />}
      {current === 'brokers' && <BrokersTab id={id} />}
      {current === 'console' && <ConsoleTab id={id} connectUrls={o?.instance.connectUrls ?? []} />}
    </Page>
  )
}

function OverviewTab({ id, o, loading }: { id: string; o?: ClusterOverview; loading: boolean }) {
  const history = useQuery({
    queryKey: ['kafka', id, 'history'],
    queryFn: () => get<HealthSnapshot[]>(`${kafkaBase(id)}/health-history`, { hours: 24 }),
    refetchInterval: 60_000,
  })
  const points = (history.data ?? []).map((s) => ({
    t: new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    lag: s.maxLag ?? 0,
    failed: s.connectorsFailed ?? 0,
  }))
  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard label="Brokers online" value={o ? `${o.brokersOnline}/${o.brokersExpected}` : '—'} icon={Server} tone={o && o.brokersOnline < o.brokersExpected ? 'warning' : 'success'} loading={loading} hint={o?.controllerId !== undefined ? `Controller: broker ${o.controllerId}` : undefined} />
        <StatCard label="Topics / partitions" value={o ? `${o.topics} / ${compact(o.partitions)}` : '—'} icon={Layers} tone={o?.underReplicated ? 'warning' : 'accent'} loading={loading} hint={o ? `${o.underReplicated} under-replicated · ${o.offlinePartitions} offline` : undefined} />
        <StatCard label="Consumer groups" value={o?.consumerGroups ?? '—'} icon={Users} tone="info" loading={loading} spark={points.map((p) => p.lag)} hint="Trend: max lag, 24h" />
        <StatCard label="Failed connectors" value={o ? `${o.connectorsFailed}/${o.connectorsTotal}` : '—'} icon={Plug} tone={o?.connectorsFailed ? 'danger' : 'success'} loading={loading} hint={o?.kafkaConnectVersion ? `Connect ${o.kafkaConnectVersion}` : 'Kafka Connect'} />
      </StatStrip>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Activity} title="Max consumer lag" description="Highest group lag per health check, last 24 hours" />
          <div className="h-[240px] px-2 pb-3">
            {history.isLoading ? (
              <Skeleton className="mx-3 h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 16, left: -6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: 'var(--subtle)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
                  <YAxis tickFormatter={(v: number) => compact(v)} tick={{ fill: 'var(--subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <ChartTooltip contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => number(Number(v))} />
                  <Area type="monotone" dataKey="lag" name="Max lag" stroke="var(--accent)" strokeWidth={2} fill="url(#lag)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader icon={Boxes} title="Connection" description="From Inventory → Kafka Instances" />
          <CardBody className="space-y-4 text-[13px]">
            <InfoList label="Broker IPs" values={o?.instance.brokers ?? []} />
            <InfoList label="Connect / sink IPs" values={o?.instance.connectUrls ?? []} />
            <div className="grid grid-cols-2 gap-3">
              <Info label="Security" value={o?.instance.securityProtocol} />
              <Info label="SASL" value={o?.instance.saslMechanism ?? '—'} />
              <Info label="Credential ref" value={o?.instance.credentialRef ?? '—'} />
              <Info label="Cluster id" value={o?.clusterId ?? '—'} />
            </div>
            <Link to={`/inventory/kafka-instances?record=${id}`} className="inline-block text-xs font-medium text-accent hover:underline">
              Edit connection details →
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="truncate font-mono text-[12.5px]">{value}</p>
    </div>
  )
}

function InfoList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-xs text-subtle">none</span>}
        {values.map((v) => (
          <span key={v} className="rounded-md border border-border bg-card-2 px-2 py-0.5 font-mono text-[12px]">
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

function BrokersTab({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kafka', id, 'brokers'],
    queryFn: () => get<BrokerInfo[]>(`${kafkaBase(id)}/brokers`),
  })
  if (error) return <ErrorState error={error} onRetry={refetch} />
  return (
    <Card className="overflow-hidden">
      <DataTable
        rows={data}
        loading={isLoading}
        rowKey={(b) => b.id}
        columns={[
          {
            key: 'id',
            header: 'Broker',
            sortValue: (b) => b.id,
            cell: (b) => (
              <span className="flex items-center gap-2 font-medium">
                <Server className="size-3.5 text-muted" /> {b.id}
                {b.controller && (
                  <Badge tone="violet">
                    <Crown className="size-3" /> controller
                  </Badge>
                )}
              </span>
            ),
          },
          { key: 'host', header: 'Host', sortValue: (b) => b.host, cell: (b) => <Mono>{b.host}</Mono> },
          { key: 'port', header: 'Port', sortValue: (b) => b.port, cell: (b) => <Mono>{b.port}</Mono> },
          { key: 'rack', header: 'Rack', sortValue: (b) => b.rack, cell: (b) => b.rack ?? <span className="text-subtle">—</span> },
          { key: 'status', header: 'Status', cell: () => <StatusBadge status="UP" /> },
        ]}
      />
    </Card>
  )
}
