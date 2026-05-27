import type { WorkflowNodeTypeRegistration } from './canvas-types'

export const MAIN_INPUT = {
  key: 'in',
  label: 'Input',
  direction: 'input',
  dataTypes: ['any'],
} as const

export const MAIN_OUTPUT = {
  key: 'out',
  label: 'Output',
  direction: 'output',
  dataTypes: ['any'],
} as const

export const NO_STEP = {
  producesStep: false,
  retryable: false,
  artifactTypes: [],
  failureMode: 'fail_run',
} as const

export function stepRuntime(artifactTypes: readonly string[] = []) {
  return {
    producesStep: true,
    retryable: true,
    artifactTypes,
    failureMode: 'fail_run',
  } as const
}

export function productionNode(input: {
  type: string
  label: string
  artifactType: string
  configSchema: WorkflowNodeTypeRegistration['configSchema']
}): WorkflowNodeTypeRegistration {
  return {
    type: input.type,
    label: input.label,
    category: 'production',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: input.configSchema,
    runtime: stepRuntime([input.artifactType]),
  }
}
