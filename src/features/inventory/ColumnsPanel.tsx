import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Lock, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Sheet } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/misc'
import { useAuth } from '@/lib/auth'
import type { InventoryColumn, InventoryPage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { COLUMN_TYPES, inventoryApi, useInventoryMutation, useSaveViewPref, type ColumnInput } from './api'
import { ColumnDialog } from './ColumnEditor'

/**
 * Customize columns: everyone can show/hide columns for their own view (saved per user);
 * admins can also add, edit, delete and drag-reorder the page schema.
 */
export function ColumnsPanel({
  page,
  hidden,
  open,
  onOpenChange,
}: {
  page: InventoryPage
  hidden: Set<string>
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const savePref = useSaveViewPref(page.slug)
  const [order, setOrder] = useState<InventoryColumn[]>(page.columns)
  const [editing, setEditing] = useState<InventoryColumn | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  useEffect(() => setOrder(page.columns), [page.columns])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const reorder = useInventoryMutation((keys: string[]) => inventoryApi.reorderColumns(page.slug, keys), 'Column order saved')
  const addCol = useInventoryMutation((input: ColumnInput) => inventoryApi.addColumn(page.slug, input), 'Column added')
  const updateCol = useInventoryMutation(
    ({ key, input }: { key: string; input: ColumnInput }) => inventoryApi.updateColumn(page.slug, key, input),
    'Column updated',
  )
  const deleteCol = useInventoryMutation((key: string) => inventoryApi.deleteColumn(page.slug, key), 'Column deleted')

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = order.findIndex((c) => c.key === e.active.id)
    const to = order.findIndex((c) => c.key === e.over!.id)
    const next = arrayMove(order, from, to)
    setOrder(next)
    reorder.mutate(next.map((c) => c.key))
  }

  const toggleHidden = (key: string) => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    savePref.mutate({ hidden: [...next] })
  }

  const onDelete = async (c: InventoryColumn) => {
    const ok = await confirm({
      title: `Delete column "${c.label}"?`,
      description: 'The column and its value in every record of this page will be removed. This cannot be undone.',
      confirmText: 'Delete column',
      danger: true,
      typeToConfirm: c.key,
    })
    if (ok) deleteCol.mutate(c.key)
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="Customize columns"
        description={isAdmin ? 'Drag to reorder for everyone. The eye toggles columns in your own view only.' : 'Choose which columns appear in your view.'}
        footer={
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => savePref.mutate({ hidden: [] })}>
              <RotateCcw /> Reset my view
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
              >
                <Plus /> Add column
              </Button>
            )}
          </>
        }
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((c) => c.key)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {order.map((c) => (
                <SortableColumn
                  key={c.key}
                  column={c}
                  draggable={isAdmin}
                  isHidden={hidden.has(c.key)}
                  onToggle={() => toggleHidden(c.key)}
                  onEdit={
                    isAdmin
                      ? () => {
                          setEditing(c)
                          setDialogOpen(true)
                        }
                      : undefined
                  }
                  onDelete={isAdmin && !c.locked ? () => onDelete(c) : undefined}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {page.system && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card-2/50 p-3 text-xs text-muted">
            <Lock className="mt-px size-3.5 shrink-0" />
            This is a system page used by other modules. Core columns are locked, but you can add your own columns.
          </p>
        )}
      </Sheet>
      <ColumnDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        column={editing}
        slug={page.slug}
        saving={addCol.isPending || updateCol.isPending}
        onSave={(input) => {
          const done = { onSuccess: () => setDialogOpen(false) }
          if (editing) updateCol.mutate({ key: editing.key, input }, done)
          else addCol.mutate(input, done)
        }}
      />
    </>
  )
}

function SortableColumn({
  column,
  draggable,
  isHidden,
  onToggle,
  onEdit,
  onDelete,
}: {
  column: InventoryColumn
  draggable: boolean
  isHidden: boolean
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.key, disabled: !draggable })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2',
        isDragging && 'z-10 border-accent shadow-xl',
        isHidden && 'opacity-55',
      )}
    >
      {draggable ? (
        <button type="button" {...attributes} {...listeners} className="cursor-grab rounded p-1 text-subtle hover:text-fg active:cursor-grabbing" aria-label="Drag to reorder">
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
          {column.label}
          {column.locked && <Lock className="size-3 text-subtle" />}
          {column.required && <span className="text-danger">*</span>}
        </p>
        <p className="truncate font-mono text-[11px] text-subtle">{column.key}</p>
      </div>
      <Badge tone="neutral">{COLUMN_TYPES.find((t) => t.value === column.type)?.label ?? column.type}</Badge>
      {column.expiryTracking && <Badge tone="warning">expiry</Badge>}
      <Tooltip content={isHidden ? 'Show in my view' : 'Hide from my view'}>
        <button type="button" onClick={onToggle} className="rounded p-1.5 text-muted hover:bg-hover hover:text-fg">
          {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </Tooltip>
      {onEdit && (
        <Tooltip content="Edit column">
          <button type="button" onClick={onEdit} className="rounded p-1.5 text-muted hover:bg-hover hover:text-fg">
            <Pencil className="size-3.5" />
          </button>
        </Tooltip>
      )}
      {onDelete ? (
        <Tooltip content="Delete column">
          <button type="button" onClick={onDelete} className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger">
            <Trash2 className="size-3.5" />
          </button>
        </Tooltip>
      ) : (
        onEdit && <span className="w-[26px]" />
      )}
    </li>
  )
}
