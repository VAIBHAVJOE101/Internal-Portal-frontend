import { useQuery } from '@tanstack/react-query'
import { AlertOctagon, MoreHorizontal, Pause, Play, Plug, Plus, RotateCw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, Sheet } from '@/components/ui/dialog'
import { Field, Input, SearchInput, Select, Textarea } from '@/components/ui/input'
import { EmptyState, ErrorState, Menu, Mono, Segmented, Skeleton, Tooltip } from '@/components/ui/misc'
import { Toolbar } from '@/components/ui/page'
import { del, enc, get, post, put } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Connector } from '@/lib/types'
import { cn, compact } from '@/lib/utils'
import { kafkaBase, useKafkaMutation } from './api'

const isFailed = (c: Connector) => c.state === 'FAILED' || c.tasks.some((t) => t.state === 'FAILED')

export function ConnectorsTab({ id, hasConnect }: { id: string; hasConnect: boolean }) {
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | 'sink' | 'source' | 'failed'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kafka', id, 'connectors'],
    queryFn: () => get<Connector[]>(`${kafkaBase(id)}/connectors`),
    enabled: hasConnect,
    refetchInterval: 20_000,
  })

  const action = useKafkaMutation(
    id,
    ({ name, op }: { name: string; op: 'restart' | 'restart-failed' | 'pause' | 'resume' | 'delete' }) => {
      const base = `${kafkaBase(id)}/connectors/${enc(name)}`
      if (op === 'delete') return del(base)
      if (op === 'restart') return post(`${base}/restart`, null, { includeTasks: true, onlyFailed: false })
      if (op === 'restart-failed') return post(`${base}/restart`, null, { includeTasks: true, onlyFailed: true })
      return post(`${base}/${op}`)
    },
    ({ name, op }) => `${name}: ${op.replace('-', ' ')} requested`,
  )

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (c) =>
          c.name.toLowerCase().includes(q.toLowerCase()) &&
          (type === 'all' || (type === 'failed' ? isFailed(c) : c.type === type)),
      ),
    [data, q, type],
  )
  const failedCount = (data ?? []).filter(isFailed).length

  if (!hasConnect) {
    return (
      <Card>
        <EmptyState icon={Plug} title="No Kafka Connect configured" description="Add the Connect / sink IPs for this instance in Inventory → Kafka Instances." />
      </Card>
    )
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const run = async (c: Connector, op: 'restart' | 'restart-failed' | 'pause' | 'resume' | 'delete') => {
    if (op === 'delete') {
      const ok = await confirm({ title: `Delete connector ${c.name}?`, description: 'The connector and its tasks are removed from Kafka Connect. Offsets are kept.', danger: true, confirmText: 'Delete', typeToConfirm: c.name })
      if (!ok) return
    }
    action.mutate({ name: c.name, op })
  }

  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search connectors…" className="w-full sm:w-64" />
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'sink', label: 'Sinks' },
            { value: 'source', label: 'Sources' },
            { value: 'failed', label: <span className={cn(failedCount && 'text-danger')}>Failed {failedCount ? `(${failedCount})` : ''}</span> },
          ]}
        />
        {isAdmin && (
          <Button variant="primary" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus /> New connector
          </Button>
        )}
      </Toolbar>
      <DataTable
        rows={rows}
        loading={isLoading}
        rowKey={(c) => c.name}
        onRowClick={(c) => setSelected(c.name)}
        rowClassName={(c) => (isFailed(c) ? 'bg-danger-soft/40' : undefined)}
        empty={<EmptyState icon={Plug} title="No connectors match" />}
        columns={[
          {
            key: 'name',
            header: 'Connector',
            sortValue: (c) => c.name,
            cell: (c) => (
              <div>
                <p className="flex items-center gap-2 font-medium">
                  {isFailed(c) && <AlertOctagon className="size-3.5 text-danger" />}
                  {c.name}
                </p>
                <p className="max-w-[360px] truncate font-mono text-[11px] text-subtle">{c.config['connector.class']}</p>
              </div>
            ),
          },
          { key: 'type', header: 'Type', sortValue: (c) => c.type, cell: (c) => <Badge tone={c.type === 'sink' ? 'info' : 'violet'}>{c.type}</Badge> },
          { key: 'state', header: 'State', sortValue: (c) => c.state, cell: (c) => <StatusBadge status={c.state} /> },
          {
            key: 'tasks',
            header: 'Tasks',
            cell: (c) => (
              <div className="flex gap-1">
                {c.tasks.map((t) => (
                  <Tooltip key={t.id} content={`Task ${t.id}: ${t.state}`}>
                    <span className={cn('h-4 w-2.5 rounded-sm', t.state === 'RUNNING' ? 'bg-success' : t.state === 'FAILED' ? 'bg-danger' : t.state === 'PAUSED' ? 'bg-warning' : 'bg-subtle')} />
                  </Tooltip>
                ))}
              </div>
            ),
          },
          { key: 'topics', header: 'Topics', cell: (c) => <Mono className="block max-w-[220px] truncate text-muted">{c.config.topics ?? c.config['topic.prefix'] ?? '—'}</Mono> },
          { key: 'lag', header: 'Sink lag', align: 'right', sortValue: (c) => c.lag ?? -1, cell: (c) => (c.lag === null || c.lag === undefined ? <span className="text-subtle">—</span> : <span className="tabular">{compact(c.lag)}</span>) },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (c) =>
              isAdmin && (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Tooltip content={isFailed(c) ? 'Restart failed tasks' : 'Restart connector & tasks'}>
                    <Button size="icon-sm" variant="ghost" onClick={() => run(c, isFailed(c) ? 'restart-failed' : 'restart')}>
                      <RotateCw />
                    </Button>
                  </Tooltip>
                  <Menu
                    trigger={<Button size="icon-sm" variant="ghost" aria-label="More"><MoreHorizontal /></Button>}
                    items={[
                      { label: 'Restart all tasks', icon: RotateCw, onSelect: () => run(c, 'restart') },
                      c.state === 'PAUSED'
                        ? { label: 'Resume', icon: Play, onSelect: () => run(c, 'resume') }
                        : { label: 'Pause', icon: Pause, onSelect: () => run(c, 'pause') },
                      { label: 'Delete', icon: Trash2, onSelect: () => run(c, 'delete'), danger: true, separatorBefore: true },
                    ]}
                  />
                </div>
              ),
          },
        ]}
      />
      <ConnectorSheet id={id} name={selected} onClose={() => setSelected(null)} />
      <CreateConnectorDialog id={id} open={creating} onOpenChange={setCreating} />
    </Card>
  )
}

