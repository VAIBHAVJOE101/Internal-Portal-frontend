import { useQuery } from '@tanstack/react-query'
import { AlertOctagon, AlertTriangle, BellOff, BellRing, CheckCheck, Eye, Hourglass, ListChecks, MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { SearchInput, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, Menu, Segmented, Tabs } from '@/components/ui/misc'
import { Page, PageHeader, Toolbar } from '@/components/ui/page'
import { StatCard, StatStrip } from '@/components/ui/stat-card'
import { get } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AlertItem, AlertPolicy, AlertSummary, PageResult } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { AlertDetailSheet, useAlertActions } from './AlertDetailSheet'
import { RulesTab } from './RulesTab'
import { AlertStatusBadges, SeverityIcon, SNOOZE_OPTIONS } from './shared'

type StatusFilter = 'FIRING' | 'PENDING' | 'RESOLVED' | ''

export default function AlertsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'rules' ? 'rules' : 'alerts'
  useCrumbs([{ label: 'Alerts', to: '/alerts' }, ...(tab === 'rules' ? [{ label: 'Rules & notifications' }] : [])])
  const navigate = useNavigate()

  return (
    <Page>
      <PageHeader
        title="Alerts"
        description="Alerts from Kafka health, sink failures, consumer lag, connectivity tests and credential expiry. Each alert type has its own rule for triggering, reminders, escalation, auto-resolve and channels (email, Microsoft Teams)."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate(v === 'rules' ? '/alerts?tab=rules' : '/alerts')}
        className="mb-5"
        items={[
          { value: 'alerts', label: 'Alerts', icon: BellRing },
          { value: 'rules', label: 'Rules & notifications', icon: SlidersHorizontal },
        ]}
      />
      {tab === 'rules' ? <RulesTab /> : <AlertList focus={params.get('focus')} clearFocus={() => { params.delete('focus'); setParams(params, { replace: true }) }} />}
    </Page>
  )
}

function AlertList({ focus, clearFocus }: { focus: string | null; clearFocus: () => void }) {
  const { isAdmin } = useAuth()
  const act = useAlertActions()
  const [status, setStatus] = useState<StatusFilter>('FIRING')
  const [severity, setSeverity] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<number | null>(focus ? Number(focus) : null)

  const summary = useQuery({ queryKey: ['alerts', 'summary'], queryFn: () => get<AlertSummary>('/alerts/summary') })
  const rules = useQuery({ queryKey: ['alerts', 'rules'], queryFn: () => get<AlertPolicy[]>('/alerts/rules') })
  const list = useQuery({
    queryKey: ['alerts', 'list', status, severity, type, q],
    queryFn: () => get<PageResult<AlertItem>>('/alerts', { status: status || undefined, severity: severity || undefined, type: type || undefined, q: q || undefined, size: 200 }),
    refetchInterval: 30_000,
  })
  const pick = (s: StatusFilter, sev = '') => {
    setStatus(s)
    setSeverity(sev)
  }

  return (
    <>
      <StatStrip className="lg:grid-cols-5">
        <StatCard label="Firing" value={summary.data?.active ?? 0} icon={BellRing} tone="accent" loading={summary.isLoading} onClick={() => pick('FIRING')} />
        <StatCard label="Critical" value={summary.data?.critical ?? 0} icon={AlertOctagon} tone={summary.data?.critical ? 'danger' : 'neutral'} loading={summary.isLoading} onClick={() => pick('FIRING', 'CRITICAL')} />
        <StatCard label="Warning" value={summary.data?.warning ?? 0} icon={AlertTriangle} tone={summary.data?.warning ? 'warning' : 'neutral'} loading={summary.isLoading} onClick={() => pick('FIRING', 'WARNING')} />
        <StatCard label="Pending" value={summary.data?.pending ?? 0} icon={Hourglass} tone="neutral" loading={summary.isLoading} hint="Not firing yet" onClick={() => pick('PENDING')} />
        <StatCard label="Rules active" value={rules.data ? `${rules.data.filter((r) => r.enabled).length}/${rules.data.length}` : '—'} icon={ListChecks} tone="violet" loading={rules.isLoading} hint="Configure under Rules" />
      </StatStrip>

      <Card className="mt-5 overflow-hidden">
        <Toolbar>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'FIRING', label: 'Firing' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: '', label: 'All' },
            ]}
          />
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-36">
            <option value="">All severities</option>
            {['CRITICAL', 'WARNING', 'INFO'].map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-56">
            <option value="">All alert types</option>
            {rules.data?.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
          </Select>
          <SearchInput value={q} onChange={setQ} placeholder="Search title or resource…" className="w-full sm:w-60" />
          <span className="ml-auto text-xs text-subtle">{list.data?.total ?? 0} alerts</span>
        </Toolbar>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            rows={list.data?.items}
            loading={list.isLoading}
            rowKey={(a) => a.id}
            onRowClick={(a) => setSelected(a.id)}
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
                      <p className="max-w-[480px] truncate font-medium">{a.title}</p>
                      <p className="max-w-[480px] truncate text-xs text-muted">{a.resource}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'type', header: 'Type', sortValue: (a) => a.typeLabel, cell: (a) => <Badge>{a.typeLabel ?? a.source.toLowerCase()}</Badge> },
              { key: 'status', header: 'Status', sortValue: (a) => a.status, cell: (a) => <AlertStatusBadges alert={a} /> },
              {
                key: 'notify',
                header: 'Notified',
                align: 'right',
                sortValue: (a) => a.notificationCount,
                cell: (a) => (
                  <div className="text-xs whitespace-nowrap">
                    <p className="tabular">{a.notificationCount}×</p>
                    {a.status === 'OPEN' && a.nextNotifyAt && <p className="text-subtle">next {timeAgo(a.nextNotifyAt)}</p>}
                  </div>
                ),
              },
              { key: 'count', header: 'Seen', align: 'right', sortValue: (a) => a.occurrences, cell: (a) => <span className="tabular">×{a.occurrences}</span> },
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
                      <Menu
                        trigger={<Button size="icon-sm" variant="ghost" aria-label="More"><MoreHorizontal /></Button>}
                        items={[
                          ...SNOOZE_OPTIONS.slice(0, 4).map((o) => ({ label: `Snooze ${o.label}`, icon: BellOff, onSelect: () => act.mutate({ id: a.id, op: 'snooze', minutes: o.minutes }) })),
                          { label: 'Resolve', icon: CheckCheck, onSelect: () => act.mutate({ id: a.id, op: 'resolve' }), separatorBefore: true },
                        ]}
                      />
                    </div>
                  ),
              },
            ]}
          />
        )}
      </Card>
      <AlertDetailSheet
        alertId={selected}
        onClose={() => {
          setSelected(null)
          clearFocus()
        }}
      />
    </>
  )
}
