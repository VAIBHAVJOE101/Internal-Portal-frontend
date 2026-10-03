import { useMutation } from '@tanstack/react-query'
import { Send, SquareTerminal } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { EmptyState, JsonView } from '@/components/ui/misc'
import { errorMessage, post } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { RawResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { kafkaBase } from './api'

const PRESETS: { method: string; path: string; label: string; body?: string }[] = [
  { method: 'GET', path: '/', label: 'Worker info' },
  { method: 'GET', path: '/connectors?expand=status', label: 'List connectors with status' },
  { method: 'GET', path: '/connector-plugins', label: 'Installed plugins' },
  { method: 'GET', path: '/connectors/{name}/status', label: 'Connector status' },
  { method: 'GET', path: '/connectors/{name}/config', label: 'Connector config' },
  { method: 'POST', path: '/connectors/{name}/restart?includeTasks=true&onlyFailed=true', label: 'Restart failed tasks' },
  { method: 'PUT', path: '/connectors/{name}/pause', label: 'Pause connector' },
  { method: 'PUT', path: '/connectors/{name}/resume', label: 'Resume connector' },
  { method: 'DELETE', path: '/connectors/{name}', label: 'Delete connector' },
  { method: 'POST', path: '/connectors', label: 'Create connector', body: '{\n  "name": "my-sink",\n  "config": {\n    "connector.class": "",\n    "tasks.max": "1",\n    "topics": ""\n  }\n}' },
]

const METHOD_TONE: Record<string, string> = { GET: 'text-success', POST: 'text-accent', PUT: 'text-warning', DELETE: 'text-danger' }

/** Raw access to the Kafka Connect REST API of this instance (ADMIN only, audited). */
export function ConsoleTab({ id, connectUrls }: { id: string; connectUrls: string[] }) {
  const { isAdmin } = useAuth()
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/connectors?expand=status')
  const [body, setBody] = useState('')
  const [history, setHistory] = useState<(RawResponse & { method: string; path: string })[]>([])

  const send = useMutation({
    mutationFn: () => {
      let parsed: unknown = undefined
      if (body.trim() && method !== 'GET') parsed = JSON.parse(body)
      return post<RawResponse>(`${kafkaBase(id)}/connect/raw`, { method, path, body: parsed })
    },
    onSuccess: (r) => setHistory((h) => [{ ...r, method, path }, ...h].slice(0, 10)),
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!isAdmin) {
    return <Card><EmptyState icon={SquareTerminal} title="Admins only" description="The REST console can modify connectors, so it is restricted to the DevOps admin team." /></Card>
  }
  if (!connectUrls.length) {
    return <Card><EmptyState icon={SquareTerminal} title="No Connect / sink IPs" description="Add Kafka Connect URLs for this instance in Inventory." /></Card>
  }

  const last = history[0]
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <Card>
          <CardHeader icon={SquareTerminal} title="Request" description={`Sent to ${connectUrls.join(', ')} with failover. Every non-GET call is audited.`} />
          <CardBody className="space-y-3">
            <div className="flex gap-2">
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className={cn('w-28 font-mono font-semibold', METHOD_TONE[method])}>
                {['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
              </Select>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send.mutate()}
                className="flex-1 font-mono"
                spellCheck={false}
              />
              <Button variant="primary" onClick={() => send.mutate()} loading={send.isPending}>
                <Send /> Send
              </Button>
            </div>
            {method !== 'GET' && (
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="JSON body (optional)" spellCheck={false} className="min-h-32 font-mono text-[12px]" />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Response"
            actions={
              last && (
                <div className="flex items-center gap-2">
                  <Badge tone={last.status < 300 ? 'success' : last.status < 500 ? 'warning' : 'danger'}>{last.status}</Badge>
                  <span className="text-xs text-muted">{last.latencyMs} ms</span>
                </div>
              )
            }
          />
          <CardBody>
            {last ? (
              <>
                <p className="mb-2 truncate font-mono text-xs text-subtle">{last.method} {last.url}</p>
                <JsonView value={last.body ?? '(empty body)'} className="max-h-[480px]" />
              </>
            ) : (
              <p className="text-[13px] text-subtle">Send a request to see the response.</p>
            )}
          </CardBody>
        </Card>
      </div>
      <div className="space-y-5">
        <Card>
          <CardHeader title="Presets" description="Replace {name} with a connector" />
          <div className="border-t border-border p-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setMethod(p.method)
                  setPath(p.path)
                  setBody(p.body ?? '')
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-hover"
              >
                <span className={cn('w-12 font-mono text-[10.5px] font-semibold', METHOD_TONE[p.method])}>{p.method}</span>
                {p.label}
              </button>
            ))}
          </div>
        </Card>
        {history.length > 1 && (
          <Card>
            <CardHeader title="History" />
            <div className="border-t border-border p-2">
              {history.map((h, i) => (
                <button key={i} type="button" onClick={() => { setMethod(h.method); setPath(h.path) }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-hover">
                  <span className={cn('w-12 font-mono font-semibold', METHOD_TONE[h.method])}>{h.method}</span>
                  <span className="flex-1 truncate font-mono">{h.path}</span>
                  <span className={cn('tabular', h.status < 300 ? 'text-success' : 'text-danger')}>{h.status}</span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
