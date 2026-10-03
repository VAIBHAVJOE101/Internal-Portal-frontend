import { AlertTriangle } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from './button'
import { Dialog } from './dialog'
import { Input } from './input'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmText?: string
  danger?: boolean
  /** When set, the user must type this exact text before confirming (destructive operations). */
  typeToConfirm?: string
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm() {
  const fn = useContext(ConfirmContext)
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return fn
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef<(v: boolean) => void>(undefined)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setTyped('')
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    resolver.current?.(result)
    resolver.current = undefined
    setOptions(null)
  }

  const blocked = !!options?.typeToConfirm && typed !== options.typeToConfirm

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!options}
        onOpenChange={(o) => !o && close(false)}
        title={
          <span className="flex items-center gap-2">
            {options?.danger && <AlertTriangle className="size-4 text-danger" />}
            {options?.title}
          </span>
        }
        className="w-[min(460px,calc(100vw-32px))]"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={options?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)} autoFocus={!options?.typeToConfirm}>
              {options?.confirmText ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[13px] text-muted">
          {options?.description}
          {options?.typeToConfirm && (
            <div className="space-y-1.5">
              <p>
                Type <span className="rounded bg-card-2 px-1.5 py-0.5 font-mono text-fg">{options.typeToConfirm}</span> to confirm.
              </p>
              <Input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !blocked && close(true)}
                className="font-mono"
              />
            </div>
          )}
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
