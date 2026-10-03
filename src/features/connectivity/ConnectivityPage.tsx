import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import cronstrue from 'cronstrue'
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  Radar,
  Repeat,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, Sheet } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, JsonView, Menu, Mono, Segmented, Tooltip } from '@/components/ui/misc'
import { Page, PageHeader } from '@/components/ui/page'
import { StatCard, StatStrip } from '@/components/ui/stat-card'
import { Switch } from '@/components/ui/switch'
import { del, errorMessage, get, post, put } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { ConnResult, ConnTarget, ScheduleType, TestType } from '@/lib/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'

const TYPES: { value: TestType; label: string; hint: string }[] = [
  { value: 'HTTP', label: 'HTTP(S)', hint: 'Request a URL and check the status code' },
  { value: 'TCP', label: 'TCP', hint: 'Open a socket to host:port' },
  { value: 'DNS', label: 'DNS', hint: 'Resolve a hostname from the pod' },
  { value: 'TLS', label: 'TLS', hint: 'Handshake and inspect the certificate' },
]

const INTERVALS = [
  { label: '30 sec', value: 30 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '24 hours', value: 86400 },
]

const CRON_PRESETS = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Weekdays 09:00', value: '0 9 * * 1-5' },
  { label: 'Daily 06:00', value: '0 6 * * *' },
  { label: 'Every Monday 08:00', value: '0 8 * * 1' },
]

export function describeCron(cron?: string) {
  if (!cron) return ''
  try {
    return cronstrue.toString(cron, { use24HourTimeFormat: true })
  } catch {
    return 'Invalid cron expression'
  }
}

function scheduleText(t: Pick<ConnTarget, 'scheduleType' | 'intervalSeconds' | 'cron'>) {
  if (t.scheduleType === 'INTERVAL' && t.intervalSeconds) {
    const preset = INTERVALS.find((i) => i.value === t.intervalSeconds)
    return `Every ${preset?.label ?? `${t.intervalSeconds}s`}`
  }
  if (t.scheduleType === 'CRON') return describeCron(t.cron)
  return 'Manual'
}

