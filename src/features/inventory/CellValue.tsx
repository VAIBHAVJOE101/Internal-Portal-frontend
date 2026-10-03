import { useQuery } from '@tanstack/react-query'
import { Check, ExternalLink, Minus } from 'lucide-react'
import { Badge, type Tone } from '@/components/ui/badge'
import { enc, get } from '@/lib/api'
import type { InventoryColumn, InventoryPage, InventoryRecord, PageResult } from '@/lib/types'
import { cn, formatDate, formatDateTime } from '@/lib/utils'

const CHOICE_TONES: Tone[] = ['accent', 'violet', 'info', 'success', 'warning', 'danger']

export function choiceTone(column: InventoryColumn, value: string): Tone {
  const choice = column.options?.choices?.find((c) => c.value === value)
  if (choice?.color && (CHOICE_TONES as string[]).includes(choice.color)) return choice.color as Tone
  // semantic defaults for common environment values
  const v = value.toLowerCase()
  if (v === 'prod' || v === 'production') return 'danger'
  if (v === 'uat' || v === 'staging') return 'warning'
  if (v === 'qa') return 'info'
  if (v === 'dev') return 'success'
  const idx = column.options?.choices?.findIndex((c) => c.value === value) ?? -1
  return idx >= 0 ? CHOICE_TONES[idx % CHOICE_TONES.length]! : 'neutral'
}

export function daysUntil(value: string) {
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

/** Title of a record = first non-empty column value. */
export function recordTitle(page: Pick<InventoryPage, 'columns'>, record: InventoryRecord) {
  for (const c of page.columns) {
    const v = record.data[c.key]
    if (v !== null && v !== undefined && v !== '') return Array.isArray(v) ? v.join(', ') : String(v)
  }
  return `#${record.id}`
}

export function useReferenceTitles(refPage?: string) {
  return useQuery({
    queryKey: ['inventory', 'ref', refPage],
    enabled: !!refPage,
    staleTime: 60_000,
    queryFn: async () => {
      const [page, records] = await Promise.all([
        get<InventoryPage>(`/inventory/pages/${enc(refPage!)}`),
        get<PageResult<InventoryRecord>>(`/inventory/pages/${enc(refPage!)}/records`, { size: 1000 }),
      ])
      return new Map(records.items.map((r) => [r.id, recordTitle(page, r)]))
    },
  })
}

export function CellValue({ column, value }: { column: InventoryColumn; value: unknown }) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-subtle">—</span>
  }
  switch (column.type) {
    case 'BOOLEAN':
      return value ? (
        <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" /> Yes</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted"><Minus className="size-3.5" /> No</span>
      )
    case 'SELECT':
      return <Badge tone={choiceTone(column, String(value))}>{String(value)}</Badge>
    case 'MULTISELECT':
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((v) => (
            <Badge key={v} tone={choiceTone(column, v)}>{v}</Badge>
          ))}
        </span>
      )
    case 'LIST':
      return (
        <span className="flex max-w-[320px] flex-wrap gap-1">
          {(Array.isArray(value) ? value : [value]).map((v) => (
            <span key={String(v)} className="rounded-md border border-border bg-card-2 px-1.5 py-px font-mono text-[11.5px]">
              {String(v)}
            </span>
          ))}
        </span>
      )
    case 'URL':
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-[260px] items-center gap-1 truncate text-accent hover:underline">
          <span className="truncate">{String(value).replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      )
    case 'EMAIL':
      return <a href={`mailto:${value}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-fg hover:text-accent">{String(value)}</a>
    case 'IP':
      return <span className="font-mono text-[12.5px]">{String(value)}</span>
    case 'NUMBER':
      return <span className="tabular">{Intl.NumberFormat().format(Number(value))}</span>
    case 'DATETIME':
      return <span className="whitespace-nowrap">{formatDateTime(String(value))}</span>
    case 'DATE': {
      const formatted = formatDate(String(value))
      if (!column.expiryTracking) return <span className="whitespace-nowrap">{formatted}</span>
      const days = daysUntil(String(value))
      const tone = days < 0 ? 'text-danger' : days <= 7 ? 'text-danger' : days <= 30 ? 'text-warning' : 'text-success'
      const bar = days < 0 ? 'bg-danger' : days <= 7 ? 'bg-danger' : days <= 30 ? 'bg-warning' : 'bg-success'
      return (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className={cn('size-1.5 rounded-full', bar)} />
          {formatted}
          <span className={cn('text-xs', tone)}>
            {days < 0 ? `expired ${-days}d ago` : days === 0 ? 'today' : `in ${days}d`}
          </span>
        </span>
      )
    }
    case 'REFERENCE':
      return <ReferenceValue refPage={column.options?.refPage} id={Number(value)} />
    case 'LONGTEXT':
      return <span className="line-clamp-2 max-w-[320px] text-muted">{String(value)}</span>
    default:
      return <span className="max-w-[320px] truncate">{String(value)}</span>
  }
}

function ReferenceValue({ refPage, id }: { refPage?: string; id: number }) {
  const { data } = useReferenceTitles(refPage)
  return <Badge tone="neutral">{data?.get(id) ?? `#${id}`}</Badge>
}
