import { useQuery } from '@tanstack/react-query'
import { Eraser, Layers, Plus, RotateCcw, Save, SplitSquareHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, Sheet } from '@/components/ui/dialog'
import { Field, Input, SearchInput, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, Mono, Segmented, Skeleton, Tabs } from '@/components/ui/misc'
import { Toolbar } from '@/components/ui/page'
import { Switch } from '@/components/ui/switch'
import { del, enc, get, post, put } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { ConfigEntry, TopicDetail, TopicSummary } from '@/lib/types'
import { cn, msToHuman, number } from '@/lib/utils'
import { kafkaBase, KEY_CONFIGS, RETENTION_PRESETS, useKafkaMutation } from './api'

export function TopicsTab({ id }: { id: string }) {
  const { isAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [showInternal, setShowInternal] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kafka', id, 'topics'],
    queryFn: () => get<TopicSummary[]>(`${kafkaBase(id)}/topics`),
  })

  const rows = useMemo(
    () => (data ?? []).filter((t) => (showInternal || !t.internal) && t.name.toLowerCase().includes(q.toLowerCase())),
    [data, q, showInternal],
  )

  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search topics…" className="w-full sm:w-72" />
        <label className="flex items-center gap-2 text-xs text-muted">
          <Switch checked={showInternal} onCheckedChange={setShowInternal} aria-label="Show internal topics" /> Internal topics
        </label>
        <span className="ml-auto text-xs text-subtle">{rows.length} topics</span>
        {isAdmin && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus /> Create topic
          </Button>
        )}
      </Toolbar>
      <DataTable
        rows={rows}
        loading={isLoading}
        rowKey={(t) => t.name}
        onRowClick={(t) => setSelected(t.name)}
        defaultSort={{ key: 'name', dir: 'asc' }}
        className="max-h-[calc(100vh-330px)]"
        empty={<EmptyState icon={Layers} title="No topics" />}
        columns={[
          {
            key: 'name',
            header: 'Topic',
            sortValue: (t) => t.name,
            cell: (t) => (
              <span className="flex items-center gap-2">
                <Mono className="font-medium">{t.name}</Mono>
                {t.internal && <Badge>internal</Badge>}
              </span>
            ),
          },
          { key: 'partitions', header: 'Partitions', align: 'right', sortValue: (t) => t.partitions, cell: (t) => <span className="tabular">{t.partitions}</span> },
          { key: 'rf', header: 'Replication', align: 'right', sortValue: (t) => t.replicationFactor, cell: (t) => <span className="tabular">{t.replicationFactor}</span> },
          { key: 'retention', header: 'Retention', sortValue: (t) => Number(t.retentionMs ?? 0), cell: (t) => msToHuman(t.retentionMs) },
          {
            key: 'cleanup',
            header: 'Cleanup',
            sortValue: (t) => t.cleanupPolicy,
            cell: (t) => <Badge tone={t.cleanupPolicy?.includes('compact') ? 'violet' : 'neutral'}>{t.cleanupPolicy ?? '—'}</Badge>,
          },
          {
            key: 'urp',
            header: 'Health',
            sortValue: (t) => t.underReplicated,
            cell: (t) => (t.underReplicated ? <Badge tone="warning">{t.underReplicated} under-replicated</Badge> : <Badge tone="success" dot>in sync</Badge>),
          },
        ]}
      />
      <TopicSheet id={id} topic={selected} onClose={() => setSelected(null)} />
      <CreateTopicDialog id={id} open={creating} onOpenChange={setCreating} onCreated={(name) => setSelected(name)} />
    </Card>
  )
}

