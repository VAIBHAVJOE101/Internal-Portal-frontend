import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Download, ScrollText, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Sheet } from '@/components/ui/dialog'
import { Input, SearchInput, Select } from '@/components/ui/input'
import { Avatar, EmptyState, ErrorState, JsonView, Mono } from '@/components/ui/misc'
import { Page, PageHeader, Toolbar } from '@/components/ui/page'
import { get } from '@/lib/api'
import type { AuditEntry, PageResult } from '@/lib/types'
import { downloadText, formatDateTime, timeAgo } from '@/lib/utils'

const PAGE_SIZE = 50

function actionTone(action: string) {
  if (/DELETE|REMOVE|PURGE/.test(action)) return 'danger' as const
  if (/CREATE|ADD/.test(action)) return 'success' as const
  if (/RESTART|RERUN|RESET|PAUSE|RESUME|CANCEL/.test(action)) return 'warning' as const
  if (/UPDATE|CONFIG|REMAP|REORDER/.test(action)) return 'accent' as const
  return 'neutral' as const
}

export default function AuditPage() {
  useCrumbs([{ label: 'Audit logs' }])
  const [filters, setFilters] = useState({ username: '', action: '', targetType: '', q: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const facets = useQuery({ queryKey: ['audit', 'facets'], queryFn: () => get<{ users: string[]; actions: string[]; targetTypes: string[] }>('/audit/facets') })
  const params = {
    username: filters.username || undefined,
    action: filters.action || undefined,
    targetType: filters.targetType || undefined,
    q: filters.q || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to + 'T23:59:59').toISOString() : undefined,
  }
  const list = useQuery({
    queryKey: ['audit', 'list', params, page],
    queryFn: () => get<PageResult<AuditEntry>>('/audit', { ...params, page, size: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  })
  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }
  const total = list.data?.total ?? 0

  const exportCsv = () => {
    const rows = list.data?.items ?? []
    const head = 'timestamp,user,role,action,target_type,target,success,ip\n'
    const body = rows.map((r) => [r.ts, r.username, r.role, r.action, r.targetType, r.targetId ?? '', r.success, r.clientIp ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadText('audit-log.csv', head + body)
  }

  return (
    <Page>
      <PageHeader
        title="Audit logs"
        description="Every change made through the portal – who, what, when, from where and the before/after values."
        actions={<Button onClick={exportCsv}><Download /> Export page</Button>}
      />
      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={filters.q} onChange={(q) => set({ q })} placeholder="Search target, action, user…" className="w-full sm:w-64" />
          <Select value={filters.username} onChange={(e) => set({ username: e.target.value })} className="w-36">
            <option value="">All users</option>
            {facets.data?.users.map((u) => <option key={u}>{u}</option>)}
          </Select>
          <Select value={filters.action} onChange={(e) => set({ action: e.target.value })} className="w-56">
            <option value="">All actions</option>
            {facets.data?.actions.map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Select value={filters.targetType} onChange={(e) => set({ targetType: e.target.value })} className="w-44">
            <option value="">All targets</option>
            {facets.data?.targetTypes.map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="w-36" aria-label="From" />
          <ArrowRight className="size-3.5 text-subtle" />
          <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="w-36" aria-label="To" />
        </Toolbar>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            rows={list.data?.items}
            loading={list.isLoading}
            rowKey={(r) => r.id}
            onRowClick={setSelected}
            empty={<EmptyState icon={ScrollText} title="No audit entries match" />}
            columns={[
              {
                key: 'ts',
                header: 'When',
                cell: (r) => (
                  <div className="text-xs whitespace-nowrap">
                    <p className="text-fg">{formatDateTime(r.ts)}</p>
                    <p className="text-subtle">{timeAgo(r.ts)}</p>
                  </div>
                ),
              },
              {
                key: 'user',
                header: 'User',
                cell: (r) => (
                  <span className="flex items-center gap-2">
                    <Avatar name={r.username} size={22} />
                    <span className="text-[13px]">{r.username}</span>
                    {r.role && <Badge tone={r.role === 'ADMIN' ? 'violet' : 'neutral'}>{r.role.toLowerCase()}</Badge>}
                  </span>
                ),
              },
              { key: 'action', header: 'Action', cell: (r) => <Badge tone={actionTone(r.action)} className="font-mono text-[11px]">{r.action}</Badge> },
              {
                key: 'target',
                header: 'Target',
                cell: (r) => (
                  <div className="min-w-0">
                    <Mono className="block max-w-[380px] truncate">{r.targetId ?? '—'}</Mono>
                    <span className="text-xs text-subtle">{r.targetType}</span>
                  </div>
                ),
              },
              {
                key: 'result',
                header: 'Result',
                cell: (r) => (r.success ? <CheckCircle2 className="size-4 text-success" /> : <span className="flex items-center gap-1 text-xs text-danger"><XCircle className="size-4" /> failed</span>),
              },
              { key: 'ip', header: 'IP', cell: (r) => <Mono className="text-xs text-muted">{r.clientIp ?? '—'}</Mono> },
            ]}
          />
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted">
          <span>
            {total ? `${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total}` : '0 entries'}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)} title={selected?.action} description={selected && `${selected.username} · ${formatDateTime(selected.ts)}`}>
        {selected && <AuditDetail entry={selected} />}
      </Sheet>
    </Page>
  )
}

function AuditDetail({ entry }: { entry: AuditEntry }) {
  const details = (entry.details ?? {}) as Record<string, unknown>
  const before = details.before as Record<string, unknown> | undefined
  const after = details.after as Record<string, unknown> | undefined
  const rest = Object.fromEntries(Object.entries(details).filter(([k]) => k !== 'before' && k !== 'after'))
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const keys = [...new Set([...(isObj(before) ? Object.keys(before) : []), ...(isObj(after) ? Object.keys(after) : [])])]
  return (
    <div className="space-y-5 text-[13px]">
      <dl className="grid grid-cols-[110px_1fr] gap-y-2">
        <dt className="text-muted">Target</dt>
        <dd className="font-mono text-[12.5px] break-all">{entry.targetType} / {entry.targetId}</dd>
        <dt className="text-muted">Result</dt>
        <dd>{entry.success ? <Badge tone="success">success</Badge> : <Badge tone="danger">failed</Badge>}</dd>
        {entry.error && (
          <>
            <dt className="text-muted">Error</dt>
            <dd className="text-danger">{entry.error}</dd>
          </>
        )}
        <dt className="text-muted">Client IP</dt>
        <dd className="font-mono text-[12.5px]">{entry.clientIp ?? '—'}</dd>
      </dl>
      {keys.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Changes</p>
          <div className="divide-y divide-border rounded-xl border border-border">
            {keys.map((k) => (
              <div key={k} className="grid gap-1 px-3 py-2 sm:grid-cols-[140px_1fr]">
                <span className="font-mono text-[12px] text-muted">{k}</span>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
                  <span className="rounded bg-danger-soft px-1.5 text-danger line-through">{fmt(isObj(before) ? before[k] : undefined)}</span>
                  <ArrowRight className="size-3 text-subtle" />
                  <span className="rounded bg-success-soft px-1.5 text-success">{fmt(isObj(after) ? after[k] : undefined)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(Object.keys(rest).length > 0 || (!isObj(before) && before !== undefined)) && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Details</p>
          <JsonView value={keys.length ? rest : details} className="max-h-96" />
        </div>
      )}
    </div>
  )
}

function fmt(v: unknown) {
  if (v === null || v === undefined || v === '') return '∅'
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}
