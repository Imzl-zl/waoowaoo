import { NativeConnection, Worker } from '@temporalio/worker'
import { createScopedLogger } from '@/lib/logging/core'
import { resolveTemporalRuntimeConfig } from './config'
import { activities } from './activities'

const logger = createScopedLogger({ module: 'workflow-runtime.temporal.worker' })

export async function createTemporalWorker() {
  const config = resolveTemporalRuntimeConfig()
  const connection = await NativeConnection.connect({
    address: config.address,
  })
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  })
  return { worker, connection, config }
}

export async function runTemporalWorker() {
  const { worker, connection, config } = await createTemporalWorker()
  logger.info({
    action: 'temporal.worker.start',
    message: 'Temporal worker starting',
    details: config,
  })
  try {
    await worker.run()
  } finally {
    await connection.close()
  }
}

