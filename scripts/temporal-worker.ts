import 'dotenv/config'
import { logError } from '@/lib/logging/core'
import { runTemporalWorker } from '@/lib/workflow-runtime/temporal/worker'

runTemporalWorker().catch((error: unknown) => {
  logError('[TemporalWorker] failed', error)
  process.exit(1)
})

