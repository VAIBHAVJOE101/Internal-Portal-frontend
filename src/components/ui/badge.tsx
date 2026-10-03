import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-card-2 text-muted border-border',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  violet: 'bg-violet-soft text-violet border-transparent',
}

const dots: Record<Tone, string> = {
  neutral: 'bg-subtle',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  violet: 'bg-violet',
}

export function Badge({
  tone = 'neutral',
  dot,
  pulse,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean; pulse?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1.5 rounded-md border px-1.5 text-[11.5px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', dots[tone])} />}
          <span className={cn('relative inline-flex size-1.5 rounded-full', dots[tone])} />
        </span>
      )}
      {children}
    </span>
  )
}

const statusTone: Record<string, Tone> = {
  HEALTHY: 'success',
  RUNNING: 'success',
  UP: 'success',
  SUCCESS: 'success',
  ACTIVE: 'success',
  STABLE: 'success',
  COMPLETED: 'success',
  RESOLVED: 'success',
  DEGRADED: 'warning',
  PAUSED: 'warning',
  WARNING: 'warning',
  ACKNOWLEDGED: 'info',
  REBALANCING: 'info',
  PREPARINGREBALANCE: 'info',
  COMPLETINGREBALANCE: 'info',
  IN_PROGRESS: 'info',
  QUEUED: 'info',
  PENDING: 'info',
  INFO: 'info',
  RESTARTING: 'info',
  UNASSIGNED: 'neutral',
  EMPTY: 'neutral',
  UNKNOWN: 'neutral',
  CANCELLED: 'neutral',
  SKIPPED: 'neutral',
  STOPPED: 'neutral',
  DOWN: 'danger',
  FAILED: 'danger',
  FAILURE: 'danger',
  UNREACHABLE: 'danger',
  CRITICAL: 'danger',
  OPEN: 'danger',
  DEAD: 'danger',
}

export function toneFor(status?: string | null): Tone {
  if (!status) return 'neutral'
  return statusTone[status.toUpperCase()] ?? 'neutral'
}

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const tone = toneFor(status)
  const label = (status ?? 'unknown').replace(/_/g, ' ').toLowerCase()
  return (
    <Badge tone={tone} dot pulse={tone === 'danger' || status === 'in_progress'} className={cn('capitalize', className)}>
      {label}
    </Badge>
  )
}
