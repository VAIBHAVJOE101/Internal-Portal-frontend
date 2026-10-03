import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BellOff,
  CheckCircle2,
  Clock,
  FlaskConical,
  Mail,
  MessageSquare,
  Plus,
  RotateCcw,
  Settings2,
  Siren,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { DataTable } from '@/components/ui/data-table'
import { Sheet } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { ErrorState, Tooltip } from '@/components/ui/misc'
import { Switch } from '@/components/ui/switch'
import { del, errorMessage, get, post, put } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AlertPolicy, EscalationStep, SettingView } from '@/lib/types'
import { cn, formatDateTime } from '@/lib/utils'
import { humanMinutes, humanSeconds, severityTone } from './shared'

const PARAM_LABELS: Record<string, { label: string; hint: string }> = {
  lagThreshold: { label: 'Lag threshold (messages)', hint: 'Warning when total group lag exceeds this. A "lagThreshold" column on a Kafka instance overrides it.' },
  criticalMultiplier: { label: 'Critical at × threshold', hint: 'Severity becomes CRITICAL above threshold × multiplier' },
  warnDays: { label: 'Warn when ≤ days left', hint: 'Expiry-tracked dates within this window raise a WARNING' },
  criticalDays: { label: 'Critical when ≤ days left', hint: 'and become CRITICAL within this window (or when expired)' },
}

/** Notification times (minutes after firing) for the first few reminders, given the repeat policy. */
export function repeatSchedule(p: Pick<AlertPolicy, 'repeatMinutes' | 'backoffMultiplier' | 'maxRepeatMinutes' | 'maxNotifications'>, count = 6) {
  if (p.repeatMinutes <= 0) return []
  const out: number[] = []
  let t = 0
  for (let n = 1; n <= count; n++) {
    if (p.maxNotifications > 0 && n >= p.maxNotifications) break
    t += Math.min(p.repeatMinutes * Math.pow(Math.max(1, p.backoffMultiplier), n - 1), Math.max(p.repeatMinutes, p.maxRepeatMinutes))
    out.push(Math.round(t))
  }
  return out
}

function toRequest(p: AlertPolicy) {
  return {
    enabled: p.enabled,
    severity: p.severity,
    minOccurrences: p.minOccurrences,
    pendingSeconds: p.pendingSeconds,
    repeatMinutes: p.repeatMinutes,
    backoffMultiplier: p.backoffMultiplier,
    maxRepeatMinutes: p.maxRepeatMinutes,
    maxNotifications: p.maxNotifications,
    notifyOnResolve: p.notifyOnResolve,
    resolveGraceSeconds: p.resolveGraceSeconds,
    staleMinutes: p.staleMinutes,
    reopenWindowMinutes: p.reopenWindowMinutes,
    emailEnabled: p.emailEnabled,
    emailRecipients: p.emailRecipients,
    teamsEnabled: p.teamsEnabled,
    escalation: p.escalation,
    params: p.params,
    mutedUntil: p.mutedUntil || null,
    muteReason: p.muteReason || null,
  }
}

