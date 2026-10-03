import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { Choice, ColumnType, InventoryColumn } from '@/lib/types'
import { cn } from '@/lib/utils'
import { COLUMN_TYPES, usePages, type ColumnInput } from './api'

const COLORS = ['accent', 'violet', 'info', 'success', 'warning', 'danger'] as const
const colorClass: Record<string, string> = {
  accent: 'bg-accent',
  violet: 'bg-violet',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export function emptyColumn(): ColumnInput {
  return { label: '', type: 'TEXT', required: false, visible: true, expiryTracking: false }
}

/** Form body for a column definition; reused by the page wizard and the column dialog. */
export function ColumnFields({
  value,
  onChange,
  locked,
  currentSlug,
}: {
  value: ColumnInput
  onChange: (v: ColumnInput) => void
  locked?: boolean
  currentSlug?: string
}) {
  const { data: pages } = usePages()
  const set = (patch: Partial<ColumnInput>) => onChange({ ...value, ...patch })
  const choices = value.options?.choices ?? []
  const [draft, setDraft] = useState('')

  const addChoice = () => {
    const v = draft.trim()
    if (!v || choices.some((c) => c.value === v)) return
    set({ options: { ...value.options, choices: [...choices, { value: v, color: COLORS[choices.length % COLORS.length] }] } })
    setDraft('')
  }
  const updateChoice = (i: number, patch: Partial<Choice>) =>
    set({ options: { ...value.options, choices: choices.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) } })

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Label" required>
          <Input autoFocus value={value.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Expiry date" />
        </Field>
        <Field label="Type" hint={locked ? 'Core column – type is fixed' : COLUMN_TYPES.find((t) => t.value === value.type)?.hint}>
          <Select value={value.type} disabled={locked} onChange={(e) => set({ type: e.target.value as ColumnType })}>
            {COLUMN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {(value.type === 'SELECT' || value.type === 'MULTISELECT') && (
        <Field label="Options">
          <div className="space-y-2 rounded-lg border border-border bg-card-2/40 p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {choices.map((c, i) => (
                <span key={c.value} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
                  <button
                    type="button"
                    title="Change color"
                    onClick={() => updateChoice(i, { color: COLORS[(COLORS.indexOf((c.color ?? 'accent') as (typeof COLORS)[number]) + 1) % COLORS.length] })}
                    className={cn('size-2.5 rounded-full', colorClass[c.color ?? 'accent'] ?? 'bg-subtle')}
                  />
                  {c.value}
                  <button
                    type="button"
                    onClick={() => set({ options: { ...value.options, choices: choices.filter((_, idx) => idx !== i) } })}
                    className="text-muted hover:text-fg"
                    aria-label={`Remove ${c.value}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {choices.length === 0 && <span className="text-xs text-subtle">No options yet.</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={draft}
                placeholder="Add option and press Enter"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addChoice()
                  }
                }}
              />
              <Button type="button" onClick={addChoice}>
                <Plus /> Add
              </Button>
            </div>
          </div>
        </Field>
      )}

      {value.type === 'REFERENCE' && (
        <Field label="Referenced page" hint="Values pick a record from this page">
          <Select value={value.options?.refPage ?? ''} onChange={(e) => set({ options: { ...value.options, refPage: e.target.value || undefined } })}>
            <option value="">Choose a page…</option>
            {pages
              ?.filter((p) => p.slug !== currentSlug)
              .map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
      )}

      <Field label="Description" hint="Shown as help text in the record form">
        <Input value={value.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
      </Field>

      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleRow label="Required" description="Records must have a value" checked={!!value.required} disabled={locked} onChange={(v) => set({ required: v })} />
        <ToggleRow label="Visible by default" description="Shown in the table" checked={value.visible !== false} onChange={(v) => set({ visible: v })} />
        {(value.type === 'DATE' || value.type === 'DATETIME') && (
          <ToggleRow
            label="Track expiry"
            description="Alerts at 30 / 7 / 0 days"
            checked={!!value.expiryTracking}
            onChange={(v) => set({ expiryTracking: v })}
          />
        )}
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5', disabled && 'opacity-60')}>
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

export function ColumnDialog({
  open,
  onOpenChange,
  column,
  slug,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  column: InventoryColumn | null
  slug: string
  onSave: (input: ColumnInput) => void
  saving?: boolean
}) {
  const [value, setValue] = useState<ColumnInput>(emptyColumn())
  useEffect(() => {
    if (open) {
      setValue(
        column
          ? {
              label: column.label,
              type: column.type,
              required: column.required,
              visible: column.visible,
              options: column.options ?? undefined,
              expiryTracking: column.expiryTracking,
              description: column.description,
              width: column.width,
            }
          : emptyColumn(),
      )
    }
  }, [open, column])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={column ? `Edit column · ${column.label}` : 'Add column'}
      description={column ? <span className="font-mono text-xs">key: {column.key}</span> : 'Columns apply to every record on this page.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!value.label.trim()} loading={saving} onClick={() => onSave(value)}>
            {column ? 'Save column' : 'Add column'}
          </Button>
        </>
      }
    >
      <ColumnFields value={value} onChange={setValue} locked={column?.locked} currentSlug={slug} />
    </Dialog>
  )
}
