import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import WorkflowRunStatePanel from '@/app/[locale]/workspace/[projectId]/workflows/components/WorkflowRunStatePanel'
import type { RunStepState } from '@/lib/query/hooks/run-stream/types'

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    key,
  )
}

function step(overrides: Partial<RunStepState> = {}): RunStepState {
  return {
    id: 'draft',
    attempt: 1,
    title: 'Draft copy',
    stepIndex: 1,
    stepTotal: 2,
    status: 'running',
    dependsOn: [],
    blockedBy: [],
    groupId: null,
    parallelKey: null,
    retryable: true,
    textOutput: '',
    reasoningOutput: '',
    textLength: 0,
    reasoningLength: 0,
    message: 'provider running',
    errorMessage: '',
    updatedAt: 0,
    seqByLane: { text: 0, reasoning: 0 },
    ...overrides,
  }
}

describe('WorkflowRunStatePanel', () => {
  it('renders run and ordered step state for a visual workflow execution', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      createElement(WorkflowRunStatePanel, {
        runId: 'run-visual-1',
        status: 'running',
        activeMessage: 'provider running',
        overallProgress: 25,
        orderedSteps: [
          step(),
          step({
            id: 'persist',
            title: 'Persist artifact',
            stepIndex: 2,
            status: 'completed',
            textOutput: 'artifact saved',
            textLength: 14,
          }),
        ],
        outputText: 'artifact saved',
        errorMessage: '',
        onSelectStep: () => undefined,
        t,
      }),
    )

    expect(html).toContain('run-visual-1')
    expect(html).toContain('Draft copy')
    expect(html).toContain('Persist artifact')
    expect(html).toContain('runStatusRunning')
    expect(html).toContain('artifact saved')
  })

  it('shows an explicit waiting state before lifecycle rows arrive', () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowRunStatePanel, {
        runId: 'run-visual-2',
        status: 'running',
        activeMessage: '',
        overallProgress: 0,
        orderedSteps: [],
        outputText: '',
        errorMessage: '',
        onSelectStep: () => undefined,
        t,
      }),
    )

    expect(html).toContain('runWaitingEvents')
  })
})