function ConnectorSheet({ id, name, onClose }: { id: string; name: string | null; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const base = name ? `${kafkaBase(id)}/connectors/${enc(name)}` : ''
  const { data, isLoading, error } = useQuery({ queryKey: ['kafka', id, 'connector', name], queryFn: () => get<Connector>(base), enabled: !!name, refetchInterval: 10_000 })
  const [config, setConfig] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  useEffect(() => {
    if (data) setConfig(JSON.stringify(data.config, null, 2))
  }, [data?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = useKafkaMutation(id, (cfg: Record<string, string>) => put(`${base}/config`, cfg), 'Connector config updated')
  const restartTask = useKafkaMutation(id, (task: number) => post(`${base}/tasks/${task}/restart`), (t) => `Task ${t} restart requested`)

  const onSave = () => {
    try {
      const parsed = JSON.parse(config) as Record<string, unknown>
      setParseError(null)
      saveConfig.mutate(Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)])))
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  return (
    <Sheet
      open={!!name}
      onOpenChange={(o) => !o && onClose()}
      title={name}
      description={data ? `${data.type} connector on ${data.workerId ?? 'unknown worker'}` : undefined}
      className="w-[min(720px,100vw)]"
      footer={
        isAdmin && data ? (
          <>
            {parseError && <span className="mr-auto text-xs text-danger">{parseError}</span>}
            <Button variant="primary" onClick={onSave} loading={saveConfig.isPending}>
              <Save /> Save config
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
            <Badge tone={data.type === 'sink' ? 'info' : 'violet'}>{data.type}</Badge>
            {data.lag !== null && data.lag !== undefined && <Badge>lag {compact(data.lag)}</Badge>}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Tasks</p>
            <div className="space-y-2">
              {data.tasks.map((t) => (
                <div key={t.id} className={cn('rounded-xl border p-3', t.state === 'FAILED' ? 'border-danger/40 bg-danger-soft/40' : 'border-border')}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12.5px]">task-{t.id}</span>
                    <StatusBadge status={t.state} />
                    <span className="truncate text-xs text-subtle">{t.workerId}</span>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => restartTask.mutate(t.id)}>
                        <RotateCw /> Restart
                      </Button>
                    )}
                  </div>
                  {t.trace && <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-bg p-2 font-mono text-[11px] whitespace-pre-wrap text-danger">{t.trace}</pre>}
                </div>
              ))}
            </div>
          </div>
          <Field label="Configuration (JSON)" hint={isAdmin ? 'Saved with PUT /connectors/{name}/config' : undefined}>
            <Textarea value={config} readOnly={!isAdmin} onChange={(e) => setConfig(e.target.value)} spellCheck={false} className="min-h-72 font-mono text-[12px]" />
          </Field>
        </div>
      )}
    </Sheet>
  )
}

function CreateConnectorDialog({ id, open, onOpenChange }: { id: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: plugins } = useQuery({
    queryKey: ['kafka', id, 'plugins'],
    queryFn: () => get<{ class: string; type: string; version: string }[]>(`${kafkaBase(id)}/connector-plugins`),
    enabled: open,
  })
  const [name, setName] = useState('')
  const [config, setConfig] = useState('')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setName('')
      setErr(null)
      setConfig(JSON.stringify({ 'connector.class': '', 'tasks.max': '1', topics: '' }, null, 2))
    }
  }, [open])
  const create = useKafkaMutation(id, (body: unknown) => post(`${kafkaBase(id)}/connectors`, body), 'Connector created')
  const submit = () => {
    try {
      const cfg = JSON.parse(config) as Record<string, unknown>
      create.mutate(
        { name, config: Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v)])) },
        { onSuccess: () => onOpenChange(false) },
      )
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New connector"
      className="w-[min(640px,calc(100vw-32px))]"
      footer={
        <>
          {err && <span className="mr-auto text-xs text-danger">{err}</span>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name} loading={create.isPending} onClick={submit}>Create</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="font-mono" placeholder="orders-elastic-sink" />
        </Field>
        <Field label="Plugin" hint="Prefills connector.class">
          <Select
            value=""
            onChange={(e) => {
              try {
                const cfg = JSON.parse(config) as Record<string, unknown>
                setConfig(JSON.stringify({ ...cfg, 'connector.class': e.target.value }, null, 2))
              } catch {
                setConfig(JSON.stringify({ 'connector.class': e.target.value, 'tasks.max': '1' }, null, 2))
              }
            }}
          >
            <option value="">Choose a plugin…</option>
            {plugins?.map((p) => (
              <option key={p.class} value={p.class}>
                {p.class.split('.').pop()} ({p.type}, {p.version})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Config (JSON)">
          <Textarea value={config} onChange={(e) => setConfig(e.target.value)} spellCheck={false} className="min-h-56 font-mono text-[12px]" />
        </Field>
      </div>
    </Dialog>
  )
}
