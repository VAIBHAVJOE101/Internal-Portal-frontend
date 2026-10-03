import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, del, enc, errorMessage, get, post, put } from '@/lib/api'
import type { ColumnOptions, ColumnType, InventoryPage, InventoryRecord, PageResult } from '@/lib/types'

export interface ColumnInput {
  key?: string
  label: string
  type: ColumnType
  required?: boolean
  visible?: boolean
  width?: number | null
  options?: ColumnOptions | null
  expiryTracking?: boolean
  description?: string | null
}

export interface PageInput {
  name: string
  slug?: string
  description?: string | null
  icon?: string | null
  group?: string | null
  columns?: ColumnInput[]
}

export const COLUMN_TYPES: { value: ColumnType; label: string; hint: string }[] = [
  { value: 'TEXT', label: 'Text', hint: 'Single line' },
  { value: 'LONGTEXT', label: 'Long text', hint: 'Notes, descriptions' },
  { value: 'NUMBER', label: 'Number', hint: 'Integers or decimals' },
  { value: 'DATE', label: 'Date', hint: 'Can track expiry' },
  { value: 'DATETIME', label: 'Date & time', hint: 'ISO timestamp' },
  { value: 'BOOLEAN', label: 'Yes / No', hint: 'Toggle' },
  { value: 'SELECT', label: 'Select', hint: 'One of a list' },
  { value: 'MULTISELECT', label: 'Multi-select', hint: 'Several of a list' },
  { value: 'LIST', label: 'List', hint: 'Free values, e.g. IPs' },
  { value: 'URL', label: 'URL', hint: 'Clickable link' },
  { value: 'IP', label: 'IP / CIDR', hint: 'Validated address' },
  { value: 'EMAIL', label: 'Email', hint: 'Owner, contact' },
  { value: 'REFERENCE', label: 'Reference', hint: 'Link to another page' },
]

export function usePages() {
  return useQuery({ queryKey: ['inventory', 'pages'], queryFn: () => get<InventoryPage[]>('/inventory/pages') })
}

export function usePage(slug: string | undefined) {
  return useQuery({
    queryKey: ['inventory', 'page', slug],
    queryFn: () => get<InventoryPage>(`/inventory/pages/${enc(slug!)}`),
    enabled: !!slug,
  })
}

export function useRecords(slug: string | undefined) {
  return useQuery({
    queryKey: ['inventory', 'records', slug],
    queryFn: () => get<PageResult<InventoryRecord>>(`/inventory/pages/${enc(slug!)}/records`, { size: 1000 }),
    enabled: !!slug,
  })
}

/** Shared mutation helper: toasts errors, invalidates inventory queries on success. */
export function useInventoryMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>, success?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['kafka'] })
      if (success) toast.success(success)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export const inventoryApi = {
  createPage: (input: PageInput) => post<InventoryPage>('/inventory/pages', input),
  updatePage: (slug: string, input: PageInput) => put<InventoryPage>(`/inventory/pages/${enc(slug)}`, input),
  deletePage: (slug: string) => del(`/inventory/pages/${enc(slug)}`),
  addColumn: (slug: string, input: ColumnInput) => post<InventoryPage>(`/inventory/pages/${enc(slug)}/columns`, input),
  updateColumn: (slug: string, key: string, input: ColumnInput) =>
    put<InventoryPage>(`/inventory/pages/${enc(slug)}/columns/${enc(key)}`, input),
  deleteColumn: (slug: string, key: string) => del<InventoryPage>(`/inventory/pages/${enc(slug)}/columns/${enc(key)}`),
  reorderColumns: (slug: string, keys: string[]) => put<InventoryPage>(`/inventory/pages/${enc(slug)}/columns-order`, keys),
  createRecord: (slug: string, data: Record<string, unknown>) => post<InventoryRecord>(`/inventory/pages/${enc(slug)}/records`, { data }),
  updateRecord: (slug: string, id: number, data: Record<string, unknown>) =>
    put<InventoryRecord>(`/inventory/pages/${enc(slug)}/records/${id}`, { data }),
  deleteRecords: (slug: string, ids: number[]) => post(`/inventory/pages/${enc(slug)}/records/bulk-delete`, { ids }),
  exportCsv: (slug: string) => get<string>(`/inventory/pages/${enc(slug)}/export`),
  importCsv: async (slug: string, csv: string) => {
    const { data } = await api.post<{ created: number; errors: string[] }>(`/inventory/pages/${enc(slug)}/import`, csv, {
      headers: { 'Content-Type': 'text/csv' },
    })
    return data
  },
}

export interface ViewPref {
  hidden?: string[]
}

export function useViewPref(slug: string | undefined) {
  return useQuery({
    queryKey: ['prefs', `inventory.${slug}`],
    queryFn: async () => (await get<ViewPref | ''>(`/prefs/inventory.${slug}`)) || {},
    enabled: !!slug,
    staleTime: Infinity,
  })
}

export function useSaveViewPref(slug: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pref: ViewPref) => put<ViewPref>(`/prefs/inventory.${slug}`, pref),
    onMutate: (pref) => qc.setQueryData(['prefs', `inventory.${slug}`], pref),
  })
}