function CreateTopicDialog({ id, open, onOpenChange, onCreated }: { id: string; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState('')
  const [partitions, setPartitions] = useState(6)
  const [rf, setRf] = useState(3)
  const [retention, setRetention] = useState('604800000')
  const [cleanup, setCleanup] = useState('delete')
  const [minIsr, setMinIsr] = useState('')
  useEffect(() => {
    if (open) {
      setName('')
      setPartitions(6)
    }
  }, [open])
  const create = useKafkaMutation(id, (body: unknown) => post(`${kafkaBase(id)}/topics`, body), `Topic created`)
  const valid = /^[a-zA-Z0-9._-]{1,249}$/.test(name)
  const submit = () => {
    const configs: Record<string, string> = { 'retention.ms': retention, 'cleanup.policy': cleanup }
    if (minIsr) configs['min.insync.replicas'] = minIsr
    create.mutate(
      { name, partitions, replicationFactor: rf, configs },
      {
        onSuccess: () => {
          onOpenChange(false)
          onCreated(name)
        },
      },
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create topic"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={create.isPending} onClick={submit}>Create topic</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Topic name" required error={name && !valid ? "Only letters, digits, '.', '_' and '-'" : null}>
          <Input autoFocus className="font-mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="orders.created.v1" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Partitions" hint="Can be increased later, never decreased">
            <Input type="number" min={1} value={partitions} onChange={(e) => setPartitions(Number(e.target.value))} />
          </Field>
          <Field label="Replication factor">
            <Input type="number" min={1} max={10} value={rf} onChange={(e) => setRf(Number(e.target.value))} />
          </Field>
          <Field label="Retention">
            <Select value={retention} onChange={(e) => setRetention(e.target.value)}>
              {RETENTION_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cleanup policy">
            <Select value={cleanup} onChange={(e) => setCleanup(e.target.value)}>
              <option value="delete">delete</option>
              <option value="compact">compact</option>
              <option value="compact,delete">compact,delete</option>
            </Select>
          </Field>
          <Field label="min.insync.replicas" hint="Optional">
            <Input type="number" min={1} value={minIsr} onChange={(e) => setMinIsr(e.target.value)} />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}

function TopicSheet({ id, topic, onClose }: { id: string; topic: string | null; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const [tab, setTab] = useState('configs')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [resets, setResets] = useState<Set<string>>(new Set())
  const [newPartitions, setNewPartitions] = useState<number | ''>('')
  const [configFilter, setConfigFilter] = useState<'key' | 'all'>('key')
  const base = topic ? `${kafkaBase(id)}/topics/${enc(topic)}` : ''
  const { data, isLoading, error } = useQuery({
    queryKey: ['kafka', id, 'topic', topic],
    queryFn: () => get<TopicDetail>(base),
    enabled: !!topic,
  })

  useEffect(() => {
    setEdits({})
    setResets(new Set())
    setNewPartitions('')
    setTab('configs')
  }, [topic])

  const save = useKafkaMutation(id, () => put(`${base}/configs`, { set: edits, delete: [...resets] }), 'Topic configuration updated')
  const addPartitions = useKafkaMutation(id, (total: number) => post(`${base}/partitions`, { totalCount: total }), (t) => `Partitions increased to ${t}`)
  const purge = useKafkaMutation(id, () => post(`${base}/purge`, {}), 'Topic purged')
  const remove = useKafkaMutation(id, () => del(base), 'Topic deleted')

  const changes = Object.keys(edits).length + resets.size
  const configs = (data?.configs ?? []).filter((c) => configFilter === 'all' || KEY_CONFIGS.includes(c.name) || !c.isDefault)
  configs.sort((a, b) => (KEY_CONFIGS.indexOf(a.name) + 1 || 99) - (KEY_CONFIGS.indexOf(b.name) + 1 || 99) || a.name.localeCompare(b.name))

  const onSave = async () => {
    const before = Object.fromEntries((data?.configs ?? []).map((c) => [c.name, c.value]))
    const ok = await confirm({
      title: `Apply ${changes} configuration change(s)?`,
      description: (
        <div className="space-y-1.5">
          {Object.entries(edits).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-card-2 px-2.5 py-1.5 font-mono text-xs">
              <span className="text-fg">{k}</span>: <span className="text-danger line-through">{before[k] ?? '∅'}</span> → <span className="text-success">{v}</span>
            </div>
          ))}
          {[...resets].map((k) => (
            <div key={k} className="rounded-lg bg-card-2 px-2.5 py-1.5 font-mono text-xs">
              <span className="text-fg">{k}</span>: reset to broker default
            </div>
          ))}
        </div>
      ),
      confirmText: 'Apply changes',
    })
    if (ok) save.mutate(undefined, { onSuccess: () => { setEdits({}); setResets(new Set()) } })
  }

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete topic ${topic}?`,
      description: 'All messages in the topic will be permanently lost. Producers and consumers using it will fail.',
      confirmText: 'Delete topic',
      danger: true,
      typeToConfirm: topic!,
    })
    if (ok) remove.mutate(undefined, { onSuccess: onClose })
  }

  const onPurge = async () => {
    const ok = await confirm({
      title: `Purge all messages in ${topic}?`,
      description: `Deletes ${number(data?.messages)} messages currently in the topic. The topic and its configuration are kept.`,
      confirmText: 'Purge messages',
      danger: true,
      typeToConfirm: topic!,
    })
    if (ok) purge.mutate(undefined)
  }

  const onAddPartitions = async () => {
    if (!newPartitions) return
    const ok = await confirm({
      title: `Increase partitions to ${newPartitions}?`,
      description: 'Partition count can never be reduced. Keyed messages may be routed to different partitions afterwards.',
      confirmText: 'Increase partitions',
    })
    if (ok) addPartitions.mutate(Number(newPartitions), { onSuccess: () => setNewPartitions('') })
  }

  return (
    <Sheet
      open={!!topic}
      onOpenChange={(o) => !o && onClose()}
      title={<span className="font-mono">{topic}</span>}
      description={data ? `${data.partitions.length} partitions · ${number(data.messages)} messages` : undefined}
      className="w-[min(760px,100vw)]"
      footer={
        isAdmin && tab === 'configs' ? (
          <>
            <span className="mr-auto text-xs text-muted">{changes ? `${changes} unsaved change(s)` : 'No changes'}</span>
            <Button variant="ghost" disabled={!changes} onClick={() => { setEdits({}); setResets(new Set()) }}>Discard</Button>
            <Button variant="primary" disabled={!changes} loading={save.isPending} onClick={onSave}>
              <Save /> Review & apply
            </Button>
          </>
        ) : undefined
      }
    >
      {error && <ErrorState error={error} />}
      {isLoading && <Skeleton className="h-96" />}
      {data && (
        <div className="space-y-5">
          <Tabs
            value={tab}
            onValueChange={setTab}
            items={[
              { value: 'configs', label: 'Configuration' },
              { value: 'partitions', label: 'Partitions', count: data.partitions.length },
              ...(isAdmin ? [{ value: 'danger', label: 'Operations' }] : []),
            ]}
          />
          {tab === 'configs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Segmented value={configFilter} onChange={setConfigFilter} options={[{ value: 'key', label: 'Key & overridden' }, { value: 'all', label: 'All configs' }]} />
                <span className="text-xs text-subtle">Changes use incremental alter configs</span>
              </div>
              <div className="divide-y divide-border rounded-xl border border-border">
                {configs.map((c) => (
                  <ConfigRow
                    key={c.name}
                    entry={c}
                    editable={isAdmin && !c.readOnly && !data.internal}
                    edited={edits[c.name]}
                    reset={resets.has(c.name)}
                    onEdit={(v) => {
                      setResets((r) => { const n = new Set(r); n.delete(c.name); return n })
                      setEdits((e) => {
                        const n = { ...e }
                        if (v === null || v === (c.value ?? '')) delete n[c.name]
                        else n[c.name] = v
                        return n
                      })
                    }}
                    onReset={() => {
                      setEdits((e) => { const n = { ...e }; delete n[c.name]; return n })
                      setResets((r) => new Set(r).add(c.name))
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {tab === 'partitions' && (
            <div className="overflow-hidden rounded-xl border border-border">
              <DataTable
                dense
                rows={data.partitions}
                rowKey={(p) => p.partition}
                columns={[
                  { key: 'p', header: '#', sortValue: (p) => p.partition, cell: (p) => <span className="tabular">{p.partition}</span> },
                  { key: 'leader', header: 'Leader', cell: (p) => p.leader ?? <Badge tone="danger">none</Badge> },
                  { key: 'replicas', header: 'Replicas', cell: (p) => <Mono>{p.replicas.join(', ')}</Mono> },
                  {
                    key: 'isr',
                    header: 'ISR',
                    cell: (p) => <Mono className={cn(p.isr.length < p.replicas.length && 'text-warning')}>{p.isr.join(', ')}</Mono>,
                  },
                  { key: 'start', header: 'Earliest', align: 'right', cell: (p) => <span className="tabular">{number(p.earliestOffset)}</span> },
                  { key: 'end', header: 'Latest', align: 'right', cell: (p) => <span className="tabular">{number(p.latestOffset)}</span> },
                  {
                    key: 'msgs',
                    header: 'Messages',
                    align: 'right',
                    sortValue: (p) => (p.latestOffset ?? 0) - (p.earliestOffset ?? 0),
                    cell: (p) => <span className="tabular">{number((p.latestOffset ?? 0) - (p.earliestOffset ?? 0))}</span>,
                  },
                ]}
              />
            </div>
          )}
          {tab === 'danger' && isAdmin && (
            <div className="space-y-3">
              <OpCard icon={SplitSquareHorizontal} title="Increase partitions" description={`Currently ${data.partitions.length}. Partitions can only be added.`}>
                <div className="flex gap-2">
                  <Input type="number" min={data.partitions.length + 1} placeholder={String(data.partitions.length + 1)} value={newPartitions} onChange={(e) => setNewPartitions(e.target.value ? Number(e.target.value) : '')} className="w-28" />
                  <Button onClick={onAddPartitions} disabled={!newPartitions || Number(newPartitions) <= data.partitions.length} loading={addPartitions.isPending}>
                    Apply
                  </Button>
                </div>
              </OpCard>
              <OpCard icon={Eraser} title="Purge messages" description="Delete all records currently in the topic (delete-records up to the latest offset)." tone="warning">
                <Button variant="danger-ghost" onClick={onPurge} loading={purge.isPending} disabled={data.internal}>Purge</Button>
              </OpCard>
              <OpCard icon={Trash2} title="Delete topic" description="Permanently delete the topic and all its data." tone="danger">
                <Button variant="danger" onClick={onDelete} loading={remove.isPending} disabled={data.internal}>Delete topic</Button>
              </OpCard>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

function OpCard({ icon: Icon, title, description, children, tone }: { icon: typeof Trash2; title: string; description: string; children: React.ReactNode; tone?: 'warning' | 'danger' }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4 rounded-xl border p-4', tone === 'danger' ? 'border-danger/30 bg-danger-soft/40' : tone === 'warning' ? 'border-warning/30' : 'border-border')}>
      <Icon className={cn('size-5', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-muted')} />
      <div className="min-w-48 flex-1">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {children}
    </div>
  )
}

function ConfigRow({
  entry,
  editable,
  edited,
  reset,
  onEdit,
  onReset,
}: {
  entry: ConfigEntry
  editable: boolean
  edited?: string
  reset: boolean
  onEdit: (v: string | null) => void
  onReset: () => void
}) {
  const value = edited ?? entry.value ?? ''
  const changed = edited !== undefined || reset
  const isMs = entry.name.endsWith('.ms')
  return (
    <div className={cn('grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 sm:grid-cols-[240px_1fr_auto]', changed && 'bg-accent-soft')}>
      <div className="min-w-0">
        <p className="truncate font-mono text-[12.5px]">{entry.name}</p>
        <p className="text-[11px] text-subtle">{reset ? 'will reset to default' : entry.isDefault ? 'default' : entry.source.toLowerCase().replace(/_/g, ' ')}</p>
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        {editable ? (
          entry.name === 'retention.ms' ? (
            <Select value={RETENTION_PRESETS.some((p) => p.value === value) ? value : '__custom'} onChange={(e) => e.target.value !== '__custom' && onEdit(e.target.value)} className="w-36">
              {RETENTION_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              <option value="__custom">Custom…</option>
            </Select>
          ) : entry.name === 'cleanup.policy' ? (
            <Select value={value} onChange={(e) => onEdit(e.target.value)} className="w-40">
              {['delete', 'compact', 'compact,delete'].map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          ) : null
        ) : null}
        {editable && entry.name !== 'cleanup.policy' ? (
          <Input value={value} onChange={(e) => onEdit(e.target.value)} className={cn('h-7.5 font-mono text-[12.5px]', entry.name === 'retention.ms' ? 'w-36' : 'w-full max-w-64')} />
        ) : !editable ? (
          <Mono className="truncate text-muted">{entry.sensitive ? '••••••' : value || '—'}</Mono>
        ) : null}
        {isMs && value && <span className="text-xs whitespace-nowrap text-subtle">{msToHuman(value)}</span>}
      </div>
      {editable && !entry.isDefault && !reset && (
        <Button size="icon-sm" variant="ghost" title="Reset to default" onClick={onReset}>
          <RotateCcw />
        </Button>
      )}
    </div>
  )
}
