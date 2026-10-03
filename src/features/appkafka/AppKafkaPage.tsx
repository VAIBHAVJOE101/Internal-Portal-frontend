import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Database, FilterX, Pencil, RefreshCw, Replace, Route, Wand2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useCrumbs } from '@/components/layout/crumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog } from '@/components/ui/dialog'
import { Input, SearchInput, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, Mono, Segmented } from '@/components/ui/misc'
import { Page, PageHeader, Toolbar } from '@/components/ui/page'
import { errorMessage, get, post } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { ApplyResult, RouteChange, RouteRow, RoutesConfig } from '@/lib/types'
import { cn } from '@/lib/utils'

type Mode = 'SET' | 'REPLACE' | 'CLEAR'
interface BulkRequest {
  rowIds: string[]
  field: string
  mode: Mode
  value?: string
  find?: string
  replace?: string
}

const METHOD_TONE: Record<string, 'success' | 'accent' | 'warning' | 'danger' | 'violet'> = {
  GET: 'success',
  POST: 'accent',
  PUT: 'warning',
  PATCH: 'violet',
  DELETE: 'danger',
}

function fieldLabel(path: string) {
  const last = path.split('.').pop() ?? path
  return last.charAt(0).toUpperCase() + last.slice(1)
}

export default function AppKafkaPage() {
  useCrumbs([{ label: 'App Kafka Portal' }])
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const config = useQuery({ queryKey: ['appkafka', 'config'], queryFn: () => get<RoutesConfig>('/app-kafka/config') })
  const routes = useQuery({ queryKey: ['appkafka', 'routes'], queryFn: () => get<RouteRow[]>('/app-kafka/routes'), enabled: !!config.data?.configured })
  const values = useQuery({ queryKey: ['appkafka', 'values'], queryFn: () => get<Record<string, string[]>>('/app-kafka/values'), enabled: !!config.data?.configured })

  const fields = useMemo(() => config.data?.mappingFields ?? [], [config.data])
  const [q, setQ] = useState('')
  const [api, setApi] = useState('')
  const [method, setMethod] = useState('')
  const [unmapped, setUnmapped] = useState(false)
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [bulk, setBulk] = useState<{ field: string; mode: Mode; value: string; find: string; replace: string }>({ field: '', mode: 'SET', value: '', find: '', replace: '' })
  const [preview, setPreview] = useState<{ request: BulkRequest; changes: RouteChange[] } | null>(null)
  const [result, setResult] = useState<ApplyResult | null>(null)
  const [editing, setEditing] = useState<{ rowId: string; field: string; value: string } | null>(null)

  const bulkField = bulk.field || fields[0] || ''
  const apis = useMemo(() => [...new Set((routes.data ?? []).map((r) => r.api).filter(Boolean))].sort() as string[], [routes.data])
  const rows = useMemo(() => {
    const needle = q.toLowerCase()
    return (routes.data ?? []).filter(
      (r) =>
        (!needle || [r.operationId, r.publicUrl, r.internalUrl, r.api, ...Object.values(r.mappings)].some((v) => v?.toLowerCase().includes(needle))) &&
        (!api || r.api === api) &&
        (!method || r.method === method) &&
        (!unmapped || fields.some((f) => !r.mappings[f])),
    )
  }, [routes.data, q, api, method, unmapped, fields])

  const previewMutation = useMutation({
    mutationFn: (req: BulkRequest) => post<RouteChange[]>('/app-kafka/preview', req),
    onSuccess: (changes, request) => {
      if (changes.length === 0) toast.info('No changes – selected operations already have that mapping')
      else setPreview({ request, changes })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const apply = useMutation({
    mutationFn: (req: BulkRequest) => post<ApplyResult>('/app-kafka/apply', req),
    onSuccess: (r) => {
      setPreview(null)
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['appkafka'] })
      if (r.failed) {
        setResult(r)
        toast.warning(`${r.succeeded} updated, ${r.failed} failed`)
      } else {
        toast.success(`${r.succeeded} operation${r.succeeded === 1 ? '' : 's'} remapped`)
        setSelected(new Set())
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const runPreview = () => {
    previewMutation.mutate({
      rowIds: [...selected].map(String),
      field: bulkField,
      mode: bulk.mode,
      value: bulk.mode === 'SET' ? bulk.value : undefined,
      find: bulk.mode === 'REPLACE' ? bulk.find : undefined,
      replace: bulk.mode === 'REPLACE' ? bulk.replace : undefined,
    })
  }

  const saveInline = () => {
    if (!editing) return
    const req: BulkRequest = editing.value.trim()
      ? { rowIds: [editing.rowId], field: editing.field, mode: 'SET', value: editing.value.trim() }
      : { rowIds: [editing.rowId], field: editing.field, mode: 'CLEAR' }
    apply.mutate(req)
  }

  if (config.error) return <Page><ErrorState error={config.error} onRetry={() => config.refetch()} /></Page>

  const columns: Column<RouteRow>[] = [
    {
      key: 'operation',
      header: 'Operation',
      sortValue: (r) => r.operationId,
      cell: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            {r.method && <Badge tone={METHOD_TONE[r.method] ?? 'neutral'} className="font-mono">{r.method}</Badge>}
            {r.operationId}
          </p>
          <p className="mt-0.5 text-xs text-subtle">{r.api}</p>
        </div>
      ),
    },
    {
      key: 'url',
      header: 'Public URL',
      sortValue: (r) => r.publicUrl,
      cell: (r) => (
        <div className="max-w-[360px]">
          <Mono className="block truncate">{r.publicUrl}</Mono>
          <Mono className="block truncate text-[11px] text-subtle">{r.internalUrl}</Mono>
        </div>
      ),
    },
    ...fields.map<Column<RouteRow>>((f) => ({
      key: f,
      header: (
        <span className="flex items-center gap-1">
          Kafka {fieldLabel(f).toLowerCase()} <span className="font-mono text-[10px] text-subtle">{f}</span>
        </span>
      ),
      sortValue: (r) => r.mappings[f],
      cell: (r) => {
        const isEditing = editing?.rowId === r.id && editing.field === f
        if (isEditing) {
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                autoFocus
                list={`values-${f}`}
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveInline()
                  if (e.key === 'Escape') setEditing(null)
                }}
                className="h-7 min-w-48 font-mono text-[12px]"
              />
              <Button size="icon-sm" variant="primary" onClick={saveInline} loading={apply.isPending} aria-label="Save">
                <Check />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel">
                <X />
              </Button>
            </div>
          )
        }
        const v = r.mappings[f]
        return (
          <div className="group/cell flex items-center gap-1.5">
            {v ? (
              <span className={cn('rounded-md border px-1.5 py-0.5 font-mono text-[12px]', v.startsWith('legacy') ? 'border-warning/40 bg-warning-soft text-warning' : 'border-border bg-card-2')}>{v}</span>
            ) : (
              <span className="text-xs text-subtle italic">not mapped</span>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing({ rowId: r.id, field: f, value: v ?? '' })
                }}
                className="rounded p-1 text-subtle opacity-0 group-hover/cell:opacity-100 hover:bg-hover hover:text-fg"
                aria-label={`Edit ${f}`}
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
        )
      },
    })),
  ]

  const filtersActive = q || api || method || unmapped

  return (
    <Page>
      <PageHeader
        title="App Kafka Portal"
        description="API Gateway routes from Cosmos DB with their Kafka mappings. Remap one operation inline or many at once with a preview before anything is written."
        meta={
          config.data && (
            <>
              <Badge tone={config.data.configured ? 'success' : 'warning'} dot>
                <Database className="size-3" /> {config.data.source}
              </Badge>
              {routes.data && <Badge>{routes.data.length} operations</Badge>}
              <Badge>{fields.length} mapping fields</Badge>
            </>
          )
        }
        actions={
          <Button onClick={() => routes.refetch()} loading={routes.isFetching}>
            {!routes.isFetching && <RefreshCw />} Reload from Cosmos
          </Button>
        }
      />

      {config.data && !config.data.configured && (
        <Card>
          <EmptyState icon={Database} title="Cosmos DB is not configured" description="Set the endpoint, key, database, container and field mapping under Settings → Cosmos DB." />
        </Card>
      )}

      {config.data?.configured && (
        <Card className="overflow-hidden">
          {fields.map((f) => (
            <datalist key={f} id={`values-${f}`}>
              {values.data?.[f]?.map((v) => <option key={v} value={v} />)}
            </datalist>
          ))}
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Search operation, URL or topic…" className="w-full sm:w-80" />
            <Select value={api} onChange={(e) => setApi(e.target.value)} className="w-44">
              <option value="">All APIs</option>
              {apis.map((a) => <option key={a}>{a}</option>)}
            </Select>
            <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-32">
              <option value="">All methods</option>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
            </Select>
            <Button variant={unmapped ? 'primary' : 'secondary'} size="md" onClick={() => setUnmapped(!unmapped)}>
              Unmapped only
            </Button>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(''); setApi(''); setMethod(''); setUnmapped(false) }}>
                <FilterX /> Clear
              </Button>
            )}
            <span className="ml-auto text-xs text-subtle">{rows.length} shown</span>
          </Toolbar>

          {isAdmin && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-accent/30 bg-accent-soft px-4 py-3">
              <span className="mr-1 flex items-center gap-1.5 text-[13px] font-medium">
                <Wand2 className="size-4 text-accent" /> Bulk remap {selected.size} operation{selected.size > 1 ? 's' : ''}
              </span>
              <Select value={bulkField} onChange={(e) => setBulk({ ...bulk, field: e.target.value })} className="w-40">
                {fields.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
              <Segmented
                value={bulk.mode}
                onChange={(mode) => setBulk({ ...bulk, mode })}
                options={[
                  { value: 'SET', label: 'Set to' },
                  { value: 'REPLACE', label: 'Find & replace' },
                  { value: 'CLEAR', label: 'Clear' },
                ]}
              />
              {bulk.mode === 'SET' && (
                <Input list={`values-${bulkField}`} value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value })} placeholder="new value, e.g. orders.events.v2" className="w-64 font-mono" />
              )}
              {bulk.mode === 'REPLACE' && (
                <>
                  <Input value={bulk.find} onChange={(e) => setBulk({ ...bulk, find: e.target.value })} placeholder="find" className="w-40 font-mono" />
                  <Replace className="size-4 text-muted" />
                  <Input value={bulk.replace} onChange={(e) => setBulk({ ...bulk, replace: e.target.value })} placeholder="replace with" className="w-40 font-mono" />
                </>
              )}
              <Button
                variant="primary"
                onClick={runPreview}
                loading={previewMutation.isPending}
                disabled={(bulk.mode === 'SET' && !bulk.value.trim()) || (bulk.mode === 'REPLACE' && !bulk.find)}
              >
                Preview changes <ArrowRight />
              </Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            </div>
          )}

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            loading={routes.isLoading}
            selectable={isAdmin}
            selected={selected}
            onSelectedChange={setSelected}
            defaultSort={{ key: 'operation', dir: 'asc' }}
            className="max-h-[calc(100vh-330px)]"
            empty={<EmptyState icon={Route} title="No operations match" />}
          />
        </Card>
      )}

      <Dialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={`Review ${preview?.changes.length ?? 0} change${preview?.changes.length === 1 ? '' : 's'}`}
        description={preview && <>Field <span className="font-mono text-fg">{preview.request.field}</span> will be updated in Cosmos DB with optimistic concurrency. This is recorded in the audit log.</>}
        className="w-[min(760px,calc(100vw-32px))]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
            <Button variant="primary" loading={apply.isPending} onClick={() => preview && apply.mutate(preview.request)}>
              Apply {preview?.changes.length} change{preview?.changes.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="divide-y divide-border rounded-xl border border-border">
          {preview?.changes.map((c) => (
            <div key={c.rowId} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[200px_1fr]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{c.operationId}</p>
                <p className="truncate font-mono text-[11px] text-subtle">{c.publicUrl}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
                <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger line-through">{c.before ?? '∅'}</span>
                <ArrowRight className="size-3.5 text-muted" />
                <span className="rounded bg-success-soft px-1.5 py-0.5 text-success">{c.after ?? '∅ (cleared)'}</span>
              </div>
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)} title="Apply results" description={result && `${result.succeeded} succeeded, ${result.failed} failed`}>
        <div className="space-y-1.5">
          {result?.results.map((r) => (
            <div key={r.rowId} className="flex items-center gap-2 text-[13px]">
              {r.success ? <Check className="size-4 text-success" /> : <X className="size-4 text-danger" />}
              <span className="font-medium">{r.operationId ?? r.rowId}</span>
              <span className="text-muted">{r.message}</span>
            </div>
          ))}
        </div>
      </Dialog>
    </Page>
  )
}