export default function ConnectivityPage() {
  useCrumbs([{ label: 'Connectivity' }])
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<ConnTarget | null | 'new'>(null)
  const [detail, setDetail] = useState<ConnTarget | null>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['connectivity', 'targets'],
    queryFn: () => get<ConnTarget[]>('/connectivity/targets'),
    refetchInterval: 15_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['connectivity'] })
  const runOne = useMutation({
    mutationFn: (id: number) => post<ConnResult>(`/connectivity/targets/${id}/run`),
    onSuccess: (r) => {
      invalidate()
      if (r.success) toast.success(`${r.target}: ${r.message}`, { description: `${r.latencyMs} ms` })
      else toast.error(`${r.target}: ${r.message}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const runAll = useMutation({
    mutationFn: () => post<ConnResult[]>('/connectivity/run-all'),
    onSuccess: (r) => {
      invalidate()
      const failed = r.filter((x) => !x.success).length
      if (failed) toast.warning(`${r.length - failed}/${r.length} targets reachable`)
      else toast.success(`All ${r.length} targets reachable`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const toggle = useMutation({
    mutationFn: (t: ConnTarget) => put(`/connectivity/targets/${t.id}`, { ...toRequest(t), enabled: !t.enabled }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => del(`/connectivity/targets/${id}`),
    onSuccess: () => {
      invalidate()
      toast.success('Target deleted')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const targets = data ?? []
  const up = targets.filter((t) => t.lastStatus === 'UP').length
  const down = targets.filter((t) => t.lastStatus === 'DOWN').length
  const scheduled = targets.filter((t) => t.enabled && t.scheduleType !== 'NONE').length

  return (
    <Page>
      <PageHeader
        title="Connectivity"
        description="Test reachability of external services and endpoints from inside the Kubernetes cluster. Tests run from the portal pod, so they follow the real egress path."
        actions={
          isAdmin && (
            <>
              <Button onClick={() => runAll.mutate()} loading={runAll.isPending}>
                {!runAll.isPending && <PlayCircle />} Run all
              </Button>
              <Button variant="primary" onClick={() => setEditing('new')}>
                <Plus /> New target
              </Button>
            </>
          )
        }
      />

      <StatStrip>
        <StatCard label="Targets" value={targets.length} icon={Radar} tone="accent" loading={isLoading} hint="Saved endpoints" />
        <StatCard label="Reachable" value={up} icon={CheckCircle2} tone="success" loading={isLoading} hint="Last check succeeded" />
        <StatCard label="Unreachable" value={down} icon={XCircle} tone={down ? 'danger' : 'neutral'} loading={isLoading} hint={down ? 'Alerts raised after threshold' : 'Nothing failing'} />
        <StatCard label="Scheduled" value={scheduled} icon={CalendarClock} tone="violet" loading={isLoading} hint="Interval or cron" />
      </StatStrip>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[380px_1fr]">
        <QuickTest />
        <Card className="min-w-0 overflow-hidden">
          <CardHeader icon={Repeat} title="Saved targets" description="Scheduled checks run on one replica at a time (ShedLock) and raise alerts after consecutive failures." />
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : (
            <DataTable
              rows={targets}
              loading={isLoading}
              rowKey={(t) => t.id}
              onRowClick={setDetail}
              className="border-t border-border"
              empty={<EmptyState icon={Radar} title="No saved targets" description="Save endpoints to test them on a schedule." />}
              columns={[
                {
                  key: 'name',
                  header: 'Target',
                  sortValue: (t) => t.name,
                  cell: (t) => (
                    <div className="flex items-center gap-3">
                      <StatusDot status={t.enabled ? t.lastStatus : undefined} />
                      <div className="min-w-0">
                        <p className="font-medium">{t.name}</p>
                        <Mono className="block max-w-[300px] truncate text-[11.5px] text-subtle">{t.description}</Mono>
                      </div>
                    </div>
                  ),
                },
                { key: 'type', header: 'Type', sortValue: (t) => t.testType, cell: (t) => <Badge>{t.testType}</Badge> },
                {
                  key: 'schedule',
                  header: 'Schedule',
                  sortValue: (t) => t.scheduleType,
                  cell: (t) => (
                    <div className="text-[13px]">
                      <p className={cn(!t.enabled && 'text-subtle line-through')}>{scheduleText(t)}</p>
                      {t.enabled && t.nextRunAt && <p className="text-xs text-subtle">next {timeAgo(t.nextRunAt)}</p>}
                    </div>
                  ),
                },
                {
                  key: 'last',
                  header: 'Last result',
                  sortValue: (t) => t.lastRunAt,
                  cell: (t) =>
                    t.lastRunAt ? (
                      <div className="text-[13px]">
                        <p className={cn(t.lastStatus === 'DOWN' && 'text-danger')}>{t.lastStatus === 'UP' ? `${t.lastLatencyMs} ms` : t.consecutiveFailures ? `failed ×${t.consecutiveFailures}` : 'failed'}</p>
                        <p className="text-xs text-subtle">{timeAgo(t.lastRunAt)}</p>
                      </div>
                    ) : (
                      <span className="text-subtle">never</span>
                    ),
                },
                {
                  key: 'uptime',
                  header: 'Uptime 24h',
                  align: 'right',
                  sortValue: (t) => t.uptime24h ?? -1,
                  cell: (t) =>
                    t.uptime24h === null || t.uptime24h === undefined ? (
                      <span className="text-subtle">—</span>
                    ) : (
                      <span className={cn('font-medium tabular', t.uptime24h >= 99 ? 'text-success' : t.uptime24h >= 90 ? 'text-warning' : 'text-danger')}>{t.uptime24h}%</span>
                    ),
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (t) =>
                    isAdmin && (
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Tooltip content={t.enabled ? 'Disable schedule' : 'Enable'}>
                          <span>
                            <Switch checked={t.enabled} onCheckedChange={() => toggle.mutate(t)} aria-label="Enabled" />
                          </span>
                        </Tooltip>
                        <Tooltip content="Run now">
                          <Button size="icon-sm" variant="ghost" onClick={() => runOne.mutate(t.id)} loading={runOne.isPending && runOne.variables === t.id}>
                            {!(runOne.isPending && runOne.variables === t.id) && <Play />}
                          </Button>
                        </Tooltip>
                        <Menu
                          trigger={<Button size="icon-sm" variant="ghost" aria-label="More"><MoreHorizontal /></Button>}
                          items={[
                            { label: 'Edit', icon: Pencil, onSelect: () => setEditing(t) },
                            {
                              label: 'Delete',
                              icon: Trash2,
                              danger: true,
                              separatorBefore: true,
                              onSelect: async () => {
                                if (await confirm({ title: `Delete "${t.name}"?`, description: 'Its schedule and result history are removed.', danger: true, confirmText: 'Delete' })) remove.mutate(t.id)
                              },
                            },
                          ]}
                        />
                      </div>
                    ),
                },
              ]}
            />
          )}
        </Card>
      </div>
      <TargetDialog target={editing} onClose={() => setEditing(null)} />
      <HistorySheet target={detail} onClose={() => setDetail(null)} />
    </Page>
  )
}

function StatusDot({ status }: { status?: string | null }) {
  return (
    <span className="relative flex size-2.5 shrink-0">
      {status === 'DOWN' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />}
      <span className={cn('relative inline-flex size-2.5 rounded-full', status === 'UP' ? 'bg-success' : status === 'DOWN' ? 'bg-danger' : 'bg-subtle')} />
    </span>
  )
}

function toRequest(t: ConnTarget) {
  return {
    name: t.name,
    testType: t.testType,
    host: t.host,
    port: t.port,
    url: t.url,
    httpMethod: t.httpMethod,
    expectedStatus: t.expectedStatus,
    timeoutMs: t.timeoutMs,
    scheduleType: t.scheduleType,
    intervalSeconds: t.intervalSeconds,
    cron: t.cron?.split(' ').length === 6 && t.cron.startsWith('0 ') ? t.cron.slice(2) : t.cron,
    enabled: t.enabled,
    failureThreshold: t.failureThreshold,
    tags: t.tags.join(','),
  }
}

function TargetFields({ form, set }: { form: Partial<ConnTarget>; set: (p: Partial<ConnTarget>) => void }) {
  return (
    <>
      <Field label="Test type">
        <Segmented value={form.testType ?? 'HTTP'} onChange={(v) => set({ testType: v })} options={TYPES.map((t) => ({ value: t.value, label: t.label }))} />
      </Field>
      {form.testType === 'HTTP' ? (
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <Field label="Method">
            <Select value={form.httpMethod ?? 'GET'} onChange={(e) => set({ httpMethod: e.target.value })}>
              {['GET', 'HEAD', 'POST', 'OPTIONS'].map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="URL" required>
            <Input value={form.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://api.partner.com/health" className="font-mono" />
          </Field>
        </div>
      ) : (
        <div className={cn('grid gap-2', form.testType === 'DNS' ? 'grid-cols-1' : 'grid-cols-[1fr_110px]')}>
          <Field label="Host" required>
            <Input value={form.host ?? ''} onChange={(e) => set({ host: e.target.value })} placeholder="kafka.internal or 10.20.1.11" className="font-mono" />
          </Field>
          {form.testType !== 'DNS' && (
            <Field label="Port" required={form.testType === 'TCP'}>
              <Input type="number" value={form.port ?? ''} onChange={(e) => set({ port: e.target.value ? Number(e.target.value) : undefined })} placeholder={form.testType === 'TLS' ? '443' : '9092'} />
            </Field>
          )}
        </div>
      )}
      <p className="-mt-2 text-xs text-subtle">{TYPES.find((t) => t.value === form.testType)?.hint}</p>
    </>
  )
}

function QuickTest() {
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  const [form, setForm] = useState<Partial<ConnTarget>>({ testType: 'HTTP', url: 'https://', httpMethod: 'GET', timeoutMs: 5000 })
  const recent = useQuery({ queryKey: ['connectivity', 'adhoc'], queryFn: () => get<ConnResult[]>('/connectivity/adhoc-results', { limit: 6 }) })
  const test = useMutation({
    mutationFn: () => post<ConnResult>('/connectivity/test', { ...form }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connectivity', 'adhoc'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const r = test.data
  return (
    <Card className="h-fit">
      <CardHeader icon={Zap} title="Quick test" description="One-off check from the cluster" />
      <CardBody className="space-y-4">
        <TargetFields form={form} set={(p) => setForm((f) => ({ ...f, ...p }))} />
        <Button variant="primary" className="w-full" onClick={() => test.mutate()} loading={test.isPending} disabled={!isAdmin}>
          {!test.isPending && <Play />} Run test
        </Button>
        {!isAdmin && <p className="text-center text-xs text-subtle">Running tests requires the admin role.</p>}
        {r && (
          <div className={cn('rounded-xl border p-3', r.success ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft')}>
            <div className="flex items-center gap-2">
              {r.success ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-danger" />}
              <span className="text-[13px] font-medium">{r.message}</span>
              <span className="ml-auto text-xs text-muted tabular">{r.latencyMs} ms</span>
            </div>
            {r.details && <JsonView value={r.details} className="mt-2 max-h-48 bg-bg/70 text-[11px]" />}
          </div>
        )}
        {!!recent.data?.length && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Recent quick tests</p>
            <ul className="space-y-1">
              {recent.data.map((x) => (
                <li key={x.id} className="flex items-center gap-2 text-xs">
                  <StatusDot status={x.success ? 'UP' : 'DOWN'} />
                  <Mono className="flex-1 truncate text-[11.5px]">{x.target}</Mono>
                  <span className="text-subtle">{timeAgo(x.ts)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function TargetDialog({ target, onClose }: { target: ConnTarget | null | 'new'; onClose: () => void }) {
  const qc = useQueryClient()
  const isNew = target === 'new'
  const [form, setForm] = useState<Partial<ConnTarget>>({})
  const set = (p: Partial<ConnTarget>) => setForm((f) => ({ ...f, ...p }))
  useEffect(() => {
    if (target === 'new') {
      setForm({ testType: 'HTTP', httpMethod: 'GET', url: 'https://', timeoutMs: 5000, scheduleType: 'INTERVAL', intervalSeconds: 300, enabled: true, failureThreshold: 3, tags: [] })
    } else if (target) {
      const req = toRequest(target)
      setForm({ ...target, cron: req.cron })
    }
  }, [target])
  const save = useMutation({
    mutationFn: () => {
      const body = { ...toRequest(form as ConnTarget), cron: form.cron, tags: (form.tags ?? []).join(',') }
      return isNew ? post('/connectivity/targets', body) : put(`/connectivity/targets/${(target as ConnTarget).id}`, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connectivity'] })
      toast.success(isNew ? 'Target created and scheduled' : 'Target updated')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const scheduleType = form.scheduleType ?? 'NONE'
  const cronDesc = scheduleType === 'CRON' ? describeCron(form.cron) : ''

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'New connectivity target' : `Edit ${form.name ?? ''}`}
      className="w-[min(620px,calc(100vw-32px))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!form.name?.trim()} onClick={() => save.mutate()}>
            {isNew ? 'Create target' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input autoFocus value={form.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Partner API – production" />
        </Field>
        <TargetFields form={form} set={set} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Timeout (ms)">
            <Input type="number" value={form.timeoutMs ?? 5000} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
          </Field>
          {form.testType === 'HTTP' && (
            <Field label="Expected status" hint="Empty = any < 400">
              <Input type="number" value={form.expectedStatus ?? ''} onChange={(e) => set({ expectedStatus: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
          )}
          <Field label="Alert after" hint="consecutive failures">
            <Input type="number" min={1} value={form.failureThreshold ?? 3} onChange={(e) => set({ failureThreshold: Number(e.target.value) })} />
          </Field>
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[13px] font-medium"><Clock className="size-4 text-muted" /> Schedule</p>
            <label className="flex items-center gap-2 text-xs text-muted">
              Enabled <Switch checked={form.enabled !== false} onCheckedChange={(v) => set({ enabled: v })} />
            </label>
          </div>
          <Segmented<ScheduleType>
            value={scheduleType}
            onChange={(v) => set({ scheduleType: v, ...(v === 'INTERVAL' && !form.intervalSeconds ? { intervalSeconds: 300 } : {}), ...(v === 'CRON' && !form.cron ? { cron: '*/5 * * * *' } : {}) })}
            options={[
              { value: 'NONE', label: 'Manual only' },
              { value: 'INTERVAL', label: 'Interval' },
              { value: 'CRON', label: 'Cron' },
            ]}
          />
          {scheduleType === 'INTERVAL' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {INTERVALS.map((i) => (
                <button
                  key={i.value}
                  type="button"
                  onClick={() => set({ intervalSeconds: i.value })}
                  className={cn('h-7 rounded-md border px-2.5 text-xs', form.intervalSeconds === i.value ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:bg-hover')}
                >
                  {i.label}
                </button>
              ))}
              <Input type="number" min={30} value={form.intervalSeconds ?? ''} onChange={(e) => set({ intervalSeconds: Number(e.target.value) })} className="h-7 w-24 text-xs" aria-label="Seconds" />
              <span className="self-center text-xs text-subtle">seconds</span>
            </div>
          )}
          {scheduleType === 'CRON' && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map((p) => (
                  <button key={p.value} type="button" onClick={() => set({ cron: p.value })} className={cn('h-7 rounded-md border px-2.5 text-xs', form.cron === p.value ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:bg-hover')}>
                    {p.label}
                  </button>
                ))}
              </div>
              <Input value={form.cron ?? ''} onChange={(e) => set({ cron: e.target.value })} placeholder="*/5 * * * *" className="font-mono" />
              <p className={cn('text-xs', cronDesc.startsWith('Invalid') ? 'text-danger' : 'text-success')}>{cronDesc}</p>
              <p className="text-[11px] text-subtle">min hour day-of-month month day-of-week · server time zone</p>
            </div>
          )}
        </div>
        <Field label="Tags" hint="Comma separated">
          <Input value={(form.tags ?? []).join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </Field>
      </div>
    </Dialog>
  )
}

function HistorySheet({ target, onClose }: { target: ConnTarget | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['connectivity', 'results', target?.id],
    queryFn: () => get<ConnResult[]>(`/connectivity/targets/${target!.id}/results`, { limit: 60 }),
    enabled: !!target,
    refetchInterval: 15_000,
  })
  const chart = [...(data ?? [])].reverse().map((r) => ({ t: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ms: r.latencyMs ?? 0, ok: r.success }))
  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()} title={target?.name} description={target && `${target.testType} · ${target.description} · ${scheduleText(target)}`} className="w-[min(640px,100vw)]">
      {target && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Uptime 24h" value={target.uptime24h !== null && target.uptime24h !== undefined ? `${target.uptime24h}%` : '—'} />
            <Mini label="Avg latency" value={target.avgLatency24h !== null && target.avgLatency24h !== undefined ? `${target.avgLatency24h} ms` : '—'} />
            <Mini label="Next run" value={target.nextRunAt ? timeAgo(target.nextRunAt) : '—'} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Latency (last {chart.length} runs)</p>
            <div className="h-40 rounded-xl border border-border p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: 'var(--subtle)', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                  <ChartTooltip cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="ms" radius={[3, 3, 0, 0]}>
                    {chart.map((c, i) => <Cell key={i} fill={c.ok ? 'var(--success)' : 'var(--danger)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="divide-y divide-border rounded-xl border border-border">
            {data?.map((r) => (
              <details key={r.id} className="group px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px]">
                  <StatusDot status={r.success ? 'UP' : 'DOWN'} />
                  <span className="flex-1 truncate">{r.message}</span>
                  <span className="text-xs text-muted tabular">{r.latencyMs} ms</span>
                  <span className="w-36 text-right text-xs text-subtle">{formatDateTime(r.ts)}</span>
                </summary>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>Triggered by {r.triggeredBy}</p>
                  {r.details && <JsonView value={r.details} className="text-[11px]" />}
                </div>
              </details>
            ))}
            {data?.length === 0 && <EmptyState title="No runs yet" className="py-8" />}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-[15px] font-semibold tabular">{value}</p>
    </div>
  )
}
