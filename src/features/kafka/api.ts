import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/api'

export const kafkaBase = (id: string | number) => `/kafka/instances/${id}`

/** Mutation that toasts the outcome and refreshes all Kafka queries for the instance. */
export function useKafkaMutation<TVars, TResult = unknown>(
  id: string | number,
  fn: (vars: TVars) => Promise<TResult>,
  success?: string | ((vars: TVars) => string),
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['kafka', String(id)] })
      qc.invalidateQueries({ queryKey: ['kafka', 'instances'] })
      if (success) toast.success(typeof success === 'function' ? success(vars) : success)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export const RETENTION_PRESETS = [
  { label: '1 hour', value: '3600000' },
  { label: '1 day', value: '86400000' },
  { label: '3 days', value: '259200000' },
  { label: '7 days', value: '604800000' },
  { label: '14 days', value: '1209600000' },
  { label: '30 days', value: '2592000000' },
  { label: 'Infinite', value: '-1' },
]

/** Commonly edited topic configs, surfaced first in the editor. */
export const KEY_CONFIGS = [
  'retention.ms',
  'retention.bytes',
  'cleanup.policy',
  'min.insync.replicas',
  'max.message.bytes',
  'segment.ms',
  'compression.type',
]
