import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpCircle,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  CircleDot,
  Eye,
  Flame,
  Hourglass,
  Mail,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Siren,
  TimerReset,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Menu, Skeleton } from '@/components/ui/misc'
import { del, errorMessage, get, post } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AlertEventItem, AlertItem } from '@/lib/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import { AlertStatusBadges, SNOOZE_OPTIONS, severityTone } from './shared'

const EVENT_STYLE: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  RAISED: { icon: CircleDot, color: 'text-muted', label: 'Condition detected' },
  FIRED: { icon: Flame, color: 'text-danger', label: 'Fired' },
  REOPENED: { icon: RotateCcw, color: 'text-warning', label: 'Reopened' },
  SEVERITY_CHANGED: { icon: ArrowUpCircle, color: 'text-warning', label: 'Severity changed' },
  CONDITION_CLEARED: { icon: TimerReset, color: 'text-success', label: 'Condition cleared' },
  CONDITION_RETURNED: { icon: Hourglass, color: 'text-warning', label: 'Condition returned' },
  NOTIFIED: { icon: BellRing, color: 'text-accent', label: 'Notification sent' },
  NOTIFY_FAILED: { icon: XCircle, color: 'text-danger', label: 'Notification failed' },
  NOTIFY_SKIPPED: { icon: Bell, color: 'text-subtle', label: 'Notification skipped' },
  SUPPRESSED: { icon: BellOff, color: 'text-violet', label: 'Notification suppressed' },
  ESCALATED: { icon: Siren, color: 'text-danger', label: 'Escalated' },
  ACKNOWLEDGED: { icon: ShieldCheck, color: 'text-info', label: 'Acknowledged' },
  SNOOZED: { icon: BellOff, color: 'text-violet', label: 'Snoozed' },
  UNSNOOZED: { icon: Bell, color: 'text-violet', label: 'Snooze ended' },
  RESOLVED: { icon: CheckCheck, color: 'text-success', label: 'Resolved' },
}

