import type {
  TemporalPublishedWorkflowStep,
  TemporalWorkflowStepDescriptor,
} from '@/lib/workflow-runtime/temporal/types'
import type { WorkflowFailureMode } from './canvas-types'

export type PublishedWorkflowExecutionPlanDiagnosticCode =
  | 'WORKFLOW_NODE_RUNTIME_UNSUPPORTED'
  | 'WORKFLOW_NODE_RUNTIME_INVALID_DEPENDENCY'
  | 'WORKFLOW_EXECUTION_PLAN_EMPTY'

export type PublishedWorkflowExecutionPlanDiagnostic = Readonly<{
  code: PublishedWorkflowExecutionPlanDiagnosticCode
  message: string
  nodeId?: string
  nodeType?: string
  stepKey?: string
}>

export type PublishedWorkflowExecutionPlanStep = Readonly<{
  nodeId: string
  nodeType: string
  nodeTitle: string
  stepKey: string
  dependsOn: readonly string[]
  config: Readonly<Record<string, unknown>>
  retryable: boolean
  artifactTypes: readonly string[]
  failureMode: WorkflowFailureMode
  supported: boolean
  supportReason?: string
  temporalStep: TemporalWorkflowStepDescriptor
  publishedWorkflowStep: TemporalPublishedWorkflowStep
}>

export type PublishedWorkflowExecutionPlan = Readonly<{
  workflowDefinitionId: string
  workflowDefinitionVersionId: string
  workflowType: string
  title: string
  version: number
  executable: boolean
  steps: readonly PublishedWorkflowExecutionPlanStep[]
  temporalSteps: readonly TemporalWorkflowStepDescriptor[]
  publishedWorkflowSteps: readonly TemporalPublishedWorkflowStep[]
  diagnostics: readonly PublishedWorkflowExecutionPlanDiagnostic[]
  unsupportedNodes: readonly PublishedWorkflowExecutionPlanDiagnostic[]
}>
