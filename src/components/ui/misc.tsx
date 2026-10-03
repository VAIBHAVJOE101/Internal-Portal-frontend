import { AlertCircle, Inbox, type LucideIcon } from 'lucide-react'
import { DropdownMenu, Tabs as RadixTabs, Tooltip as RadixTooltip } from 'radix-ui'
import type { ComponentType, ReactNode } from 'react'
import { errorMessage } from '@/lib/api'
import { cn, hue, initials } from '@/lib/utils'
import { Button } from './button'

// ---------------------------------------------------------------- feedback states

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-card-2', className)} />
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      <div className="mb-1 grid size-10 place-items-center rounded-xl border border-border bg-card-2">
        <Icon className="size-5 text-muted" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      <div className="mb-1 grid size-10 place-items-center rounded-xl bg-danger-soft">
        <AlertCircle className="size-5 text-danger" />
      </div>
      <p className="text-sm font-medium">Couldn&apos;t load this</p>
      <p className="max-w-md text-[13px] text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button size="sm" className="mt-2" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- tabs

export function Tabs({
  value,
  onValueChange,
  items,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  items: { value: string; label: ReactNode; icon?: LucideIcon; count?: number | null }[]
  className?: string
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List className={cn('flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none]', className)}>
        {items.map(({ value: v, label, icon: Icon, count }) => (
          <RadixTabs.Trigger
            key={v}
            value={v}
            className="-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
          >
            {Icon && <Icon className="size-3.5" />}
            {label}
            {count !== undefined && count !== null && (
              <span className="rounded-md bg-card-2 px-1.5 text-[11px] text-muted tabular">{count}</span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-border bg-bg/60 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded-md px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg',
            value === o.value && 'bg-card-2 text-fg shadow-sm ring-1 ring-border',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- tooltip & menu

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RadixTooltip.Root delayDuration={250}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-xs rounded-md border border-border bg-card-2 px-2 py-1 text-xs text-fg shadow-lg data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

export interface MenuItem {
  label: ReactNode
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

export function Menu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: MenuItem[]; align?: 'start' | 'end' }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-[60] min-w-44 rounded-xl border border-border bg-card p-1 shadow-2xl data-[state=open]:animate-fade-in"
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.separatorBefore && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
              <DropdownMenu.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover',
                  item.danger ? 'text-danger' : 'text-fg',
                )}
              >
                {item.icon && <item.icon className="size-3.5" />}
                {item.label}
              </DropdownMenu.Item>
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ---------------------------------------------------------------- avatar & meters

export function Avatar({ name, src, size = 24, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className={cn('shrink-0 rounded-full object-cover ring-1 ring-border', className)} />
  }
  const h = hue(name)
  return (
    <span
      title={name}
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-1 ring-black/10', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${h} 65% 50%), hsl(${(h + 40) % 360} 70% 42%))` }}
    >
      {initials(name)}
    </span>
  )
}

/** Thin labelled progress bar, as used in the reference "health" card. */
export function Meter({
  label,
  value,
  max = 100,
  display,
  tone = 'accent',
}: {
  label: ReactNode
  value: number
  max?: number
  display?: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'violet'
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  const colors = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    violet: 'bg-violet',
  }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-fg">{label}</span>
        <span className="text-muted tabular">{display ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
        <div className={cn('h-full rounded-full transition-[width] duration-700', colors[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-card-2 px-1.5 py-px font-mono text-[10.5px] text-muted">{children}</kbd>
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12.5px]', className)}>{children}</span>
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <pre className={cn('overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-[12px] leading-relaxed text-fg', className)}>
      {text}
    </pre>
  )
}
