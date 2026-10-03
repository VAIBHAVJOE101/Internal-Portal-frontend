import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, Database, Eye, EyeOff, KeyRound, Lock, Plug, Plus, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { toast } from 'sonner'
import { useCrumbs } from '@/components/layout/crumbs'
import { BoardsIcon, GithubIcon } from '@/components/layout/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { ErrorState, Skeleton } from '@/components/ui/misc'
import { Page, PageHeader } from '@/components/ui/page'
import { del, errorMessage, get, post, put } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { SettingView } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

const MASK = '********'
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  GITHUB: GithubIcon,
  AZURE_DEVOPS: BoardsIcon,
  COSMOS: Database,
  NOTIFICATIONS: Bell,
  KAFKA_CREDENTIAL: KeyRound,
}

export default function SettingsPage() {
  useCrumbs([{ label: 'Settings' }])
  const { isAdmin, info } = useAuth()
  const [newCred, setNewCred] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['settings'], queryFn: () => get<SettingView[]>('/settings') })
  const integrations = data?.filter((s) => s.type !== 'KAFKA_CREDENTIAL') ?? []
  const credentials = data?.filter((s) => s.type === 'KAFKA_CREDENTIAL') ?? []

  return (
    <Page className="max-w-[1100px]">
      <PageHeader
        title="Settings"
        description="Credentials and configuration for integrations. Secrets are encrypted at rest with AES-256-GCM, never sent back to the browser and every change is audited."
        meta={
          <>
            <Badge tone="success"><ShieldCheck className="size-3" /> Encrypted at rest</Badge>
            <Badge>mode: {info.mode}</Badge>
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-96" />}
      {!isAdmin && data && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted">
          <Lock className="size-4" /> You have read-only access. Members of the {info.adminTeam} team can change settings.
        </div>
      )}
      <div className="space-y-5">
        {integrations.map((s) => <IntegrationCard key={s.key} setting={s} />)}

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">Kafka credentials</h2>
              <p className="text-[13px] text-muted">Referenced by the <span className="font-mono">credentialRef</span> column of Inventory → Kafka Instances.</p>
            </div>
            {isAdmin && <Button onClick={() => setNewCred(true)}><Plus /> Add credential</Button>}
          </div>
          <div className="space-y-3">
            {credentials.map((s) => <IntegrationCard key={s.key} setting={s} deletable />)}
            {credentials.length === 0 && data && (
              <Card className="px-5 py-8 text-center text-[13px] text-muted">No Kafka credentials stored. PLAINTEXT clusters do not need one.</Card>
            )}
          </div>
        </section>
      </div>
      <NewCredentialDialog open={newCred} onOpenChange={setNewCred} />
    </Page>
  )
}

function IntegrationCard({ setting, deletable }: { setting: SettingView; deletable?: boolean }) {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [values, setValues] = useState<Record<string, string>>(setting.values)
  const [reveal, setReveal] = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; latencyMs: number; details?: Record<string, unknown> } | null>(null)
  useEffect(() => setValues(setting.values), [setting.values])
  const dirty = Object.keys(values).some((k) => values[k] !== setting.values[k])
  const Icon = ICONS[setting.type] ?? Plug

  const save = useMutation({
    mutationFn: () => put<SettingView>(`/settings/${setting.type}/${encodeURIComponent(setting.key)}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success(`${setting.label} saved`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const test = useMutation({
    mutationFn: () => post<{ success: boolean; message?: string; latencyMs: number; details?: Record<string, unknown> }>(`/settings/${setting.type}/test`),
    onSuccess: setTestResult,
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => del(`/settings/${encodeURIComponent(setting.key)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Credential deleted')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 place-items-center rounded-lg bg-card-2"><Icon className="size-4.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            {setting.type === 'KAFKA_CREDENTIAL' ? <span className="font-mono">{setting.key}</span> : setting.label}
            {setting.configured ? <Badge tone="success" dot>configured</Badge> : <Badge tone="warning" dot>incomplete</Badge>}
          </p>
          <p className="text-xs text-muted">{setting.updatedAt ? `Updated ${timeAgo(setting.updatedAt)} by ${setting.updatedBy}` : 'Using environment defaults'}</p>
        </div>
        {setting.testable && (
          <Button onClick={() => test.mutate()} loading={test.isPending}>
            <Plug /> Test connection
          </Button>
        )}
        {deletable && isAdmin && (
          <Button
            variant="danger-ghost"
            onClick={async () => {
              if (await confirm({ title: `Delete credential ${setting.key}?`, description: 'Kafka instances referencing it will fail to authenticate.', danger: true, confirmText: 'Delete', typeToConfirm: setting.key })) remove.mutate()
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {testResult && (
        <div className={cn('flex items-start gap-2 border-b px-5 py-2.5 text-[13px]', testResult.success ? 'border-success/30 bg-success-soft text-success' : 'border-danger/30 bg-danger-soft text-danger')}>
          {testResult.success ? <CheckCircle2 className="mt-px size-4" /> : <XCircle className="mt-px size-4" />}
          <span className="flex-1">
            {testResult.success ? 'Connection succeeded' : testResult.message}
            {testResult.details && <span className="ml-2 font-mono text-xs opacity-80">{Object.entries(testResult.details).map(([k, v]) => `${k}=${String(v)}`).join(' · ')}</span>}
          </span>
          <span className="text-xs opacity-70">{testResult.latencyMs} ms</span>
        </div>
      )}
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {setting.fields.map((f) => (
          <Field key={f.key} label={f.label} required={f.required} hint={f.help}>
            <div className="relative">
              <Input
                type={f.secret && !reveal[f.key] ? 'password' : 'text'}
                value={values[f.key] ?? ''}
                disabled={!isAdmin}
                placeholder={f.secret && setting.secretsSet[f.key] ? 'stored – type to replace' : f.placeholder}
                onFocus={() => f.secret && values[f.key] === MASK && setValues((v) => ({ ...v, [f.key]: '' }))}
                onBlur={() => f.secret && values[f.key] === '' && setting.secretsSet[f.key] && setValues((v) => ({ ...v, [f.key]: MASK }))}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className={cn(f.secret && 'pr-9 font-mono')}
                autoComplete="off"
              />
              {f.secret && values[f.key] && values[f.key] !== MASK && (
                <button type="button" onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted hover:text-fg" aria-label="Toggle visibility">
                  {reveal[f.key] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              )}
              {f.secret && setting.secretsSet[f.key] && values[f.key] === MASK && <Lock className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-success" />}
            </div>
          </Field>
        ))}
      </div>
      {isAdmin && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" disabled={!dirty} onClick={() => setValues(setting.values)}>Discard</Button>
          <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </div>
      )}
    </Card>
  )
}

function NewCredentialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [key, setKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  useEffect(() => {
    if (open) {
      setKey('')
      setUsername('')
      setPassword('')
    }
  }, [open])
  const save = useMutation({
    mutationFn: () => put(`/settings/KAFKA_CREDENTIAL/${encodeURIComponent(key)}`, { username, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Credential stored')
      onOpenChange(false)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Kafka credential"
      description="Use the reference name in the credentialRef column of a Kafka instance."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!/^[A-Za-z0-9._-]{2,100}$/.test(key)} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reference name" required hint="e.g. kafka-prod">
          <Input autoFocus value={key} onChange={(e) => setKey(e.target.value)} className="font-mono" />
        </Field>
        <Field label="SASL username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="SASL password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
    </Dialog>
  )
}
