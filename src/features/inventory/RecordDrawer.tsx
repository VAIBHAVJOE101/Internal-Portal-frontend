import { Lock, Trash2, X } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Sheet } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/lib/auth'
import type { InventoryColumn, InventoryPage, InventoryRecord } from '@/lib/types'
import { cn, formatDateTime } from '@/lib/utils'
import { inventoryApi, useInventoryMutation } from './api'
import { recordTitle, useReferenceTitles } from './CellValue'

type FormValues = Record<string, unknown>

/** Create / edit form generated from the page's column schema. */
export function RecordDrawer({
  page,
  record,
  open,
  onOpenChange,
}: {
  page: InventoryPage
  record: InventoryRecord | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const [values, setValues] = useState<FormValues>({})

  useEffect(() => {
    if (open) setValues(record ? { ...record.data } : defaults(page.columns))
  }, [open, record, page.columns])

  const save = useInventoryMutation(
    (data: FormValues) => (record ? inventoryApi.updateRecord(page.slug, record.id, data) : inventoryApi.createRecord(page.slug, data)),
    record ? 'Record updated' : 'Record created',
  )
  const remove = useInventoryMutation((id: number) => inventoryApi.deleteRecords(page.slug, [id]), 'Record deleted')

  const submit = () => save.mutate(values, { onSuccess: () => onOpenChange(false) })

  const onDelete = async () => {
    if (!record) return
    const ok = await confirm({
      title: 'Delete record?',
      description: `"${recordTitle(page, record)}" will be permanently removed from ${page.name}.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (ok) remove.mutate(record.id, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={record ? recordTitle(page, record) : `New ${singular(page.name)}`}
      description={record ? `${page.name} · updated ${formatDateTime(record.updatedAt)} by ${record.updatedBy}` : page.description}
      footer={
        isAdmin ? (
          <>
            {record && (
              <Button variant="danger-ghost" className="mr-auto" onClick={onDelete} loading={remove.isPending}>
                <Trash2 /> Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={save.isPending}>
              {record ? 'Save changes' : 'Create'}
            </Button>
          </>
        ) : (
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        )
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {page.columns.map((c) => (
          <Field
            key={c.key}
            required={c.required}
            label={
              <span className="inline-flex items-center gap-1.5">
                {c.label}
                {c.locked && <Lock className="size-3 text-subtle" />}
              </span>
            }
            hint={c.description ?? undefined}
          >
            <ValueInput column={c} value={values[c.key]} disabled={!isAdmin} onChange={(v) => setValues((s) => ({ ...s, [c.key]: v }))} />
          </Field>
        ))}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}

function defaults(columns: InventoryColumn[]): FormValues {
  const v: FormValues = {}
  for (const c of columns) if (c.type === 'BOOLEAN') v[c.key] = c.key === 'enabled'
  return v
}

function singular(name: string) {
  return name.endsWith('ies') ? name.slice(0, -3) + 'y' : name.endsWith('ses') ? name.slice(0, -2) : name.replace(/s$/, '')
}

export function ValueInput({
  column,
  value,
  onChange,
  disabled,
}: {
  column: InventoryColumn
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}) {
  const str = value === null || value === undefined ? '' : String(value)
  const choices = column.options?.choices ?? []
  switch (column.type) {
    case 'LONGTEXT':
      return <Textarea value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    case 'NUMBER':
      return <Input type="number" step="any" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    case 'DATE':
      return <Input type="date" value={str.slice(0, 10)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    case 'DATETIME':
      return (
        <Input
          type="datetime-local"
          value={str ? toLocalInput(str) : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
        />
      )
    case 'BOOLEAN':
      return (
        <div className="flex h-8.5 items-center">
          <Switch checked={!!value} disabled={disabled} onCheckedChange={onChange} />
        </div>
      )
    case 'SELECT':
      return (
        <Select value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value}
            </option>
          ))}
        </Select>
      )
    case 'MULTISELECT': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((c) => {
            const on = selected.includes(c.value)
            return (
              <button
                key={c.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(on ? selected.filter((s) => s !== c.value) : [...selected, c.value])}
                className={cn(
                  'h-7 rounded-md border px-2.5 text-xs transition-colors',
                  on ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:bg-hover',
                )}
              >
                {c.value}
              </button>
            )
          })}
          {choices.length === 0 && <span className="text-xs text-subtle">No options defined for this column.</span>}
        </div>
      )
    }
    case 'LIST':
      return <ListInput value={Array.isArray(value) ? (value as string[]) : str ? [str] : []} disabled={disabled} onChange={onChange} mono={column.key !== 'tags'} />
    case 'REFERENCE':
      return <ReferenceInput refPage={column.options?.refPage} value={str} disabled={disabled} onChange={onChange} />
    case 'URL':
      return <Input type="url" placeholder="https://" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    case 'EMAIL':
      return <Input type="email" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    case 'IP':
      return <Input placeholder="10.0.0.1 or 10.0.0.0/24" className="font-mono" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    default:
      return <Input value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  }
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

/** Chip input: Enter / comma adds a value, paste of a comma list adds several. */
function ListInput({ value, onChange, disabled, mono }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; mono?: boolean }) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  return (
    <div className={cn('flex min-h-8.5 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg/60 px-2 py-1.5 focus-within:border-accent', disabled && 'opacity-60')}>
      {value.map((v) => (
        <span key={v} className={cn('inline-flex items-center gap-1 rounded-md bg-card-2 px-1.5 py-0.5 text-xs', mono && 'font-mono')}>
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
          onKeyDown={onKey}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : 'Type and press Enter'}
          className={cn('min-w-24 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle', mono && 'font-mono')}
        />
      )}
    </div>
  )
}

function ReferenceInput({ refPage, value, onChange, disabled }: { refPage?: string; value: string; onChange: (v: unknown) => void; disabled?: boolean }) {
  const { data } = useReferenceTitles(refPage)
  if (!refPage) return <Input value={value} disabled placeholder="Column has no referenced page configured" />
  return (
    <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
      <option value="">—</option>
      {[...(data?.entries() ?? [])].map(([id, title]) => (
        <option key={id} value={id}>
          {title}
        </option>
      ))}
    </Select>
  )
}