export function RulesTab() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AlertPolicy | null>(null)
  const rules = useQuery({ queryKey: ['alerts', 'rules'], queryFn: () => get<AlertPolicy[]>('/alerts/rules') })
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => get<SettingView[]>('/settings') })
  const email = settings.data?.find((s) => s.type === 'EMAIL')
  const teams = settings.data?.find((s) => s.type === 'TEAMS')
  const toggle = useMutation({
    mutationFn: (p: AlertPolicy) => put<AlertPolicy>(`/alerts/rules/${p.type}`, { ...toRequest(p), enabled: !p.enabled }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success(`${p.label} ${p.enabled ? 'enabled' : 'disabled'}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (rules.error) return <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
  const now = new Date()

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <ChannelCard icon={Mail} title="Email (SMTP)" configured={!!email?.configured} detail={email?.values.defaultRecipients ? `Default recipients: ${email.values.defaultRecipients}` : 'No default recipients'} />
        <ChannelCard icon={MessageSquare} title="Microsoft Teams" configured={!!teams?.configured} detail={teams?.secretsSet.escalationWebhookUrl ? 'Channel + escalation channel configured' : 'Channel webhook'} />
      </div>

      <Card className="overflow-hidden">
        <DataTable
          rows={rules.data}
          loading={rules.isLoading}
          rowKey={(r) => r.type}
          onRowClick={setEditing}
          rowClassName={(r) => (!r.enabled ? 'opacity-55' : undefined)}
          columns={[
            {
              key: 'enabled',
              header: 'Active',
              width: 70,
              cell: (r) => (
                <span onClick={(e) => e.stopPropagation()}>
                  <Switch checked={r.enabled} disabled={!isAdmin} onCheckedChange={() => toggle.mutate(r)} aria-label={`Enable ${r.label}`} />
                </span>
              ),
            },
            {
              key: 'rule',
              header: 'Alert rule',
              sortValue: (r) => r.label,
              cell: (r) => (
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {r.label}
                    {r.customized && <Badge tone="accent">customized</Badge>}
                    {r.mutedUntil && new Date(r.mutedUntil) > now && (
                      <Tooltip content={`Muted until ${formatDateTime(r.mutedUntil)}${r.muteReason ? ` – ${r.muteReason}` : ''}`}>
                        <span><Badge tone="violet"><BellOff className="size-3" /> muted</Badge></span>
                      </Tooltip>
                    )}
                  </p>
                  <p className="max-w-[420px] truncate text-xs text-muted">{r.description}</p>
                </div>
              ),
            },
            { key: 'severity', header: 'Severity', sortValue: (r) => r.severity, cell: (r) => <Badge tone={severityTone(r.severity)}>{r.severity.toLowerCase()}</Badge> },
            {
              key: 'trigger',
              header: 'Fires after',
              cell: (r) => (
                <span className="text-xs whitespace-nowrap">
                  {r.minOccurrences}× · {humanSeconds(r.pendingSeconds)}
                </span>
              ),
            },
            {
              key: 'notify',
              header: 'Reminders',
              cell: (r) => {
                const s = repeatSchedule(r, 3)
                return <span className="text-xs whitespace-nowrap text-muted">{s.length ? s.map(humanMinutes).join(' → ') + ' …' : 'once'}</span>
              },
            },
            {
              key: 'escalation',
              header: 'Escalation',
              cell: (r) =>
                r.escalation.length ? (
                  <span className="flex items-center gap-1 text-xs"><Siren className="size-3.5 text-danger" /> {r.escalation.map((e) => humanMinutes(e.afterMinutes)).join(', ')}</span>
                ) : (
                  <span className="text-xs text-subtle">none</span>
                ),
            },
            {
              key: 'channels',
              header: 'Channels',
              cell: (r) => (
                <span className="flex gap-1.5 text-muted">
                  <Mail className={cn('size-4', r.emailEnabled ? 'text-fg' : 'opacity-25')} />
                  <MessageSquare className={cn('size-4', r.teamsEnabled ? 'text-fg' : 'opacity-25')} />
                </span>
              ),
            },
            {
              key: 'resolve',
              header: 'Auto-resolve',
              cell: (r) => (
                <span className="text-xs whitespace-nowrap text-muted">
                  clear {humanSeconds(r.resolveGraceSeconds)}
                  {r.staleMinutes > 0 && ` · stale ${humanMinutes(r.staleMinutes)}`}
                </span>
              ),
            },
          ]}
        />
      </Card>
      <RuleSheet rule={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ChannelCard({ icon: Icon, title, configured, detail }: { icon: typeof Mail; title: string; configured: boolean; detail: string }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-9 place-items-center rounded-lg bg-card-2"><Icon className="size-4.5" /></span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          {title}
          {configured ? <Badge tone="success" dot>configured</Badge> : <Badge tone="warning" dot>not configured</Badge>}
        </p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
      <Link to="/settings" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        <Settings2 className="size-3.5" /> Configure
      </Link>
    </Card>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h4 className="text-[13px] font-semibold">{title}</h4>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Num({ label, value, onChange, hint, min = 0, step = 1, disabled }: { label: string; value: number; onChange: (v: number) => void; hint?: string; min?: number; step?: number; disabled?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <Input type="number" min={min} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  )
}

function EmailList({ value, onChange, disabled, placeholder }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...new Set([...value, ...parts])])
    setDraft('')
  }
  return (
    <div className="flex min-h-8.5 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg/60 px-2 py-1.5 focus-within:border-accent">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-card-2 px-1.5 py-0.5 text-xs">
          {v}
          {!disabled && (
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="text-muted hover:text-fg" aria-label={`Remove ${v}`}>
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={() => draft && add()}
          placeholder={value.length ? '' : placeholder}
          className="min-w-32 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle"
        />
      )}
    </div>
  )
}

function RuleSheet({ rule, onClose }: { rule: AlertPolicy | null; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [p, setP] = useState<AlertPolicy | null>(rule)
  useEffect(() => setP(rule), [rule])
  const set = (patch: Partial<AlertPolicy>) => setP((x) => (x ? { ...x, ...patch } : x))
  const schedule = useMemo(() => (p ? repeatSchedule(p, 6) : []), [p])

  const save = useMutation({
    mutationFn: () => put<AlertPolicy>(`/alerts/rules/${p!.type}`, toRequest(p!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alert rule saved')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const reset = useMutation({
    mutationFn: () => del<AlertPolicy>(`/alerts/rules/${p!.type}`),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      setP(d)
      toast.success('Rule reset to defaults')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const test = useMutation({
    mutationFn: () => post<{ channel: string; success: boolean; detail: string }[]>(`/alerts/rules/${p!.type}/test`),
    onSuccess: (r) =>
      r.forEach((d) => (d.success ? toast.success(`${d.channel}: ${d.detail}`) : toast.warning(`${d.channel}: ${d.detail}`))),
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!p) return <Sheet open={false} onOpenChange={() => {}} title="" />
  const ro = !isAdmin
  const muted = p.mutedUntil && new Date(p.mutedUntil) > new Date()
  const muteFor = (hours: number) => set({ mutedUntil: new Date(Date.now() + hours * 3_600_000).toISOString() })
  const updateStep = (i: number, patch: Partial<EscalationStep>) => set({ escalation: p.escalation.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })

  return (
    <Sheet
      open={!!rule}
      onOpenChange={(o) => !o && onClose()}
      title={p.label}
      description={p.description}
      className="w-[min(720px,100vw)]"
      footer={
        isAdmin ? (
          <>
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={async () => {
                if (await confirm({ title: 'Reset to defaults?', description: 'All overrides of this rule are removed.', confirmText: 'Reset' })) reset.mutate()
              }}
              disabled={!p.customized}
            >
              <RotateCcw /> Reset
            </Button>
            <Button onClick={() => test.mutate()} loading={test.isPending}>
              <FlaskConical /> Send test
            </Button>
            <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending}>Save rule</Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Section title="General">
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-[13px] font-medium">Alert active</p>
              <p className="text-xs text-muted">When off, this condition is ignored and open alerts of this type are resolved.</p>
            </div>
            <Switch checked={p.enabled} disabled={ro} onCheckedChange={(v) => set({ enabled: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default severity" hint="Checks may raise it (e.g. lag × multiplier, expiry critical days)">
              <Select value={p.severity} disabled={ro} onChange={(e) => set({ severity: e.target.value as AlertPolicy['severity'] })}>
                {['CRITICAL', 'WARNING', 'INFO'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            {Object.keys(p.params).map((k) => (
              <Num key={k} label={PARAM_LABELS[k]?.label ?? k} hint={PARAM_LABELS[k]?.hint} value={Number(p.params[k])} disabled={ro} onChange={(v) => set({ params: { ...p.params, [k]: v } })} />
            ))}
          </div>
        </Section>

        <Section title="Trigger" description="Avoid flapping: the alert stays pending until both conditions are met.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Num label="Minimum consecutive detections" min={1} value={p.minOccurrences} disabled={ro} onChange={(v) => set({ minOccurrences: v })} />
            <Num label="Pending for (seconds)" value={p.pendingSeconds} hint={`Condition must persist ${humanSeconds(p.pendingSeconds)}`} disabled={ro} onChange={(v) => set({ pendingSeconds: v })} />
          </div>
        </Section>

        <Section title="Notifications" description="First notification when the alert fires, then reminders with increasing intervals until acknowledged.">
          <div className="grid gap-2 sm:grid-cols-2">
            <ChannelToggle icon={Mail} label="Email" checked={p.emailEnabled} disabled={ro} onChange={(v) => set({ emailEnabled: v })} />
            <ChannelToggle icon={MessageSquare} label="Microsoft Teams" checked={p.teamsEnabled} disabled={ro} onChange={(v) => set({ teamsEnabled: v })} />
          </div>
          {p.emailEnabled && (
            <Field label="Email recipients" hint="Leave empty to use the default recipients from Settings → Email">
              <EmailList value={p.emailRecipients} disabled={ro} onChange={(v) => set({ emailRecipients: v })} placeholder="team@acme.io, press Enter" />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
            <Num label="First reminder (min)" value={p.repeatMinutes} hint="0 = notify once" disabled={ro} onChange={(v) => set({ repeatMinutes: v })} />
            <Num label="Backoff ×" min={1} step={0.5} value={p.backoffMultiplier} disabled={ro} onChange={(v) => set({ backoffMultiplier: v })} />
            <Num label="Max interval (min)" min={1} value={p.maxRepeatMinutes} disabled={ro} onChange={(v) => set({ maxRepeatMinutes: v })} />
            <Num label="Max notifications" value={p.maxNotifications} hint="0 = unlimited" disabled={ro} onChange={(v) => set({ maxNotifications: v })} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-card-2/50 px-3 py-2 text-xs">
            <TrendingUp className="size-3.5 text-muted" />
            <span className="text-muted">Schedule:</span>
            <Badge tone="accent">fire</Badge>
            {schedule.length === 0 && <span className="text-muted">no reminders</span>}
            {schedule.map((m, i) => (
              <span key={i} className="flex items-center gap-1.5"><span className="text-subtle">→</span><Badge>+{humanMinutes(m)}</Badge></span>
            ))}
            {schedule.length > 0 && <span className="text-subtle">… until acknowledged or resolved</span>}
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={p.notifyOnResolve} disabled={ro} onCheckedChange={(v) => set({ notifyOnResolve: v })} /> Send a notification when the alert resolves
          </label>
        </Section>

        <Section title="Escalation" description="Runs when the alert is still unacknowledged after the given time since firing.">
          {p.escalation.length === 0 && <p className="text-xs text-subtle">No escalation steps.</p>}
          {p.escalation.map((s, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-card-2/40 p-3">
              <div className="flex items-center gap-2">
                <Badge tone="danger"><Siren className="size-3" /> Level {i + 1}</Badge>
                <span className="text-xs text-muted">after</span>
                <Input type="number" min={1} value={s.afterMinutes} disabled={ro} onChange={(e) => updateStep(i, { afterMinutes: Number(e.target.value) })} className="h-7.5 w-20" />
                <span className="text-xs text-muted">min unacknowledged</span>
                {!ro && (
                  <Button size="icon-sm" variant="ghost" className="ml-auto" onClick={() => set({ escalation: p.escalation.filter((_, idx) => idx !== i) })} aria-label="Remove step">
                    <Trash2 />
                  </Button>
                )}
              </div>
              <Field label="Also notify">
                <EmailList value={s.emails} disabled={ro} onChange={(v) => updateStep(i, { emails: v })} placeholder="oncall@acme.io" />
              </Field>
              <div className="flex flex-wrap gap-4 text-[13px]">
                <label className="flex items-center gap-2"><Switch checked={s.teams} disabled={ro} onCheckedChange={(v) => updateStep(i, { teams: v })} /> Post to Teams escalation channel</label>
                <label className="flex items-center gap-2"><Switch checked={s.raiseToCritical} disabled={ro} onCheckedChange={(v) => updateStep(i, { raiseToCritical: v })} /> Raise severity to CRITICAL</label>
              </div>
            </div>
          ))}
          {!ro && (
            <Button
              size="sm"
              onClick={() => set({ escalation: [...p.escalation, { afterMinutes: (p.escalation.at(-1)?.afterMinutes ?? 0) + 30, emails: [], teams: true, raiseToCritical: false }] })}
            >
              <Plus /> Add escalation step
            </Button>
          )}
        </Section>

        <Section title="Auto-resolve" description="Health checks report when the condition clears; the alert resolves after it stays clear.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Num label="Clear for (seconds)" value={p.resolveGraceSeconds} hint={`Resolve after ${humanSeconds(p.resolveGraceSeconds)} clear`} disabled={ro} onChange={(v) => set({ resolveGraceSeconds: v })} />
            <Num label="Stale after (min)" value={p.staleMinutes} hint="Resolve if no longer reported. 0 = off" disabled={ro} onChange={(v) => set({ staleMinutes: v })} />
            <Num label="Reopen window (min)" value={p.reopenWindowMinutes} hint="Re-raise reopens the same alert" disabled={ro} onChange={(v) => set({ reopenWindowMinutes: v })} />
          </div>
        </Section>

        <Section title="Maintenance mute" description="Alerts are still recorded but no notifications are sent until the mute ends.">
          {muted ? (
            <div className="flex items-center gap-2 rounded-lg border border-violet/30 bg-violet-soft px-3 py-2 text-[13px]">
              <BellOff className="size-4 text-violet" /> Muted until {formatDateTime(p.mutedUntil)}
              {!ro && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => set({ mutedUntil: null, muteReason: null })}>Unmute</Button>}
            </div>
          ) : (
            !ro && (
              <div className="flex flex-wrap gap-1.5">
                {[1, 4, 24, 72].map((h) => (
                  <Button key={h} size="sm" onClick={() => muteFor(h)}><Clock /> Mute {h < 24 ? `${h}h` : `${h / 24}d`}</Button>
                ))}
              </div>
            )
          )}
          <Field label="Reason">
            <Input value={p.muteReason ?? ''} disabled={ro} onChange={(e) => set({ muteReason: e.target.value })} placeholder="e.g. Kafka upgrade CHG-1234" />
          </Field>
        </Section>
        {p.updatedBy && <p className="text-xs text-subtle">Last changed by {p.updatedBy} · {formatDateTime(p.updatedAt)}</p>}
      </div>
    </Sheet>
  )
}

function ChannelToggle({ icon: Icon, label, checked, onChange, disabled }: { icon: typeof Mail; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-default', checked ? 'border-accent bg-accent-soft' : 'border-border hover:bg-hover')}
    >
      <Icon className="size-4" />
      <span className="flex-1 text-[13px] font-medium">{label}</span>
      {checked ? <CheckCircle2 className="size-4 text-accent" /> : <XCircle className="size-4 text-subtle" />}
    </button>
  )
}
