import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Tooltip } from 'radix-ui'
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { ConfirmProvider } from './components/ui/confirm'
import { ErrorState } from './components/ui/misc'
import { get } from './lib/api'
import { AuthProvider, usePublicInfo } from './lib/auth'
import type { Me } from './lib/types'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const InventoryPage = lazy(() => import('./features/inventory/InventoryPage'))
const InventoryIndex = lazy(() => import('./features/inventory/InventoryIndex'))
const KafkaPage = lazy(() => import('./features/kafka/KafkaPage'))
const ClusterPage = lazy(() => import('./features/kafka/ClusterPage'))
const AppKafkaPage = lazy(() => import('./features/appkafka/AppKafkaPage'))
const ConnectivityPage = lazy(() => import('./features/connectivity/ConnectivityPage'))
const BoardsPage = lazy(() => import('./features/boards/BoardsPage'))
const GithubPage = lazy(() => import('./features/github/GithubPage'))
const AlertsPage = lazy(() => import('./features/alerts/AlertsPage'))
const AuditPage = lazy(() => import('./features/audit/AuditPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))
const LoginPage = lazy(() => import('./features/login/LoginPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
  },
})

function FullscreenSpinner() {
  return (
    <div className="grid h-full place-items-center">
      <Loader2 className="size-6 animate-spin text-muted" />
    </div>
  )
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullscreenSpinner />}>{children}</Suspense>
}

/** Loads the signed-in user; the axios interceptor redirects to /login on 401. */
function AuthGate() {
  const info = usePublicInfo()
  const me = useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/me'), retry: false, staleTime: 5 * 60_000 })
  if (info.isLoading || me.isLoading) return <FullscreenSpinner />
  if (info.error || me.error || !info.data || !me.data) {
    return <ErrorState error={info.error ?? me.error} onRetry={() => window.location.reload()} className="h-full" />
  }
  return (
    <AuthProvider me={me.data} info={info.data}>
      <AppShell />
    </AuthProvider>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <Lazy><LoginPage /></Lazy> },
  {
    path: '/',
    element: <AuthGate />,
    children: [
      { index: true, element: <Lazy><DashboardPage /></Lazy> },
      { path: 'alerts', element: <Lazy><AlertsPage /></Lazy> },
      { path: 'inventory', element: <Lazy><InventoryIndex /></Lazy> },
      { path: 'inventory/:slug', element: <Lazy><InventoryPage /></Lazy> },
      { path: 'kafka', element: <Lazy><KafkaPage /></Lazy> },
      { path: 'kafka/:id', element: <Lazy><ClusterPage /></Lazy> },
      { path: 'kafka/:id/:tab', element: <Lazy><ClusterPage /></Lazy> },
      { path: 'app-kafka', element: <Lazy><AppKafkaPage /></Lazy> },
      { path: 'connectivity', element: <Lazy><ConnectivityPage /></Lazy> },
      { path: 'boards', element: <Lazy><BoardsPage /></Lazy> },
      { path: 'github', element: <Lazy><GithubPage /></Lazy> },
      { path: 'github/:tab', element: <Lazy><GithubPage /></Lazy> },
      { path: 'audit', element: <Lazy><AuditPage /></Lazy> },
      { path: 'settings', element: <Lazy><SettingsPage /></Lazy> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider>
        <ConfirmProvider>
          <RouterProvider router={router} />
          <Toaster
            position="bottom-right"
            theme="system"
            toastOptions={{
              className: '!bg-card !border-border !text-fg !shadow-2xl !rounded-xl',
              descriptionClassName: '!text-muted',
            }}
          />
        </ConfirmProvider>
      </Tooltip.Provider>
    </QueryClientProvider>
  )
}
