import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileText, ListChecks, MessageSquare, Pencil, Save, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Avatar, Skeleton } from '@/components/ui/misc'
import { errorMessage, get, patch, post } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { htmlToText, sanitizeHtml, textToHtml } from '@/lib/html'
import type { Person, WorkItem, WorkItemComment } from '@/lib/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'

function toLocal(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Work item drawer: fields, description (rich text, editable), acceptance criteria and the comment thread. */
export function WorkItemSheet({
  item: listItem,
  team,
  columns,
  typeIcon,
  onClose,
}: {
  item: WorkItem | null
  team: Person[]
  columns: string[]
  typeIcon: (type: string) => React.ReactNode
  onClose: () => void
}) {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const id = listItem?.id
  const detail = useQuery({ queryKey: ['boards', 'item', id], queryFn: () => get<WorkItem>(`/boards/work-items/${id}`), enabled: !!id })
  const comments = useQuery({
    queryKey: ['boards', 'comments', id],
    queryFn: () => get<WorkItemComment[]>(`/boards/work-items/${id}/comments`),
    enabled: !!id,
  })
  const item = detail.data ?? listItem
  const [form, setForm] = useState({ state: '', assignedTo: '', start: '', end: '', remaining: '' })
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (item) {
      setForm({
        state: item.state,
        assignedTo: item.assignedTo?.uniqueName ?? '',
        start: toLocal(item.startDate),
        end: toLocal(item.endDate),
        remaining: item.remainingWork?.toString() ?? '',
      })
    }
  }, [item])
  useEffect(() => {
    setEditingDesc(false)
    setComment('')
  }, [id])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['boards'] })
  }
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => patch<WorkItem>(`/boards/work-items/${id}`, { rev: item?.rev, ...body }),
    onSuccess: (w) => {
      refresh()
      toast.success(`#${w.id} updated`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const addComment = useMutation({
    mutationFn: () => post<WorkItemComment>(`/boards/work-items/${id}/comments`, { text: comment }),
    onSuccess: () => {
      setComment('')
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!item) return <Sheet open={false} onOpenChange={() => {}} title="" />

  const fieldChanges = () => {
    const body: Record<string, unknown> = {}
    if (form.state !== item.state) body.state = form.state
    if (form.assignedTo !== (item.assignedTo?.uniqueName ?? '')) body.assignedTo = form.assignedTo
    if (form.start !== toLocal(item.startDate)) body.startDate = form.start ? new Date(form.start).toISOString() : ''
    if (form.end !== toLocal(item.endDate)) body.endDate = form.end ? new Date(form.end).toISOString() : ''
    if (form.remaining !== (item.remainingWork?.toString() ?? '') && form.remaining !== '') body.remainingWork = Number(form.remaining)
    return body
  }
  const dirty = Object.keys(fieldChanges()).length > 0

  return (
    <Sheet
      open={!!listItem}
      onOpenChange={(o) => !o && onClose()}
      title={item.title}
      className="w-[min(680px,100vw)]"
      description={
        <span className="flex items-center gap-1.5">
          {typeIcon(item.type)} {item.type} <span className="font-mono">#{item.id}</span> · updated {timeAgo(item.changedDate)}
        </span>
      }
      footer={
        <>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="mr-auto inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
              Open in Azure DevOps <ExternalLink className="size-3" />
            </a>
          )}
          {isAdmin && (
            <Button variant="primary" disabled={!dirty} onClick={() => save.mutate(fieldChanges())} loading={save.isPending && !editingDesc}>
              <Save /> Save fields
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={form.state} disabled={!isAdmin} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              {columns.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Assignee">
            <Select value={form.assignedTo} disabled={!isAdmin} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              <option value="">Unassigned</option>
              {team.map((p) => <option key={p.uniqueName} value={p.uniqueName}>{p.displayName}</option>)}
            </Select>
          </Field>
          <Field label="Start">
            <Input type="datetime-local" value={form.start} disabled={!isAdmin} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </Field>
          <Field label="End">
            <Input type="datetime-local" value={form.end} disabled={!isAdmin} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </Field>
          <Field label="Remaining work (h)">
            <Input type="number" min={0} step={0.5} value={form.remaining} disabled={!isAdmin} onChange={(e) => setForm({ ...form, remaining: e.target.value })} />
          </Field>
          <Field label="Priority / points">
            <Input value={`P${item.priority ?? '–'}${item.storyPoints ? ` · ${item.storyPoints} pts` : ''}`} disabled />
          </Field>
        </div>
        {item.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{item.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}

        {/* description */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-[13px] font-semibold"><FileText className="size-4 text-muted" /> {item.type === 'Bug' ? 'Description / repro steps' : 'Description'}</h4>
            {isAdmin && !editingDesc && detail.data && (
              <Button size="sm" variant="ghost" onClick={() => { setDesc(htmlToText(item.description)); setEditingDesc(true) }}>
                <Pencil /> Edit
              </Button>
            )}
          </div>
          {detail.isLoading ? (
            <Skeleton className="h-24" />
          ) : editingDesc ? (
            <div className="space-y-2">
              <Textarea autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-40" placeholder="Describe the work…" />
              <div className="flex items-center gap-2">
                <span className="mr-auto text-[11px] text-subtle">Saved as simple formatted text. Rich formatting (images, tables) is replaced.</span>
                <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}><X /> Cancel</Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={save.isPending}
                  onClick={() => save.mutate({ description: desc.trim() ? textToHtml(desc) : '' }, { onSuccess: () => setEditingDesc(false) })}
                >
                  <Save /> Save description
                </Button>
              </div>
            </div>
          ) : item.description ? (
            <div className="rich-text rounded-xl border border-border bg-card-2/40 px-4 py-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }} />
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-subtle">No description.</p>
          )}
        </section>

        {item.acceptanceCriteria && (
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><ListChecks className="size-4 text-muted" /> Acceptance criteria</h4>
            <div className="rich-text rounded-xl border border-border bg-card-2/40 px-4 py-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.acceptanceCriteria) }} />
          </section>
        )}

        {/* comments */}
        <section>
          <h4 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold">
            <MessageSquare className="size-4 text-muted" /> Discussion
            <span className="rounded-md bg-card-2 px-1.5 text-[11px] font-normal text-muted">{comments.data?.length ?? item.commentCount ?? 0}</span>
          </h4>
          {comments.isLoading && <Skeleton className="h-20" />}
          <ol className="space-y-4">
            {comments.data?.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar name={c.author.displayName ?? '?'} src={c.author.imageUrl} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-medium text-fg">{c.author.displayName}</span>{' '}
                    <span className="text-subtle" title={formatDateTime(c.createdDate)}>{timeAgo(c.createdDate)}</span>
                    {c.modifiedDate && c.modifiedDate !== c.createdDate && <span className="text-subtle"> · edited</span>}
                  </p>
                  <div className="rich-text mt-1 rounded-xl rounded-tl-sm border border-border bg-card px-3 py-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.text) }} />
                </div>
              </li>
            ))}
            {comments.data?.length === 0 && <li className="text-[13px] text-subtle">No comments yet.</li>}
          </ol>
          {isAdmin && (
            <div className={cn('mt-4 rounded-xl border border-border bg-card p-2 focus-within:border-accent')}>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && comment.trim()) addComment.mutate()
                }}
                placeholder="Add a comment… (Ctrl+Enter to post)"
                className="min-h-16 border-0 bg-transparent focus:ring-0"
              />
              <div className="flex justify-end">
                <Button size="sm" variant="primary" disabled={!comment.trim()} loading={addComment.isPending} onClick={() => addComment.mutate()}>
                  <Send /> Comment
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Sheet>
  )
}
