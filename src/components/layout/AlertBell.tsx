import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge, toneFor } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/misc'
import { get } from '@/lib/api'
import type { AlertItem, AlertSummary, PageResult } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

/**
 * Live alert bell: subscribes to the backend SSE stream, refreshes alert queries on every event
 * and toasts newly opened CRITICAL alerts.
 */
export function AlertBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState(false)
  const { data: summary } = useQuery({ queryKey: ['alerts', 'summary'], queryFn: () => get<AlertSummary>('/alerts/summary') })
  const { data: latest } = useQuery({
    queryKey: ['alerts', 'bell'],
    queryFn: () => get<PageResult<AlertItem>>('/alerts', { status: 'ACTIVE', size: 8 }),
    enabled: open,
  })

  useEffect(() => {
    let source: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      source = new EventSource('/api/alerts/stream', { withCredentials: true })
      source.addEventListener('hello', () => setLive(true))
      source.addEventListener('alert', (e) => {
        const alert = JSON.parse((e as MessageEvent).data) as AlertItem
        qc.invalidateQueries({ queryKey: ['alerts'] })
        if (alert.status === 'OPEN' && alert.occurrences === 1 && alert.severity === 'CRITICAL') {
          toast.error(alert.title, { description: alert.resource })
        }
      })
      source.onerror = () => {
        setLive(false)
        source?.close()
        retry = setTimeout(connect, 10_000)
      }
    }
    connect()
    return () => {
      source?.close()
      if (retry) clearTimeout(retry)
    }
  }, [qc])

  const active = summary?.active ?? 0
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Alerts"
          className="relative grid size-8.5 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Bell className="size-4.5" />
          {active > 0 && (
            <span
              className={cn(
                'absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9.5px] font-bold text-white ring-2 ring-panel',
                summary?.critical ? 'bg-danger' : 'bg-warning',
              )}
            >
              {active > 99 ? '99+' : active}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-[60] w-[380px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Active alerts</p>
              <span className={cn('size-1.5 rounded-full', live ? 'bg-success' : 'bg-subtle')} title={live ? 'Live' : 'Reconnecting'} />
            </div>
            <div className="flex gap-1.5">
              {!!summary?.critical && <Badge tone="danger">{summary.critical} critical</Badge>}
              {!!summary?.warning && <Badge tone="warning">{summary.warning} warning</Badge>}
            </div>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {latest?.items.length === 0 && <EmptyState icon={CheckCheck} title="All clear" description="No active alerts right now." />}
            {latest?.items.map((a) => (
              <Link
                key={a.id}
                to={`/alerts?focus=${a.id}`}
                onClick={() => setOpen(false)}
                className="flex gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-hover"
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    toneFor(a.severity) === 'danger' ? 'bg-danger' : toneFor(a.severity) === 'warning' ? 'bg-warning' : 'bg-info',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] leading-snug">{a.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {a.source.toLowerCase()} · {timeAgo(a.lastSeen)}
                    {a.occurrences > 1 && ` · ×${a.occurrences}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-accent hover:bg-hover"
          >
            View all alerts
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
