import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bug, CalendarRange, ClipboardCheck, Flag, Hourglass, ListTodo, MessageSquare, RefreshCw, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SearchInput, Select } from '@/components/ui/input'
import { Avatar, EmptyState, ErrorState, Skeleton, Tooltip } from '@/components/ui/misc'
import { Page, PageHeader } from '@/components/ui/page'
import { errorMessage, get, patch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Person, Sprint, WorkItem } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'
import { WorkItemSheet } from './WorkItemSheet'

const TYPE_STYLE: Record<string, { icon: typeof Bug; color: string; bar: string }> = {
  'User Story': { icon: ClipboardCheck, color: 'text-info', bar: 'bg-info' },
  'Product Backlog Item': { icon: ClipboardCheck, color: 'text-info', bar: 'bg-info' },
  Task: { icon: ListTodo, color: 'text-warning', bar: 'bg-warning' },
  Bug: { icon: Bug, color: 'text-danger', bar: 'bg-danger' },
}
const typeStyle = (t: string) => TYPE_STYLE[t] ?? { icon: ListTodo, color: 'text-violet', bar: 'bg-violet' }

const COLUMN_ACCENT: Record<string, string> = {
  New: 'bg-subtle',
  'To Do': 'bg-subtle',
  Active: 'bg-accent',
  'In Progress': 'bg-accent',
  Committed: 'bg-accent',
  Resolved: 'bg-violet',
  Closed: 'bg-success',
  Done: 'bg-success',
  Removed: 'bg-danger',
}

