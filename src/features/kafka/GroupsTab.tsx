import { useQuery } from '@tanstack/react-query'
import { History, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, Sheet } from '@/components/ui/dialog'
import { Field, Input, SearchInput, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, Mono, Skeleton } from '@/components/ui/misc'
import { Toolbar } from '@/components/ui/page'
import { del, enc, get, post } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { ConsumerGroupDetail, ConsumerGroupSummary } from '@/lib/types'
import { cn, compact, number } from '@/lib/utils'
import { kafkaBase, useKafkaMutation } from './api'

function lagTone(lag: number) {
  return lag > 100_000 ? 'text-danger' : lag > 10_000 ? 'text-warning' : 'text-fg'
}

export function GroupsTab({ id }: { id: string }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kafka', id, 'groups'],
    queryFn: () => get<ConsumerGroupSummary[]>(`${kafkaBase(id)}/groups`),
    refetchInterval: 30_000,
  })
  const rows = useMemo(() => (data ?? []).filter((g) => g.groupId.toLowerCase().includes(q.toLowerCase()) || g.topics.some((t) => t.includes(q))), [data, q])
  const maxLag = Math.max(1, ...(data ?? []).map((g) => g.totalLag))

  if (error) return <ErrorState error={error} onRetry={refetch} />
  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search groups or topics…" className="w-full sm:w-72" />
        <span className="ml-auto text-xs text-subtle">{rows.length} groups · refreshed every 30s</span>
      </Toolbar>
      <DataTable
        rows={rows}
        loading={isLoading}
        rowKey={(g) => g.groupId}
        onRowClick={(g) => setSelected(g.groupId)}
        defaultSort={{ key: 'lag', dir: 'desc' }}
        empty={<EmptyState icon={Users} title="No consumer groups" />}
        columns={[
          {
            key: 'group',
            header: 'Group',
            sortValue: (g) => g.groupId,
            cell: (g) => (
              <span className="flex items-center gap-2">
                <Mono className="font-medium">{g.groupId}</Mono>
                {g.groupId.startsWith('connect-') && <Badge tone="info">sink</Badge>}
              </span>
            ),
          },
          { key: 'state', header: 'State', sortValue: (g) => g.state, cell: (g) => <StatusBadge status={g.state} /> },
          { key: 'members', header: 'Members', align: 'right', sortValue: (g) => g.members, cell: (g) => <span className="tabular">{g.members}</span> },
          {
            key: 'topics',
            header: 'Topics',
            cell: (g) => (
              <span className="flex max-w-[340px] flex-wrap gap-1">
                {g.topics.map((t) => <span key={t} className="rounded-md bg-card-2 px-1.5 font-mono text-[11.5px]">{t}</span>)}
              </span>
            ),
          },
          {
            key: 'lag',
            header: 'Lag',
            align: 'right',
            sortValue: (g) => g.totalLag,
            width: 180,
            cell: (g) => (
              <div className="flex items-center justify-end gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-card-2">
                  <div className={cn('h-full rounded-full', g.totalLag > 10_000 ? 'bg-warning' : 'bg-accent')} style={{ width: `${Math.max(2, (g.totalLag / maxLag) * 100)}%` }} />
                </div>
                <span className={cn('w-14 font-medium tabular', lagTone(g.totalLag))}>{compact(g.totalLag)}</span>
              </div>
            ),
          },
        ]}
      />
      <GroupSheet id={id} groupId={selected} onClose={() => setSelected(null)} />
    </Card>
  )
}

