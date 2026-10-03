import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  Boxes,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Plus,
  Radar,
  Route,
  ScrollText,
  Settings,
  Waypoints,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { Tooltip } from '@/components/ui/misc'
import { get } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLocalPref } from '@/lib/theme'
import type { AlertSummary, InventoryPage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BoardsIcon, GithubIcon, pageIcon } from './icons'

type IconType = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>

interface NavItem {
  to: string
  label: string
  icon: IconType
  badge?: number | null
  badgeTone?: 'danger' | 'neutral'
}

export function useInventoryPages() {
  return useQuery({ queryKey: ['inventory', 'pages'], queryFn: () => get<InventoryPage[]>('/inventory/pages') })
}

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const { info, isAdmin } = useAuth()
  const { data: pages } = useInventoryPages()
  const { data: alertSummary } = useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: () => get<AlertSummary>('/alerts/summary'),
    refetchInterval: 60_000,
  })
  const [inventoryOpen, setInventoryOpen] = useLocalPref('nav.inventoryOpen', true)
  const location = useLocation()
  const navigate = useNavigate()

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Overview',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/alerts', label: 'Alerts', icon: Bell, badge: alertSummary?.active || null, badgeTone: alertSummary?.critical ? 'danger' : 'neutral' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/kafka', label: 'Kafka', icon: Waypoints },
        { to: '/app-kafka', label: 'App Kafka Portal', icon: Route },
        { to: '/connectivity', label: 'Connectivity', icon: Radar },
      ],
    },
    {
      title: 'Integrations',
      items: [
        { to: '/boards', label: 'Azure Boards', icon: BoardsIcon },
        { to: '/github', label: 'GitHub', icon: GithubIcon },
      ],
    },
    {
      title: 'Governance',
      items: [
        { to: '/audit', label: 'Audit logs', icon: ScrollText },
        { to: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  const inventoryActive = location.pathname.startsWith('/inventory')

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-panel transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      {/* brand */}
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent to-violet shadow-[0_4px_14px_-4px_var(--accent)]">
          <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
            <path d="M9 11.5 16 7.5l7 4v9l-7 4-7-4z M16 15.5v9 M9 11.5l7 4 7-4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[14px] leading-tight font-semibold">Platform Portal</p>
            <p className="truncate text-[11px] text-muted">DevOps · {info.environment}</p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-4">
        <NavSection title="Overview" collapsed={collapsed}>
          {sections[0]!.items.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </NavSection>

        <NavSection title="Inventory" collapsed={collapsed}>
          {collapsed ? (
            (pages ?? []).map((p) => (
              <NavRow
                key={p.slug}
                item={{ to: `/inventory/${p.slug}`, label: p.name, icon: pageIcon(p.icon) }}
                collapsed
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <>
              <button
                type="button"
                onClick={() => setInventoryOpen(!inventoryOpen)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-muted transition-colors hover:bg-hover hover:text-fg',
                  inventoryActive && !inventoryOpen && 'text-fg',
                )}
              >
                <Boxes className="size-4" />
                <span className="flex-1 text-left">All inventory</span>
                <span className="text-[11px] text-subtle tabular">{pages?.length ?? ''}</span>
                <ChevronDown className={cn('size-3.5 transition-transform', !inventoryOpen && '-rotate-90')} />
              </button>
              {inventoryOpen && (
                <div className="relative mt-0.5 ml-[18px] space-y-0.5 border-l border-border pl-2.5">
                  {(pages ?? []).map((p) => (
                    <NavLink
                      key={p.slug}
                      to={`/inventory/${p.slug}`}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] transition-colors',
                          isActive ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-hover hover:text-fg',
                        )
                      }
                    >
                      {(() => {
                        const Icon = pageIcon(p.icon)
                        return <Icon className="size-3.5 shrink-0 opacity-80" />
                      })()}
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-[11px] text-subtle tabular">{p.recordCount}</span>
                    </NavLink>
                  ))}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/inventory?new=1')
                        onNavigate?.()
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-subtle transition-colors hover:bg-hover hover:text-fg"
                    >
                      <Plus className="size-3.5" />
                      New page
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </NavSection>

        {sections.slice(1).map((section) => (
          <NavSection key={section.title} title={section.title} collapsed={collapsed}>
            {section.items.map((item) => (
              <NavRow key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </NavSection>
        ))}
      </nav>

      <div className={cn('shrink-0 border-t border-border p-3', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={onToggle}
          className="hidden w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-hover hover:text-fg lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  )
}

function NavSection({ title, collapsed, children }: { title: string; collapsed: boolean; children: ReactNode }) {
  return (
    <div>
      {collapsed ? (
        <div className="mx-auto mb-2 h-px w-6 bg-border" />
      ) : (
        <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-subtle uppercase">{title}</p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function NavRow({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent-soft text-fg before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-accent'
            : 'text-muted hover:bg-hover hover:text-fg',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!!item.badge && (
        <span
          className={cn(
            'grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10.5px] font-semibold tabular',
            item.badgeTone === 'danger' ? 'bg-danger text-white' : 'bg-card-2 text-muted',
            collapsed && 'absolute top-0.5 right-1.5',
          )}
        >
          {item.badge}
        </span>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}