export default function BoardsPage() {
  useCrumbs([{ label: 'Azure Boards' }])
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [iterationId, setIterationId] = useState<string | undefined>()
  const [q, setQ] = useState('')
  const [assignee, setAssignee] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [selected, setSelected] = useState<WorkItem | null>(null)
  const [dragging, setDragging] = useState<WorkItem | null>(null)
  const key = ['boards', 'sprint', iterationId ?? 'current']
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => get<Sprint>('/boards/sprint', iterationId ? { iterationId } : undefined),
  })
  const team = useQuery({ queryKey: ['boards', 'team'], queryFn: () => get<Person[]>('/boards/team'), staleTime: 5 * 60_000 })

  const move = useMutation({
    mutationFn: ({ item, state }: { item: WorkItem; state: string }) => patch<WorkItem>(`/boards/work-items/${item.id}`, { state, rev: item.rev }),
    onMutate: async ({ item, state }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Sprint>(key)
      qc.setQueryData<Sprint>(key, (s) => s && { ...s, items: s.items.map((w) => (w.id === item.id ? { ...w, state } : w)) })
      return { prev }
    },
    onError: (e, _, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error(errorMessage(e))
    },
    onSuccess: (w) => toast.success(`#${w.id} moved to ${w.state}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['boards'] }),
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const items = useMemo(
    () =>
      (data?.items ?? []).filter(
        (w) =>
          (!q || w.title.toLowerCase().includes(q.toLowerCase()) || String(w.id).includes(q)) &&
          (!assignee || (assignee === '__none' ? !w.assignedTo : w.assignedTo?.uniqueName === assignee)) &&
          (!type || w.type === type),
      ),
    [data, q, assignee, type],
  )
  const types = useMemo(() => [...new Set((data?.items ?? []).map((w) => w.type))], [data])
  const assignees = useMemo(() => {
    const map = new Map<string, Person>()
    data?.items.forEach((w) => w.assignedTo && map.set(w.assignedTo.uniqueName, w.assignedTo))
    return [...map.values()]
  }, [data])

  const onDragStart = (e: DragStartEvent) => setDragging(data?.items.find((w) => w.id === e.active.id) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const item = data?.items.find((w) => w.id === e.active.id)
    const state = e.over?.id as string | undefined
    if (item && state && item.state !== state) move.mutate({ item, state })
  }

  if (error) return <Page><ErrorState error={error} onRetry={refetch} /></Page>

  const it = data?.iteration
  const total = data?.items.length ?? 0
  const done = data?.items.filter((w) => ['Closed', 'Done', 'Resolved'].includes(w.state)).length ?? 0
  const remaining = data?.items.reduce((s, w) => s + (w.remainingWork ?? 0), 0) ?? 0
  const daysLeft = it?.finishDate ? Math.max(0, Math.ceil((new Date(it.finishDate).getTime() - Date.now()) / 86_400_000)) : null

  return (
    <Page className='max-w-none'>
      <PageHeader
        title={it ? it.name : <Skeleton className='h-8 w-48' />}
        description={it && `${formatDate(it.startDate)} – ${formatDate(it.finishDate)} · ${it.path}`}
        meta={
          data && (
            <>
              <Badge tone='accent'><CalendarRange className='size-3' /> {daysLeft} days left</Badge>
              <Badge tone='success'>{done}/{total} done</Badge>
              <Badge><Hourglass className='size-3' /> {remaining}h remaining</Badge>
              {it?.timeFrame === 'current' && <Badge tone='violet'>current sprint</Badge>}
            </>
          )
        }
        actions={
          <>
            <Select value={iterationId ?? it?.id ?? ''} onChange={(e) => setIterationId(e.target.value)} className='w-44'>
              {data?.iterations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} {i.timeFrame === 'current' ? '(current)' : ''}
                </option>
              ))}
            </Select>
            <Button onClick={() => refetch()} loading={isFetching}>{!isFetching && <RefreshCw />} Sync</Button>
          </>
        }
      />

      {data && (
        <div className='mb-4 h-1.5 overflow-hidden rounded-full bg-card-2'>
          <div className='h-full rounded-full bg-gradient-to-r from-accent to-success transition-[width] duration-700' style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      )}

      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <SearchInput value={q} onChange={setQ} placeholder='Filter by title or #id' className='w-full sm:w-64' />
        <Select value={type} onChange={(e) => setType(e.target.value)} className='w-40'>
          <option value=''>All types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <div className='flex items-center gap-1 rounded-lg border border-border bg-card/60 px-1.5 py-1'>
          <Tooltip content='Everyone'>
            <button type='button' onClick={() => setAssignee(null)} className={cn('grid size-7 place-items-center rounded-full', !assignee && 'ring-2 ring-accent')}>
              <Users className='size-3.5 text-muted' />
            </button>
          </Tooltip>
          {assignees.map((p) => (
            <Tooltip key={p.uniqueName} content={p.displayName}>
              <button type='button' onClick={() => setAssignee(assignee === p.uniqueName ? null : p.uniqueName)} className={cn('rounded-full transition-opacity', assignee && assignee !== p.uniqueName && 'opacity-40', assignee === p.uniqueName && 'ring-2 ring-accent')}>
                <Avatar name={p.displayName} src={p.imageUrl} size={26} />
              </button>
            </Tooltip>
          ))}
          <Tooltip content='Unassigned'>
            <button type='button' onClick={() => setAssignee(assignee === '__none' ? null : '__none')} className={cn('grid size-7 place-items-center rounded-full border border-dashed border-border-strong text-[10px] text-muted', assignee === '__none' && 'ring-2 ring-accent')}>
              ?
            </button>
          </Tooltip>
        </div>
        {!isAdmin && <span className='ml-auto text-xs text-subtle'>Read-only – admins can move and edit items</span>}
      </div>

      {isLoading ? (
        <div className='grid grid-cols-4 gap-4'>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className='h-[60vh]' />)}</div>
      ) : data && data.items.length === 0 ? (
        <Card><EmptyState icon={ListTodo} title='No work items in this sprint' /></Card>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className='flex gap-4 overflow-x-auto pb-4'>
            {data?.columns.map((col) => (
              <BoardColumn key={col} state={col} items={items.filter((w) => w.state === col)} canDrag={isAdmin} onOpen={setSelected} />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>{dragging && <WorkCard item={dragging} overlay />}</DragOverlay>
        </DndContext>
      )}
      <WorkItemSheet
        item={selected}
        team={team.data ?? []}
        columns={data?.columns ?? []}
        typeIcon={(t) => {
          const s = typeStyle(t)
          return <s.icon className={cn('size-3.5', s.color)} />
        }}
        onClose={() => setSelected(null)}
      />
    </Page>
  )
}

function BoardColumn({ state, items, canDrag, onOpen }: { state: string; items: WorkItem[]; canDrag: boolean; onOpen: (w: WorkItem) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: state, disabled: !canDrag })
  return (
    <div className='flex w-[300px] shrink-0 flex-col xl:w-auto xl:min-w-[260px] xl:flex-1'>
      <div className='mb-2.5 flex items-center gap-2 px-1'>
        <span className={cn('size-2 rounded-full', COLUMN_ACCENT[state] ?? 'bg-subtle')} />
        <span className='text-[13px] font-semibold'>{state}</span>
        <span className='rounded-md bg-card-2 px-1.5 text-[11px] text-muted tabular'>{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[55vh] flex-1 space-y-2.5 rounded-xl border border-dashed p-2 transition-colors',
          isOver ? 'border-accent bg-accent-soft' : 'border-transparent bg-card-2/30',
        )}
      >
        {items.map((w) => <DraggableCard key={w.id} item={w} canDrag={canDrag} onOpen={onOpen} />)}
        {items.length === 0 && <p className='py-8 text-center text-xs text-subtle'>Drop items here</p>}
      </div>
    </div>
  )
}

function DraggableCard({ item, canDrag, onOpen }: { item: WorkItem; canDrag: boolean; onOpen: (w: WorkItem) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, disabled: !canDrag })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(item)} className={cn(isDragging && 'opacity-30')}>
      <WorkCard item={item} />
    </div>
  )
}

function WorkCard({ item, overlay }: { item: WorkItem; overlay?: boolean }) {
  const s = typeStyle(item.type)
  const Icon = s.icon
  return (
    <div
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-3 pl-3.5 transition-all hover:border-border-strong hover:shadow-lg',
        overlay && 'w-[280px] rotate-2 border-accent shadow-2xl',
      )}
    >
      <span className={cn('absolute top-0 bottom-0 left-0 w-[3px]', s.bar)} />
      <div className='flex items-center gap-1.5 text-[11px] text-muted'>
        <Icon className={cn('size-3.5', s.color)} />
        <span className='font-mono'>#{item.id}</span>
        {item.priority && item.priority <= 1 && (
          <span className='ml-auto flex items-center gap-0.5 text-danger'><Flag className='size-3' /> P{item.priority}</span>
        )}
      </div>
      <p className='mt-1.5 line-clamp-3 text-[13px] leading-snug font-medium'>{item.title}</p>
      <div className='mt-2.5 flex items-center gap-1.5'>
        {item.tags.slice(0, 2).map((t) => <span key={t} className='rounded bg-card-2 px-1.5 py-px text-[10.5px] text-muted'>{t}</span>)}
        <div className='ml-auto flex items-center gap-2'>
          {!!item.commentCount && (
            <span className='flex items-center gap-0.5 text-[11px] text-muted'><MessageSquare className='size-3' />{item.commentCount}</span>
          )}
          {item.remainingWork !== null && item.remainingWork !== undefined && <span className='text-[11px] text-muted tabular'>{item.remainingWork}h</span>}
          {item.storyPoints !== null && item.storyPoints !== undefined && <span className='rounded-full bg-accent-soft px-1.5 text-[10.5px] font-semibold text-accent'>{item.storyPoints}</span>}
          {item.assignedTo ? <Avatar name={item.assignedTo.displayName} src={item.assignedTo.imageUrl} size={22} /> : <span className='grid size-[22px] place-items-center rounded-full border border-dashed border-border-strong text-[9px] text-subtle'>?</span>}
        </div>
      </div>
    </div>
  )
}

