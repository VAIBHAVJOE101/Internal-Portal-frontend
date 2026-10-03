import { AlertOctagon, AlertTriangle, BellOff, Hourglass, Info, ShieldCheck, Siren, TimerReset } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AlertItem } from '@/lib/types'

export function SeverityIcon({ severity, className = 'size-4' }: { severity: string; className?: string }) {
  if (severity === 'CRITICAL') return <AlertOctagon className={`${className} text-danger`} />
  if (severity === 'WARNING') return <AlertTriangle className={`${className} text-warning`} />
  return <Info className={`${className} text-info`} />
}

export function severityTone(severity: string) {
  return severity === 'CRITICAL' ? 'danger' : severity === 'WARNING' ? 'warning' : 'info'
}

/** Status with lifecycle hints (pending, firing, acknowledged, snoozed, recovering, resolved). */
export function AlertStatusBadges({ alert }: { alert: AlertItem }) {
  const snoozed = alert.snoozedUntil && new Date(alert.snoozedUntil) > new Date()
  return (
    <span className="flex flex-wrap items-center gap-1">
      {alert.status === 'PENDING' && (
        <Badge tone="neutral"><Hourglass className="size-3" /> pending</Badge>
      )}
      {alert.status === 'OPEN' && (
        <Badge tone={severityTone(alert.severity)} dot pulse>firing</Badge>
      )}
      {alert.status === 'ACKNOWLEDGED' && <Badge tone="info"><ShieldCheck className="size-3" /> acknowledged</Badge>}
      {alert.status === 'RESOLVED' && <Badge tone="success" dot>resolved</Badge>}
      {snoozed && alert.status !== 'RESOLVED' && <Badge tone="violet"><BellOff className="size-3" /> snoozed</Badge>}
      {alert.clearedSince && alert.status !== 'RESOLVED' && <Badge tone="success"><TimerReset className="size-3" /> recovering</Badge>}
      {alert.escalationLevel > 0 && alert.status !== 'RESOLVED' && (
        <Badge tone="danger"><Siren className="size-3" /> L{alert.escalationLevel}</Badge>
      )}
    </span>
  )
}

export const SNOOZE_OPTIONS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '24 hours', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
]

export function humanSeconds(s: number) {
  if (s <= 0) return 'immediately'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)} min`
  if (s < 86400) return `${+(s / 3600).toFixed(1)} h`
  return `${+(s / 86400).toFixed(1)} d`
}

export function humanMinutes(m: number) {
  return humanSeconds(m * 60)
}
