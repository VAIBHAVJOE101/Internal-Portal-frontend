import { Columns3, Download, FilterX, Lock, MoreHorizontal, Pencil, Plus, Trash2, Upload, Waypoints } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbs } from '@/components/layout/crumbs'
import { pageIcon } from '@/components/layout/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, Menu, Skeleton } from '@/components/ui/misc'
import { Page, PageHeader, Toolbar } from '@/components/ui/page'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { InventoryColumn, InventoryRecord } from '@/lib/types'
import { downloadText, timeAgo } from '@/lib/utils'
import { inventoryApi, useInventoryMutation, usePage, useRecords, useViewPref } from './api'
import { CellValue } from './CellValue'
import { ColumnsPanel } from './ColumnsPanel'
import { PageDialog } from './PageDialog'
import { RecordDrawer } from './RecordDrawer'

export default function InventoryPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const pageQuery = usePage(slug)
  const recordsQuery = useRecords(slug)
  const { data: pref } = useViewPref(slug)
  const page = pageQuery.data

  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [drawer, setDrawer] = useState<{ open: boolean; record: InventoryRecord | null }>({ open: false, record: null })
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [pageDialog, setPageDialog] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useCrumbs([{ label: 'Inventory', to: '/inventory' }, { label: page?.name ?? '…' }])

  useEffect(() => {
    setQ('')
    setFilters({})
    setSelected(new Set())
  }, [slug])

  // deep link: ?record=<id> opens the drawer
  const recordParam = params.get('record')
  useEffect(() => {
    if (recordParam && recordsQuery.data) {
      const rec = recordsQuery.data.items.find((r) => r.id === Number(recordParam))
      if (rec) setDrawer({ open: true, record: rec })
    }
  }, [recordParam, recordsQuery.data])

  const hidden = useMemo(() => {
    if (pref?.hidden) return new Set(pref.hidden)
    return new Set(page?.columns.filter((c) => !c.visible).map((c) => c.key) ?? [])
  }, [pref, page])

  const filterable = useMemo(() => page?.columns.filter((c) => c.type === 'SELECT' || c.type === 'BOOLEAN') ?? [], [page])

  const rows = useMemo(() => {
    const items = recordsQuery.data?.items ?? []
    const needle = q.trim().toLowerCase()
    return items.filter((r) => {
      if (needle && !Object.values(r.data).some((v) => v !== null && String(v).toLowerCase().includes(needle))) return false
      return Object.entries(filters).every(([k, v]) => !v || String(r.data[k] ?? '') === v)
    })
  }, [recordsQuery.data, q, filters])

  const deleteRecords = useInventoryMutation((ids: number[]) => inventoryApi.deleteRecords(slug!, ids))
  const deletePage = useInventoryMutation(() => inventoryApi.deletePage(slug!), 'Page deleted')

  if (pageQuery.error) return <Page><ErrorState error={pageQuery.error} onRetry={() => pageQuery.refetch()} /></Page>
  if (!page) {
    return (
      <Page>
        <Skeleton className="mb-6 h-10 w-72" />
        <Skeleton className="h-96" />
      </Page>
    )
  }

  const Icon = pageIcon(page.icon)
  const visibleColumns = page.columns.filter((c) => !hidden.has(c.key))
  const columns: Column<InventoryRecord>[] = visibleColumns.map((c: InventoryColumn, i) => ({
    key: c.key,
    header: c.label,
    width: c.width ?? undefined,
    sortValue: (r) => {
      const v = r.data[c.key]
      return Array.isArray(v) ? v.join(',') : (v as string | number | boolean | null | undefined)
    },
    cell: (r) => (i === 0 ? <span className="font-medium"><CellValue column={c} value={r.data[c.key]} /></span> : <CellValue column={c} value={r.data[c.key]} />),
  }))
  columns.push({
    key: '__updated',
    header: 'Updated',
    sortValue: (r) => r.updatedAt,
    align: 'right',
    cell: (r) => <span className="text-xs whitespace-nowrap text-muted">{timeAgo(r.updatedAt)}</span>,
  })

  const openRecord = (record: InventoryRecord | null) => {
    setDrawer({ open: true, record })
  }
  const closeDrawer = (o: boolean) => {
    setDrawer((d) => ({ ...d, open: o }))
    if (!o && recordParam) {
      params.delete('record')
      setParams(params, { replace: true })
    }
  }

  const onBulkDelete = async () => {
    const ids = [...selected].map(Number)
    const ok = await confirm({
      title: `Delete ${ids.length} record${ids.length > 1 ? 's' : ''}?`,
      description: `They will be permanently removed from ${page.name}.`,
      confirmText: 'Delete',
      danger: true,
      typeToConfirm: ids.length > 5 ? 'delete' : undefined,
    })
    if (ok) {
      deleteRecords.mutate(ids, {
        onSuccess: () => {
          toast.success(`${ids.length} record(s) deleted`)
          setSelected(new Set())
        },
      })
    }
  }

  const onDeletePage = async () => {
    const ok = await confirm({
      title: `Delete page "${page.name}"?`,
      description: (
        <>
          The page, its {page.columns.length} columns and <b className="text-fg">{page.recordCount} records</b> will be permanently deleted.
        </>
      ),
      confirmText: 'Delete page',
      danger: true,
      typeToConfirm: page.slug,
    })
    if (ok) deletePage.mutate(undefined, { onSuccess: () => navigate('/inventory') })
  }

  const onExport = async () => {
    try {
      downloadText(`${page.slug}.csv`, await inventoryApi.exportCsv(page.slug))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const onImport = async (file: File) => {
    try {
      const result = await inventoryApi.importCsv(page.slug, await file.text())
      recordsQuery.refetch()
      if (result.errors.length) toast.warning(`Imported ${result.created} rows with ${result.errors.length} error(s)`, { description: result.errors.slice(0, 3).join('\n') })
      else toast.success(`Imported ${result.created} rows`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const activeFilters = Object.values(filters).filter(Boolean).length + (q ? 1 : 0)

  return (
    <Page>
      <PageHeader
        title={
          <>
            <span className="grid size-9 place-items-center rounded-xl border border-border bg-card">
              <Icon className="size-4.5 text-accent" />
            </span>
            {page.name}
          </>
        }
        description={page.description}
        meta={
          <>
            <Badge tone="neutral">{page.recordCount} records</Badge>
            <Badge tone="neutral">{page.columns.length} columns</Badge>
            {page.group && <Badge tone="neutral">{page.group}</Badge>}
            {page.system && (
              <Badge tone="violet">
                <Lock className="size-3" /> System page
              </Badge>
            )}
          </>
        }
        actions={
          <>
            {page.slug === 'kafka-instances' && (
              <Button onClick={() => navigate('/kafka')}>
                <Waypoints /> Open Kafka
              </Button>
            )}
            <Button onClick={() => setColumnsOpen(true)}>
              <Columns3 /> Columns
            </Button>
            {isAdmin && (
              <Button variant="primary" onClick={() => openRecord(null)}>
                <Plus /> New record
              </Button>
            )}
            <Menu
              trigger={
                <Button size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
              items={[
                { label: 'Export CSV', icon: Download, onSelect: onExport },
                ...(isAdmin
                  ? [
                      { label: 'Import CSV', icon: Upload, onSelect: () => fileRef.current?.click() },
                      { label: 'Edit page', icon: Pencil, onSelect: () => setPageDialog(true), separatorBefore: true },
                      {
                        label: page.system ? 'System page – cannot delete' : 'Delete page',
                        icon: Trash2,
                        onSelect: onDeletePage,
                        danger: true,
                        disabled: page.system,
                      },
                    ]
                  : []),
              ]}
            />
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          </>
        }
      />

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder={`Search ${page.name.toLowerCase()}…`} className="w-full sm:w-72" />
          {filterable.map((c) => (
            <Select key={c.key} value={filters[c.key] ?? ''} onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))} className="w-40">
              <option value="">Any {c.label.toLowerCase()}</option>
              {c.type === 'BOOLEAN'
                ? ['true', 'false'].map((v) => (
                    <option key={v} value={v}>
                      {v === 'true' ? 'Yes' : 'No'}
                    </option>
                  ))
                : c.options?.choices?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value}
                    </option>
                  ))}
            </Select>
          ))}
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setFilters({})
              }}
            >
              <FilterX /> Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {selected.size > 0 && isAdmin && (
              <>
                <span className="text-xs text-muted">{selected.size} selected</span>
                <Button size="sm" variant="danger-ghost" onClick={onBulkDelete} loading={deleteRecords.isPending}>
                  <Trash2 /> Delete
                </Button>
              </>
            )}
            <span className="text-xs text-subtle tabular">
              {rows.length} of {recordsQuery.data?.total ?? 0}
            </span>
          </div>
        </Toolbar>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          loading={recordsQuery.isLoading}
          onRowClick={(r) => openRecord(r)}
          selectable={isAdmin}
          selected={selected}
          onSelectedChange={setSelected}
          className="max-h-[calc(100vh-290px)]"
          empty={
            <EmptyState
              icon={Icon}
              title={activeFilters ? 'No matching records' : `No ${page.name.toLowerCase()} yet`}
              description={activeFilters ? 'Try a different search or clear filters.' : isAdmin ? 'Add the first record or import a CSV.' : undefined}
              action={
                isAdmin && !activeFilters ? (
                  <Button variant="primary" onClick={() => openRecord(null)}>
                    <Plus /> New record
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>
      {page.slug === 'kafka-instances' && (
        <p className="mt-3 text-xs text-muted">
          The <Link to="/kafka" className="text-accent hover:underline">Kafka</Link> module connects to clusters using the broker and Connect / sink IPs on this page.
          Changes take effect immediately.
        </p>
      )}

      <RecordDrawer page={page} record={drawer.record} open={drawer.open} onOpenChange={closeDrawer} />
      <ColumnsPanel page={page} hidden={hidden} open={columnsOpen} onOpenChange={setColumnsOpen} />
      <PageDialog open={pageDialog} onOpenChange={setPageDialog} page={page} />
    </Page>
  )
}
