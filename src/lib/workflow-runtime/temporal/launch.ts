import { recordTemporalWorkflowStart } from '@/lib/run-runtime/service'
import {
  startTemporalWorkflowRun,
  type StartManagedTemporalWorkflowRunParams,
} from './starter'
import type { TemporalWorkflowStartResult } from './types'

export type TemporalRunRecorder = (
  startResult: TemporalWorkflowStartResult,
) => Promise<unknown>

export type TemporalRunStarter = (
  params: StartManagedTemporalWorkflowRunParams,
) => Promise<TemporalWorkflowStartResult>

export type LaunchTemporalWorkflowRunParams = StartManagedTemporalWorkflowRunParams & Readonly<{
  startWorkflow?: TemporalRunStarter
  recordWorkflowStart?: TemporalRunRecorder
}>

export type TemporalWorkflowLaunchResult = Readonly<{
  start: TemporalWorkflowStartResult
  recorded: unknown
}>

export async function launchTemporalWorkflowRun(
  params: LaunchTemporalWorkflowRunParams,
): Promise<TemporalWorkflowLaunchResult> {
  const {
    startWorkflow = startTemporalWorkflowRun,
    recordWorkflowStart = recordTemporalWorkflowStart,
    ...startParams
  } = params
  const start = await startWorkflow(startParams)
  const recorded = await recordWorkflowStart(start)
  return { start, recorded }
}
