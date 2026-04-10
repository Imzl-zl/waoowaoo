import { Worker, type Job } from 'bullmq'
import { queueRedis } from '@/lib/redis'
import { QUEUE_NAME } from '@/lib/task/queues'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress, withTaskLifecycle } from './shared'
import { resolveTextTaskHandler } from './handlers/text-task-router'

async function processTextTask(job: Job<TaskJobData>) {
  await reportTaskProgress(job, 5, { stage: 'received' })
  return await resolveTextTaskHandler(job.data.type)(job)
}

export function createTextWorker() {
  return new Worker<TaskJobData>(
    QUEUE_NAME.TEXT,
    async (job) => await withTaskLifecycle(job, processTextTask),
    {
      connection: queueRedis,
      concurrency: Number.parseInt(process.env.QUEUE_CONCURRENCY_TEXT || '10', 10) || 10,
    },
  )
}
