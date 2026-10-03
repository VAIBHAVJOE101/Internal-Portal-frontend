import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertOctagon, AlertTriangle, BellRing, CheckCheck, Eye, Info } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Sheet } from '@/components/ui/dialog'
import { SearchInput, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, Segmented } from '@/components/ui/misc'
import { Page, PageHeader, Toolbar } from '@/components/ui/page'
import { StatCard, StatStrip } from '@/components/ui/stat-card'
import { errorMessage, get, post } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AlertItem, AlertSummary, PageResult } from '@/lib/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'

const SOURCES = ['KAFKA', 'INVENTORY', 'CONNECTIVITY', 'GITHUB', 'BOARDS', 'APPKAFKA']

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'CRITICAL') return <AlertOctagon className="size-4 text-danger" />
  if (severity === 'WARNING') return <AlertTriangle className="size-4 text-warning" />
  return <Info className="size-4 text-info" />
}

export default function AlertsPage() {
  useCrumbs([{ label: 'Alerts' }])
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'ACTIVE' | 'RESOLVED' | ''>('ACTIVE')
  const [severity, setSeverity] = useState('')
  const [source, setSource] = useState('')
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState<number | null>(params.get('focus') ? Number(params.get('focus')) : null)

  const summary = useQuery({ queryKey: ['alerts', 'summary'], queryFn: () => get<AlertSummary>('/alerts/summary') })
  const list = useQuery({
    queryKey: ['alerts', 'list', status, severity, source, q],
    queryFn: () => get<PageResult<AlertItem>>('/alerts', { status: status || undefined, severity: severity || undefined, source: source || undefined, q: q || undefined, size: 200 }),
    refetchInterval: 30_000,
  })
  const act = useMutation({
    mutationFn: ({ id, op }: { id: number; op: 'ack' | 'resolve' }) => post<AlertItem>(`/alerts/${id}/${op}`),
    onSuccess: (_, { op }) => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success(op === 'ack' ? 'Alert acknowledged' : 'Alert resolved')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const focused = list.data?.items.find((a) => a.id === focus) ?? null

  return (
    <Page>
      <PageHeader
        title="Alerts"
        description="Centralized alerts from Kafka health checks, sink failures, consumer lag, connectivity tests and credential expiry. Alerts resolve automatically when the condition clears."
      />
      <StatStrip>
        <StatCard label="Active" value={summary.data?.active ?? 0} icon={BellRing} tone="accent" loading={summary.isLoading} onClick={() => { setStatus('ACTIVE'); setSeverity('') }} />
        <StatCard label="Critical" value={summary.data?.critical ?? 0} icon={AlertOctagon} tone={summary.data?.critical ? 'danger' : 'neutral'} loading={summary.isLoading} onClick={() => { setStatus('ACTIVE'); setSeverity('CRITICAL') }} />
        <StatCard label="Warning" value={summary.data?.warning ?? 0} icon={AlertTriangle} tone={summary.data?.warning ? 'warning' : 'neutral'} loading={summary.isLoading} onClick={() => { setStatus('ACTIVE'); setSeverity('WARNING') }} />
        <StatCard label="Info" value={summary.data?.info ?? 0} icon={Info} tone="info" loading={summary.isLoading} onClick={() => { setStatus('ACTIVE'); setSeverity('INFO') }} />
      </StatStrip>

      <Card className="mt-5 overflow-hidden">
        <Toolbar>
          <Segmented value={status} onChange={setStatus} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'RESOLVED', label: 'Resolved' }, { value: '', label: 'All' }]} />
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-36">
            <option value="">All severities</option>
            {['CRITICAL', 'WARNING', 'INFO'].map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-40">
            <option value="">All sources</option>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <SearchInput value={q} onChange={setQ} placeholder="Search title or resource…" className="w-full sm:w-64" />
          <span className="ml-auto text-xs text-subtle">{list.data?.total ?? 0} alerts</span>
        </Toolbar>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            rows={list.data?.items}
            loading={list.isLoading}
            rowKey={(a) => a.id}
            onRowClick={(a) => setFocus(a.id)}
            rowClassName={(a) => (a.severity === 'CRITICAL' && a.status === 'OPEN' ? 'bg-danger-soft/30' : undefined)}
            empty={<EmptyState icon={CheckCheck} title="No alerts" description="Everything looks healthy." />}
            columns={[
              {
                key: 'title',
                header: 'Alert',
                sortValue: (a) => a.title,
                cell: (a) => (
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5"><SeverityIcon severity={a.severity} /></span>
                    <div className="min-w-0">
                      <p className="max-w-[520px] truncate font-medium">{a.title}</p>
                      <p className="max-w-[520px] truncate text-xs text-muted">{a.resource}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'source', header: 'Source', sortValue: (a) => a.source, cell: (a) => <Badge>{a.source.toLowerCase()}</Badge> },
              { key: 'status', header: 'Status', sortValue: (a) => a.status, cell: (a) => <StatusBadge status={a.status} /> },
              { key: 'count', header: 'Count', align: 'right', sortValue: (a) => a.occurrences, cell: (a) => <span className="tabular">×{a.occurrences}</span> },
              { key: 'last', header: 'Last seen', sortValue: (a) => a.lastSeen, cell: (a) => <span className="text-xs whitespace-nowrap text-muted">{timeAgo(a.lastSeen)}</span> },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (a) =>
                  isAdmin && a.status !== 'RESOLVED' && (
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {a.status === 'OPEN' && (
                        <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: a.id, op: 'ack' })}>
                          <Eye /> Ack
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: a.id, op: 'resolve' })}>
                        <CheckCheck /> Resolve
                      </Button>
                    </div>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <Sheet
        open={!!focused}
        onOpenChange={(o) => !o && setFocus(null)}
        title={focused?.title}
        description={focused && `${focused.source.toLowerCase()} · ${focused.resource ?? ''}`}
        footer={
          isAdmin && focused && focused.status !== 'RESOLVED' ? (
            <>
              {focused.status === 'OPEN' && <Button onClick={() => act.mutate({ id: focused.id, op: 'ack' })}><Eye /> Acknowledge</Button>}
              <Button variant="primary" onClick={() => act.mutate({ id: focused.id, op: 'resolve' }, { onSuccess: () => setFocus(null) })}><CheckCheck /> Resolve</Button>
            </>
          ) : undefined
        }
      >
        {focused && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap gap-2">
              <Badge tone={focused.severity === 'CRITICAL' ? 'danger' : focused.severity === 'WARNING' ? 'warning' : 'info'}>{focused.severity}</Badge>
              <StatusBadge status={focused.status} />
              <Badge>×{focused.occurrences}</Badge>
            </div>
            {focused.message && <pre className="rounded-xl border border-border bg-bg p-3 font-mono text-[12px] whitespace-pre-wrap">{focused.message}</pre>}
            <dl className="grid grid-cols-[130px_1fr] gap-y-2">
              <Row label="First seen" value={formatDateTime(focused.firstSeen)} />
              <Row label="Last seen" value={formatDateTime(focused.lastSeen)} />
              {focused.acknowledgedBy && <Row label="Acknowledged" value={`${focused.acknowledgedBy} · ${formatDateTime(focused.acknowledgedAt)}`} />}
              {focused.resolvedAt && <Row label="Resolved" value={formatDateTime(focused.resolvedAt)} />}
            </dl>
          </div>
        )}
      </Sheet>
    </Page>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={cn('text-fg')}>{value}</dd>
    </>
  )
}
