import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EmptyState, Skeleton } from './misc'
import { Checkbox } from './switch'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | boolean | null | undefined
  width?: number | string
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface DataTableProps<T> {
  rows: T[] | undefined
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  loading?: boolean
  onRowClick?: (row: T) => void
  selectable?: boolean
  selected?: Set<string | number>
  onSelectedChange?: (selected: Set<string | number>) => void
  empty?: ReactNode
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  className?: string
  dense?: boolean
  rowClassName?: (row: T) => string | undefined
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  onRowClick,
  selectable,
  selected,
  onSelectedChange,
  empty,
  defaultSort,
  className,
  dense,
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | undefined>(defaultSort)

  const sorted = useMemo(() => {
    if (!rows) return []
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    const dir = sort!.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va === vb) return 0
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * dir
    })
  }, [rows, sort, columns])

  const allKeys = sorted.map(rowKey)
  const allSelected = !!selected && allKeys.length > 0 && allKeys.every((k) => selected.has(k))
  const someSelected = !!selected && allKeys.some((k) => selected.has(k))

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : undefined))

  const toggleRow = (k: string | number, v: boolean) => {
    const next = new Set(selected)
    if (v) next.add(k)
    else next.delete(k)
    onSelectedChange?.(next)
  }

  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3'

  return (
    <div className={cn('overflow-auto', className)}>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {selectable && (
              <th className="w-10 border-b border-border bg-card px-4 py-2.5 text-left">
                <Checkbox
                  aria-label="Select all"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(v) => onSelectedChange?.(v ? new Set([...(selected ?? []), ...allKeys]) : new Set())}
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cn(
                  'border-b border-border bg-card text-xs font-medium whitespace-nowrap text-muted',
                  dense ? 'px-3 py-2' : 'px-4 py-2.5',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                )}
              >
                {c.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={cn('inline-flex items-center gap-1 hover:text-fg', sort?.key === c.key && 'text-fg')}
                  >
                    {c.header}
                    {sort?.key === c.key ? (
                      sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                    ) : (
                      <ChevronsUpDown className="size-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {selectable && <td className={cn('border-b border-border', cellPad)} />}
                {columns.map((c) => (
                  <td key={c.key} className={cn('border-b border-border', cellPad)}>
                    <Skeleton className="h-4 w-[70%]" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            sorted.map((row) => {
              const k = rowKey(row)
              const isSelected = selected?.has(k)
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'group transition-colors',
                    onRowClick && 'cursor-pointer',
                    isSelected ? 'bg-accent-soft' : 'hover:bg-hover/60',
                    rowClassName?.(row),
                  )}
                >
                  {selectable && (
                    <td className={cn('border-b border-border', cellPad)}>
                      <Checkbox aria-label="Select row" checked={!!isSelected} onChange={(v) => toggleRow(k, v)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'border-b border-border align-middle',
                        cellPad,
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
        </tbody>
      </table>
      {!loading && sorted.length === 0 && (empty ?? <EmptyState title="Nothing here yet" />)}
    </div>
  )
}
