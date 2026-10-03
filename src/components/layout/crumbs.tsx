import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface Crumb {
  label: string
  to?: string
}

const CrumbsContext = createContext<{ crumbs: Crumb[]; setCrumbs: (c: Crumb[]) => void }>({
  crumbs: [],
  setCrumbs: () => {},
})

export function CrumbsProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  return <CrumbsContext.Provider value={{ crumbs, setCrumbs }}>{children}</CrumbsContext.Provider>
}

export function useCrumbsValue() {
  return useContext(CrumbsContext).crumbs
}

/** Pages declare their breadcrumb trail; the top bar renders it. */
export function useCrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useContext(CrumbsContext)
  const key = JSON.stringify(crumbs)
  useEffect(() => {
    setCrumbs(JSON.parse(key) as Crumb[])
    document.title = [...(JSON.parse(key) as Crumb[])].reverse().map((c) => c.label).concat('Platform Portal').join(' · ')
  }, [key, setCrumbs])
}
