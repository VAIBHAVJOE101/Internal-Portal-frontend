import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem('portal.theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // storage may be unavailable
  }
  return 'dark'
}

export function applyStoredTheme() {
  document.documentElement.dataset.theme = readTheme()
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('portal.theme', theme)
    } catch {
      // ignore
    }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}

/** Small per-browser preference helper (collapsed sidebar, selected tabs...). */
export function useLocalPref<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('portal.' + key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('portal.' + key, JSON.stringify(value))
    } catch {
      // ignore
    }
  }, [key, value])
  return [value, setValue] as const
}
