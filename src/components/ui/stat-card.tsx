import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { Skeleton } from './misc'

const toneText = {
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  violet: 'text-violet',
  neutral: 'text-muted',
}
const toneBg = {
  accent: 'bg-accent-soft',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  info: 'bg-info-soft',
  violet: 'bg-violet-soft',
  neutral: 'bg-card-2',
}
const toneVar = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  violet: 'var(--violet)',
  neutral: 'var(--muted)',
}

export type StatTone = keyof typeof toneText

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'accent',
  spark,
  loading,
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: StatTone
  spark?: number[]
  loading?: boolean
  onClick?: () => void
}) {
  const data = spark?.map((v, i) => ({ i, v }))
  const gradientId = `spark-${label.replace(/\W/g, '')}`
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden bg-card px-5 py-4 transition-colors',
        data && data.length > 1 && 'pb-10',
        onClick && 'cursor-pointer hover:bg-hover',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular">{value}</p>
          )}
          {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
        </div>
        <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg', toneBg[tone])}>
          <Icon className={cn('size-4.5', toneText[tone])} />
        </div>
      </div>
      {data && data.length > 1 && (
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-9 opacity-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={toneVar[tone]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={toneVar[tone]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={toneVar[tone]} strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/** Row of KPI tiles separated by hairlines, like the reference header strip. */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