export function useAlertActions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, op, minutes }: { id: number; op: 'ack' | 'resolve' | 'snooze' | 'unsnooze'; minutes?: number }) =>
      op === 'snooze'
        ? post<AlertItem>(`/alerts/${id}/snooze`, null, { minutes })
        : op === 'unsnooze'
          ? del<AlertItem>(`/alerts/${id}/snooze`)
          : post<AlertItem>(`/alerts/${id}/${op}`),
    onSuccess: (_, { op }) => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success({ ack: 'Alert acknowledged', resolve: 'Alert resolved', snooze: 'Alert snoozed', unsnooze: 'Snooze cancelled' }[op])
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function AlertDetailSheet({ alertId, onClose }: { alertId: number | null; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const act = useAlertActions()
  const alert = useQuery({ queryKey: ['alerts', 'one', alertId], queryFn: () => get<AlertItem>(`/alerts/${alertId}`), enabled: !!alertId })
  const events = useQuery({
    queryKey: ['alerts', 'events', alertId],
    queryFn: () => get<AlertEventItem[]>(`/alerts/${alertId}/events`),
    enabled: !!alertId,
    refetchInterval: 15_000,
  })
  const a = alert.data
  const snoozed = a?.snoozedUntil && new Date(a.snoozedUntil) > new Date()
  const notifications = events.data?.filter((e) => e.kind === 'NOTIFIED').length ?? 0

  return (
    <Sheet
      open={!!alertId}
      onOpenChange={(o) => !o && onClose()}
      title={a?.title ?? 'Alert'}
      description={a && `${a.typeLabel ?? a.source.toLowerCase()} · ${a.resource ?? ''}`}
      className="w-[min(640px,100vw)]"
      footer={
        isAdmin && a && a.status !== 'RESOLVED' ? (
          <>
            {snoozed ? (
              <Button variant="ghost" className="mr-auto" onClick={() => act.mutate({ id: a.id, op: 'unsnooze' })}>
                <Bell /> Cancel snooze
              </Button>
            ) : (
              <Menu
                trigger={<Button variant="ghost" className="mr-auto"><BellOff /> Snooze</Button>}
                align="start"
                items={SNOOZE_OPTIONS.map((o) => ({ label: o.label, onSelect: () => act.mutate({ id: a.id, op: 'snooze', minutes: o.minutes }) }))}
              />
            )}
            {a.status === 'OPEN' && (
              <Button onClick={() => act.mutate({ id: a.id, op: 'ack' })}>
                <Eye /> Acknowledge
              </Button>
            )}
            <Button variant="primary" onClick={() => act.mutate({ id: a.id, op: 'resolve' }, { onSuccess: onClose })}>
              <CheckCheck /> Resolve
            </Button>
          </>
        ) : undefined
      }
    >
      {!a ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="space-y-5 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
            <AlertStatusBadges alert={a} />
            {a.reopenCount > 0 && <Badge tone="warning">reopened ×{a.reopenCount}</Badge>}
          </div>
          {a.message && <pre className="rounded-xl border border-border bg-bg p-3 font-mono text-[12px] whitespace-pre-wrap">{a.message}</pre>}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Occurrences" value={a.occurrences} />
            <Stat label="Notifications" value={a.notificationCount} hint={notifications ? `${notifications} delivered` : undefined} />
            <Stat label="Escalation" value={a.escalationLevel ? `Level ${a.escalationLevel}` : '—'} />
            <Stat
              label={a.status === 'OPEN' ? 'Next reminder' : 'Last notified'}
              value={a.status === 'OPEN' && a.nextNotifyAt && !snoozed ? timeAgo(a.nextNotifyAt) : a.lastNotifiedAt ? timeAgo(a.lastNotifiedAt) : '—'}
            />
          </div>

          <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
            <Row label="First detected" value={formatDateTime(a.firstSeen)} />
            {a.firedAt && <Row label="Fired" value={formatDateTime(a.firedAt)} />}
            <Row label="Last detected" value={`${formatDateTime(a.lastSeen)} (${timeAgo(a.lastSeen)})`} />
            {a.clearedSince && <Row label="Clear since" value={formatDateTime(a.clearedSince)} />}
            {a.acknowledgedBy && <Row label="Acknowledged" value={`${a.acknowledgedBy} · ${formatDateTime(a.acknowledgedAt)}`} />}
            {snoozed && <Row label="Snoozed until" value={`${formatDateTime(a.snoozedUntil)} by ${a.snoozedBy}`} />}
            {a.resolvedAt && <Row label="Resolved" value={`${formatDateTime(a.resolvedAt)} – ${a.resolvedReason ?? ''}`} />}
          </dl>

          <div>
            <p className="mb-3 text-xs font-medium text-muted">Timeline</p>
            {events.isLoading && <Skeleton className="h-40" />}
            <ol className="relative space-y-0">
              {events.data?.map((e, i) => {
                const s = EVENT_STYLE[e.kind] ?? { icon: CircleDot, color: 'text-muted', label: e.kind }
                const Icon = e.channel === 'email' ? Mail : e.channel?.startsWith('teams') ? MessageSquare : s.icon
                return (
                  <li key={e.id} className="relative flex gap-3 pb-4">
                    {i < (events.data?.length ?? 0) - 1 && <span className="absolute top-6 bottom-0 left-[11px] w-px bg-border" />}
                    <span className={cn('relative z-10 grid size-6 shrink-0 place-items-center rounded-full border border-border bg-card', s.color)}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{s.label}</span>
                        {e.channel && <span className="text-xs text-muted">{e.channel}</span>}
                        <span className="text-xs text-subtle" title={formatDateTime(e.ts)}>{timeAgo(e.ts)}</span>
                        {e.actor && <span className="text-xs text-subtle">by {e.actor}</span>}
                      </p>
                      {e.message && <p className={cn('mt-0.5 text-xs break-words', e.kind === 'NOTIFY_FAILED' ? 'text-danger' : 'text-muted')}>{e.message}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-[15px] font-semibold tabular">{value}</p>
      {hint && <p className="text-[10.5px] text-subtle">{hint}</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </>
  )
}