function GroupSheet({ id, groupId, onClose }: { id: string; groupId: string | null; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const [resetOpen, setResetOpen] = useState(false)
  const base = groupId ? `${kafkaBase(id)}/groups/${enc(groupId)}` : ''
  const { data, isLoading, error } = useQuery({
    queryKey: ['kafka', id, 'group', groupId],
    queryFn: () => get<ConsumerGroupDetail>(base),
    enabled: !!groupId,
    refetchInterval: 15_000,
  })
  const remove = useKafkaMutation(id, () => del(base), 'Consumer group deleted')

  const onDelete = async () => {
    const ok = await confirm({ title: `Delete consumer group ${groupId}?`, description: 'Committed offsets are removed. The group must be empty.', danger: true, confirmText: 'Delete group', typeToConfirm: groupId! })
    if (ok) remove.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Sheet
      open={!!groupId}
      onOpenChange={(o) => !o && onClose()}
      title={<span className="font-mono">{groupId}</span>}
      description={data ? `${data.members.length} members · total lag ${number(data.totalLag)}` : undefined}
      className="w-[min(720px,100vw)]"
      footer={
        isAdmin && data ? (
          <>
            <Button variant="danger-ghost" className="mr-auto" onClick={onDelete} disabled={data.members.length > 0}>
              <Trash2 /> Delete group
            </Button>
            <Button variant="primary" onClick={() => setResetOpen(true)}>
              <History /> Reset offsets
            </Button>
          </>
        ) : undefined
      }
    >
      {error && <ErrorState error={error} />}
      {isLoading && <Skeleton className="h-80" />}
      {data && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={data.state} />
            {data.coordinator !== undefined && <Badge>coordinator {data.coordinator}</Badge>}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Partition offsets</p>
            <div className="overflow-hidden rounded-xl border border-border">
              <DataTable
                dense
                rows={data.offsets}
                rowKey={(o) => `${o.topic}-${o.partition}`}
                defaultSort={{ key: 'lag', dir: 'desc' }}
                columns={[
                  { key: 'topic', header: 'Topic', sortValue: (o) => o.topic, cell: (o) => <Mono>{o.topic}</Mono> },
                  { key: 'p', header: 'Part.', sortValue: (o) => o.partition, cell: (o) => <span className="tabular">{o.partition}</span> },
                  { key: 'committed', header: 'Committed', align: 'right', cell: (o) => <span className="tabular">{number(o.committed)}</span> },
                  { key: 'end', header: 'End', align: 'right', cell: (o) => <span className="tabular">{number(o.end)}</span> },
                  { key: 'lag', header: 'Lag', align: 'right', sortValue: (o) => o.lag ?? 0, cell: (o) => <span className={cn('font-medium tabular', lagTone(o.lag ?? 0))}>{number(o.lag)}</span> },
                ]}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Members</p>
            {data.members.length === 0 && <p className="text-[13px] text-subtle">No active members.</p>}
            <div className="space-y-2">
              {data.members.map((m) => (
                <div key={m.memberId} className="rounded-lg border border-border p-3">
                  <p className="font-mono text-[12px]">{m.clientId} <span className="text-subtle">{m.host}</span></p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.assignments.map((a) => <span key={a} className="rounded bg-card-2 px-1.5 font-mono text-[11px] text-muted">{a}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {data && <ResetOffsetsDialog id={id} group={data} open={resetOpen} onOpenChange={setResetOpen} />}
    </Sheet>
  )
}

function ResetOffsetsDialog({ id, group, open, onOpenChange }: { id: string; group: ConsumerGroupDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const topics = [...new Set(group.offsets.map((o) => o.topic))]
  const [topic, setTopic] = useState(topics[0] ?? '')
  const [strategy, setStrategy] = useState('LATEST')
  const [value, setValue] = useState('')
  useEffect(() => {
    if (open) setTopic(topics[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const reset = useKafkaMutation(id, () => post(`${kafkaBase(id)}/groups/${enc(group.groupId)}/reset-offsets`, {
    topic,
    strategy,
    value: strategy === 'OFFSET' ? Number(value) : strategy === 'TIMESTAMP' ? new Date(value).getTime() : null,
  }), 'Offsets reset')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reset consumer offsets"
      description={group.members.length > 0 ? 'The group has active members. Stop the consumers first, otherwise the reset is rejected.' : 'The group is empty and can be reset.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={reset.isPending} disabled={!topic || ((strategy === 'OFFSET' || strategy === 'TIMESTAMP') && !value)} onClick={() => reset.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>
            Reset offsets
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Topic">
          <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
            {topics.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Reset to">
          <Select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="EARLIEST">Earliest (reprocess everything)</option>
            <option value="LATEST">Latest (skip backlog)</option>
            <option value="OFFSET">Specific offset</option>
            <option value="TIMESTAMP">Point in time</option>
          </Select>
        </Field>
        {strategy === 'OFFSET' && (
          <Field label="Offset (all partitions)">
            <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
        {strategy === 'TIMESTAMP' && (
          <Field label="Timestamp">
            <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
      </div>
    </Dialog>
  )
}
