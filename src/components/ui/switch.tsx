import { Switch as RadixSwitch } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-card-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <RadixSwitch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-muted shadow transition-transform data-[state=checked]:translate-x-4.5 data-[state=checked]:bg-white" />
    </RadixSwitch.Root>
  )
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (v: boolean) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className={cn('size-3.5 cursor-pointer rounded accent-[var(--accent)]', className)}
    />
  )
}
