import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import {
  Bell,
  LayoutDashboard,
  Moon,
  Radar,
  Route,
  ScrollText,
  Search,
  Settings,
  Waypoints,
} from 'lucide-react'
import { Dialog as RadixDialog } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { get } from '@/lib/api'
import type { InstanceCard } from '@/lib/types'
import { BoardsIcon, GithubIcon, pageIcon } from './icons'
import { useInventoryPages } from './Sidebar'

export function CommandPalette({ open, onOpenChange, onToggleTheme }: { open: boolean; onOpenChange: (o: boolean) => void; onToggleTheme: () => void }) {
  const navigate = useNavigate()
  const { data: pages } = useInventoryPages()
  const { data: kafka } = useQuery({
    queryKey: ['kafka', 'instances'],
    queryFn: () => get<InstanceCard[]>('/kafka/instances'),
    enabled: open,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const go = (to: string) => {
    navigate(to)
    onOpenChange(false)
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <RadixDialog.Content className="fixed top-[14vh] left-1/2 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl data-[state=open]:animate-fade-in">
          <RadixDialog.Title className="sr-only">Command palette</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">Jump to any page, inventory, Kafka cluster or action</RadixDialog.Description>
          <Command loop className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-subtle [&_[cmdk-group-heading]]:uppercase">
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 text-muted" />
              <Command.Input
                autoFocus
                placeholder="Search pages, inventory, clusters…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              />
            </div>
            <Command.List className="max-h-[380px] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted">No results.</Command.Empty>
              <Command.Group heading="Navigate">
                <Item icon={<LayoutDashboard />} onSelect={() => go('/')}>Dashboard</Item>
                <Item icon={<Bell />} onSelect={() => go('/alerts')}>Alerts</Item>
                <Item icon={<Waypoints />} onSelect={() => go('/kafka')}>Kafka clusters</Item>
                <Item icon={<Route />} onSelect={() => go('/app-kafka')}>App Kafka Portal</Item>
                <Item icon={<Radar />} onSelect={() => go('/connectivity')}>Connectivity tests</Item>
                <Item icon={<BoardsIcon />} onSelect={() => go('/boards')}>Azure Boards – current sprint</Item>
                <Item icon={<GithubIcon />} onSelect={() => go('/github')}>GitHub workflows</Item>
                <Item icon={<GithubIcon />} onSelect={() => go('/github/teams')}>GitHub teams</Item>
                <Item icon={<ScrollText />} onSelect={() => go('/audit')}>Audit logs</Item>
                <Item icon={<Settings />} onSelect={() => go('/settings')}>Settings</Item>
              </Command.Group>
              {!!pages?.length && (
                <Command.Group heading="Inventory">
                  {pages.map((p) => {
                    const Icon = pageIcon(p.icon)
                    return (
                      <Item key={p.slug} icon={<Icon />} onSelect={() => go(`/inventory/${p.slug}`)} hint={`${p.recordCount} records`}>
                        {p.name}
                      </Item>
                    )
                  })}
                </Command.Group>
              )}
              {!!kafka?.length && (
                <Command.Group heading="Kafka clusters">
                  {kafka.map((k) => (
                    <Item key={k.instance.id} icon={<Waypoints />} onSelect={() => go(`/kafka/${k.instance.id}`)} hint={k.instance.environment}>
                      {k.instance.name}
                    </Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Actions">
                <Item
                  icon={<Moon />}
                  onSelect={() => {
                    onToggleTheme()
                    onOpenChange(false)
                  }}
                >
                  Toggle light / dark theme
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

function Item({ icon, children, onSelect, hint }: { icon: ReactNode; children: ReactNode; onSelect: () => void; hint?: string }) {
  const [value] = useState(() => (typeof children === 'string' ? children : undefined))
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-fg data-[selected=true]:bg-hover [&_svg]:size-4 [&_svg]:text-muted"
    >
      {icon}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </Command.Item>
  )
}
