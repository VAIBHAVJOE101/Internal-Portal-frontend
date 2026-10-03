import { ChevronRight, LogOut, Menu as MenuIcon, Moon, Search, Sun, UserRound } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Link, Outlet } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Avatar, Kbd, Menu, Tooltip } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLocalPref, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { AlertBell } from './AlertBell'
import { CommandPalette } from './CommandPalette'
import { CrumbsProvider, useCrumbsValue } from './crumbs'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [collapsed, setCollapsed] = useLocalPref('nav.collapsed', false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <CrumbsProvider>
      <div className="flex h-full">
        {/* desktop sidebar */}
        <div className="hidden h-full shrink-0 lg:block">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>
        {/* mobile sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="relative h-full w-[248px] animate-fade-in">
              <Sidebar collapsed={false} onToggle={() => {}} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} theme={theme} onToggleTheme={toggle} />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onToggleTheme={toggle} />
    </CrumbsProvider>
  )
}

function Topbar({
  onMenu,
  onSearch,
  theme,
  onToggleTheme,
}: {
  onMenu: () => void
  onSearch: () => void
  theme: string
  onToggleTheme: () => void
}) {
  const { me, info } = useAuth()
  const crumbs = useCrumbsValue()

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button type="button" onClick={onMenu} className="rounded-lg p-1.5 text-muted hover:bg-hover lg:hidden" aria-label="Open menu">
        <MenuIcon className="size-5" />
      </button>

      <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-subtle" />}
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate text-muted hover:text-fg">
                {c.label}
              </Link>
            ) : (
              <span className={cn('truncate', i === crumbs.length - 1 ? 'font-medium text-fg' : 'text-muted')}>{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>

      <button
        type="button"
        onClick={onSearch}
        className="hidden h-8.5 w-64 items-center gap-2 rounded-lg border border-border bg-card/60 px-3 text-[13px] text-subtle transition-colors hover:border-border-strong hover:text-muted md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <button type="button" onClick={onSearch} className="rounded-lg p-2 text-muted hover:bg-hover md:hidden" aria-label="Search">
        <Search className="size-4" />
      </button>

      {info.mode === 'mock' && (
        <Tooltip content="Integrations are simulated with seeded demo data">
          <span>
            <Badge tone="violet" className="hidden sm:inline-flex">Demo mode</Badge>
          </span>
        </Tooltip>
      )}

      <Tooltip content={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
        <button
          type="button"
          onClick={onToggleTheme}
          className="grid size-8.5 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
        </button>
      </Tooltip>
      <AlertBell />

      <Menu
        trigger={
          <button type="button" className="flex items-center gap-2 rounded-full p-0.5 pr-0.5 hover:bg-hover sm:pr-2" aria-label="Account">
            <Avatar name={me.name || me.username} src={me.avatarUrl} size={30} />
            <span className="hidden text-left sm:block">
              <span className="block text-[12.5px] leading-tight font-medium">{me.name || me.username}</span>
              <span className="block text-[11px] leading-tight text-muted">{me.role === 'ADMIN' ? 'Admin' : 'Reader'}</span>
            </span>
          </button>
        }
        items={[
          ...(me.profileUrl
            ? [{ label: `@${me.username} on GitHub`, icon: UserRound, onSelect: () => window.open(me.profileUrl, '_blank') }]
            : [{ label: `Signed in as ${me.username}`, icon: UserRound, onSelect: () => {}, disabled: true }]),
          { label: 'Sign out', icon: LogOut, onSelect: logout, separatorBefore: true, danger: true },
        ]}
      />
    </header>
  )
}
