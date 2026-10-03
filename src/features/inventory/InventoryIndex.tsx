import { ArrowUpRight, Lock, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCrumbs } from '@/components/layout/crumbs'
import { pageIcon } from '@/components/layout/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState, Skeleton } from '@/components/ui/misc'
import { Page, PageHeader } from '@/components/ui/page'
import { useAuth } from '@/lib/auth'
import type { InventoryPage } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { usePages } from './api'
import { PageDialog } from './PageDialog'

export default function InventoryIndex() {
  useCrumbs([{ label: 'Inventory' }])
  const { isAdmin } = useAuth()
  const { data: pages, isLoading, error, refetch } = usePages()
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState(false)

  useEffect(() => {
    if (params.get('new') && isAdmin) {
      setDialog(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams, isAdmin])

  const groups = useMemo(() => {
    const map = new Map<string, InventoryPage[]>()
    for (const p of pages ?? []) {
      const g = p.group || 'Inventory'
      map.set(g, [...(map.get(g) ?? []), p])
    }
    return [...map.entries()]
  }, [pages])

  return (
    <Page>
      <PageHeader
        title="Inventory"
        description="Secrets, servers, IP addresses, applications, services and any other inventory you define. Pages and columns are fully customizable."
        actions={
          isAdmin && (
            <Button variant="primary" onClick={() => setDialog(true)}>
              <Plus /> New page
            </Button>
          )
        }
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}
      <div className="space-y-8">
        {groups.map(([group, items]) => (
          <section key={group}>
            <h2 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-subtle uppercase">{group}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => {
                const Icon = pageIcon(p.icon)
                return (
                  <Link key={p.slug} to={`/inventory/${p.slug}`} className="group">
                    <Card className="h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-border-strong">
                      <div className="flex items-start justify-between">
                        <span className="grid size-10 place-items-center rounded-xl bg-accent-soft">
                          <Icon className="size-5 text-accent" />
                        </span>
                        <ArrowUpRight className="size-4 text-subtle transition-colors group-hover:text-fg" />
                      </div>
                      <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold">
                        {p.name}
                        {p.system && <Lock className="size-3.5 text-subtle" />}
                      </p>
                      <p className="mt-1 line-clamp-2 min-h-9 text-[13px] text-muted">{p.description || `${p.columns.length} columns`}</p>
                      <div className="mt-4 flex items-center gap-2">
                        <Badge tone="accent">{p.recordCount} records</Badge>
                        <Badge tone="neutral">{p.columns.length} columns</Badge>
                        {p.columns.some((c) => c.expiryTracking) && <Badge tone="warning">expiry</Badge>}
                        <span className="ml-auto text-xs text-subtle">{timeAgo(p.updatedAt)}</span>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <PageDialog open={dialog} onOpenChange={setDialog} />
    </Page>
  )
}
