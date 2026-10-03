import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PAGE_ICONS } from '@/components/layout/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/input'
import type { InventoryPage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { COLUMN_TYPES, inventoryApi, useInventoryMutation, type ColumnInput, type PageInput } from './api'
import { ColumnFields, emptyColumn } from './ColumnEditor'

const TEMPLATES: { name: string; icon: string; group: string; columns: ColumnInput[] }[] = [
  { name: 'Blank', icon: 'database', group: 'Inventory', columns: [{ label: 'Name', type: 'TEXT', required: true }] },
  {
    name: 'Certificates',
    icon: 'file-key',
    group: 'Security',
    columns: [
      { label: 'Common name', type: 'TEXT', required: true },
      { label: 'Issuer', type: 'TEXT' },
      { label: 'Hosts', type: 'LIST' },
      { label: 'Expires on', type: 'DATE', required: true, expiryTracking: true },
      { label: 'Owner', type: 'EMAIL' },
    ],
  },
  {
    name: 'Databases',
    icon: 'hard-drive',
    group: 'Infrastructure',
    columns: [
      { label: 'Name', type: 'TEXT', required: true },
      { label: 'Engine', type: 'SELECT', options: { choices: ['PostgreSQL', 'SQL Server', 'Cosmos DB', 'Redis'].map((value) => ({ value })) } },
      { label: 'Host', type: 'TEXT' },
      { label: 'Environment', type: 'SELECT', options: { choices: ['dev', 'qa', 'uat', 'prod'].map((value) => ({ value })) } },
      { label: 'Backups enabled', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Licenses',
    icon: 'shield',
    group: 'Software',
    columns: [
      { label: 'Product', type: 'TEXT', required: true },
      { label: 'Vendor', type: 'TEXT' },
      { label: 'Seats', type: 'NUMBER' },
      { label: 'Renewal date', type: 'DATE', expiryTracking: true },
    ],
  },
]

/** Create a page (with starter columns) or edit page metadata. */
export function PageDialog({ open, onOpenChange, page }: { open: boolean; onOpenChange: (o: boolean) => void; page?: InventoryPage | null }) {
  const navigate = useNavigate()
  const editing = !!page
  const [form, setForm] = useState<PageInput>({ name: '', icon: 'database', group: 'Inventory', description: '' })
  const [columns, setColumns] = useState<ColumnInput[]>(TEMPLATES[0]!.columns)
  const [editingCol, setEditingCol] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setEditingCol(null)
    if (page) {
      setForm({ name: page.name, icon: page.icon, group: page.group, description: page.description })
    } else {
      setForm({ name: '', icon: 'database', group: 'Inventory', description: '' })
      setColumns(TEMPLATES[0]!.columns)
    }
  }, [open, page])

  const create = useInventoryMutation((input: PageInput) => inventoryApi.createPage(input), 'Page created')
  const update = useInventoryMutation((input: PageInput) => inventoryApi.updatePage(page!.slug, input), 'Page updated')

  const submit = () => {
    if (editing) {
      update.mutate(form, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(
        { ...form, columns },
        {
          onSuccess: (created) => {
            onOpenChange(false)
            navigate(`/inventory/${created.slug}`)
          },
        },
      )
    }
  }

  const colEditor = editingCol !== null && columns[editingCol]

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit page' : 'New inventory page'}
      description={editing ? 'Rename the page or change its icon and group.' : 'Pages are fully customizable. Columns can be changed at any time.'}
      className="w-[min(680px,calc(100vw-32px))]"
      footer={
        colEditor ? (
          <Button variant="primary" disabled={!columns[editingCol!]?.label.trim()} onClick={() => setEditingCol(null)}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!form.name.trim() || (!editing && columns.length === 0)} loading={create.isPending || update.isPending} onClick={submit}>
              {editing ? 'Save' : 'Create page'}
            </Button>
          </>
        )
      }
    >
      {colEditor ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setEditingCol(null)} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> Back to page
          </button>
          <ColumnFields value={columns[editingCol!]!} onChange={(v) => setColumns((cs) => cs.map((c, i) => (i === editingCol ? v : c)))} />
        </div>
      ) : (
        <div className="space-y-5">
          {!editing && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Start from</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TEMPLATES.map((t) => {
                  const Icon = PAGE_ICONS[t.icon]!
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        setColumns(t.columns)
                        setForm((f) => ({ ...f, icon: t.icon, group: t.group, name: t.name === 'Blank' ? f.name : t.name }))
                      }}
                      className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:border-border-strong hover:bg-hover"
                    >
                      <Icon className="size-4 text-accent" />
                      <span className="text-[13px] font-medium">{t.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Load balancers" />
            </Field>
            <Field label="Group" hint="Groups pages in overviews">
              <Input value={form.group ?? ''} onChange={(e) => setForm({ ...form, group: e.target.value })} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea className="min-h-14" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PAGE_ICONS).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => setForm({ ...form, icon: name })}
                  className={cn(
                    'grid size-8.5 place-items-center rounded-lg border transition-colors',
                    form.icon === name ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:bg-hover hover:text-fg',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </Field>
          {!editing && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted">Columns</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setColumns((cs) => [...cs, emptyColumn()])
                    setEditingCol(columns.length)
                  }}
                >
                  <Plus /> Add column
                </Button>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {columns.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditingCol(i)}>
                      <p className="truncate text-[13px] font-medium">
                        {c.label || <span className="text-subtle">Untitled</span>}
                        {c.required && <span className="ml-0.5 text-danger">*</span>}
                      </p>
                    </button>
                    <Badge tone="neutral">{COLUMN_TYPES.find((t) => t.value === c.type)?.label}</Badge>
                    {c.expiryTracking && <Badge tone="warning">expiry</Badge>}
                    <button
                      type="button"
                      onClick={() => setColumns((cs) => cs.filter((_, idx) => idx !== i))}
                      disabled={columns.length === 1}
                      className="rounded p-1 text-muted hover:text-danger disabled:opacity-30"
                      aria-label="Remove column"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
