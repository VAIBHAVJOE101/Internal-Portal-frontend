import { clsx, type ClassValue } from 'clsx'
import { formatDistanceToNowStrict } from 'date-fns'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(value?: string | null) {
  if (!value) return '—'
  try {
    return formatDistanceToNowStrict(new Date(value), { addSuffix: true })
  } catch {
    return value
  }
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function compact(n?: number | null) {
  if (n === null || n === undefined) return '—'
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function number(n?: number | null) {
  if (n === null || n === undefined) return '—'
  return Intl.NumberFormat().format(n)
}

export function duration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function msToHuman(ms?: string | number | null) {
  if (ms === null || ms === undefined || ms === '') return '—'
  const n = Number(ms)
  if (Number.isNaN(n)) return String(ms)
  if (n < 0) return 'Infinite'
  const units: [number, string][] = [
    [86_400_000, 'd'],
    [3_600_000, 'h'],
    [60_000, 'm'],
    [1000, 's'],
  ]
  for (const [size, label] of units) {
    if (n >= size && n % size === 0) return `${n / size}${label}`
  }
  for (const [size, label] of units) {
    if (n >= size) return `${(n / size).toFixed(1)}${label}`
  }
  return `${n}ms`
}

export function downloadText(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** Stable pleasant hue for avatars / chips derived from a string. */
export function hue(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}
