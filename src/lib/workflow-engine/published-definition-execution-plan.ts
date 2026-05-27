import { ApiError } from '@/lib/api-errors'
import { compileWorkflowCanvasDefinition } from './canvas-compiler'
import type { WorkflowCanvasNode, WorkflowDefinition, WorkflowStepDefinition } from './canvas-types'
import type { WorkflowDefinitionVersionDetail, WorkflowTypeParams } from './definition-store-types'
import { getProjectPublishedWorkflowDefinitionVersion } from './definition-store'
import type {
  PublishedWorkflowExecutionPlan,
  PublishedWorkflowExecutionPlanDiagnostic,
  PublishedWorkflowExecutionPlanStep,
} from './execution-plan-types'
import { getTemporalPublishedWorkflowNodeSupport } from '@/lib/workflow-runtime/temporal/published-workflow-activities'
import { getWorkflowNodeRegistration, WORKFLOW_NODE_TYPES } from './node-catalog'

function resolveRetryInvalidationStepKeys(
  params: Parameters<WorkflowDefinition['resolveRetryInvalidationStepKeys']>[0],
): string[] {
  return params.existingStepKeys.includes(params.stepKey) ? [params.stepKey] : []
}

function stepKeyForNode(node: WorkflowCanvasNode): string {
  return node.step?.key?.trim() || node.id
}

function buildStepNodeLookup(version: WorkflowDefinitionVersionDetail): Map<string, WorkflowCanvasNode> {
  const stepNodes = new Map<string, WorkflowCanvasNode>()
  for (const node of version.definition.nodes) {
    if (getWorkflowNodeRegistration(node.type)?.runtime.producesStep) {
      stepNodes.set(stepKeyForNode(node), node)
    }
  }
  return stepNodes
}

function requireStepNode(
  stepNodes: ReadonlyMap<string, WorkflowCanvasNode>,
  step: WorkflowStepDefinition,
): WorkflowCanvasNode {
  const node = stepNodes.get(step.key)
  if (node) return node
  throw new Error(`compiled workflow step has no source node: ${step.key}`)
}

function nodeTitle(node: WorkflowCanvasNode): string {
  const registration = getWorkflowNodeRegistration(node.type)
  return node.title?.trim() || registration?.label || node.id
}

function nodeConfig(node: WorkflowCanvasNode): Record<string, unknown> {
  if (!node.config || Array.isArray(node.config)) return {}
  return { ...node.config }
}

function buildPlanStep(input: {
  node: WorkflowCanvasNode
  step: WorkflowStepDefinition
  index: number
  total: number
}): PublishedWorkflowExecutionPlanStep {
  const title = nodeTitle(input.node)
  const config = nodeConfig(input.node)
  const support = getTemporalPublishedWorkflowNodeSupport({
    nodeType: input.node.type,
    config,
  })
  const temporalStep = {
    stepKey: input.step.key,
    stepTitle: title,
    stepIndex: input.index + 1,
    stepTotal: input.total,
    attempt: 1,
  }
  return {
    nodeId: input.node.id,
    nodeType: input.node.type,
    nodeTitle: title,
    stepKey: input.step.key,
    dependsOn: [...input.step.dependsOn],
    config,
    retryable: input.step.retryable,
    artifactTypes: [...input.step.artifactTypes],
    failureMode: input.step.failureMode,
    supported: support.supported,
    ...(support.reason ? { supportReason: support.reason } : {}),
    temporalStep,
    publishedWorkflowStep: {
      nodeId: input.node.id,
      nodeType: input.node.type,
      nodeTitle: title,
      stepKey: input.step.key,
      dependsOn: [...input.step.dependsOn],
      config,
      artifactTypes: [...input.step.artifactTypes],
      temporalStep,
    },
  }
}

function unsupportedNodeDiagnostic(
  step: PublishedWorkflowExecutionPlanStep,
): PublishedWorkflowExecutionPlanDiagnostic {
  return {
    code: 'WORKFLOW_NODE_RUNTIME_UNSUPPORTED',
    message: step.supportReason
      ? `workflow node type ${step.nodeType} is not supported by the Temporal published workflow adapter: ${step.supportReason}`
      : `workflow node type ${step.nodeType} is not supported by the Temporal published workflow adapter`,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    stepKey: step.stepKey,
  }
}

function buildDiagnostics(
  steps: readonly PublishedWorkflowExecutionPlanStep[],
): PublishedWorkflowExecutionPlanDiagnostic[] {
  const diagnostics = steps
    .filter((step) => !step.supported)
    .map(unsupportedNodeDiagnostic)
  diagnostics.push(...videoDependencyDiagnostics(steps))
  if (steps.length === 0) {
    diagnostics.push({
      code: 'WORKFLOW_EXECUTION_PLAN_EMPTY',
      message: 'published workflow definition has no executable steps',
    })
  }
  return diagnostics
}

function isImageMediaStep(step: PublishedWorkflowExecutionPlanStep | undefined): boolean {
  return step?.nodeType === WORKFLOW_NODE_TYPES.MEDIA_GENERATE
    && step.config.mediaKind === 'image'
}

function isVideoMediaStep(step: PublishedWorkflowExecutionPlanStep): boolean {
  return step.nodeType === WORKFLOW_NODE_TYPES.MEDIA_GENERATE
    && step.config.mediaKind === 'video'
}

function videoDependencyDiagnostics(
  steps: readonly PublishedWorkflowExecutionPlanStep[],
): PublishedWorkflowExecutionPlanDiagnostic[] {
  const stepsByKey = new Map(steps.map((step) => [step.stepKey, step]))
  const diagnostics: PublishedWorkflowExecutionPlanDiagnostic[] = []
  for (const step of steps) {
    if (!isVideoMediaStep(step)) continue
    const directImageDependencies = step.dependsOn
      .map((dependencyKey) => stepsByKey.get(dependencyKey))
      .filter(isImageMediaStep)
    if (directImageDependencies.length === 1) continue
    diagnostics.push({
      code: 'WORKFLOW_NODE_RUNTIME_INVALID_DEPENDENCY',
      message: directImageDependencies.length === 0
        ? 'media.generate video requires exactly one direct image media dependency'
        : 'media.generate video cannot have multiple direct image media dependencies',
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      stepKey: step.stepKey,
    })
  }
  return diagnostics
}

export function buildPublishedWorkflowExecutionPlan(
  version: WorkflowDefinitionVersionDetail,
): PublishedWorkflowExecutionPlan {
  const compiled = compileWorkflowCanvasDefinition(
    version.definition,
    resolveRetryInvalidationStepKeys,
  )
  const stepNodes = buildStepNodeLookup(version)
  const steps = compiled.orderedSteps.map((step, index) => buildPlanStep({
    node: requireStepNode(stepNodes, step),
    step,
    index,
    total: compiled.orderedSteps.length,
  }))
  const diagnostics = buildDiagnostics(steps)
  return {
    workflowDefinitionId: version.workflowDefinitionId,
    workflowDefinitionVersionId: version.id,
    workflowType: version.workflowType,
    title: version.title,
    version: version.version,
    executable: diagnostics.length === 0,
    steps,
    temporalSteps: steps.map((step) => step.temporalStep),
    publishedWorkflowSteps: steps.map((step) => step.publishedWorkflowStep),
    diagnostics,
    unsupportedNodes: diagnostics.filter((item) => item.code === 'WORKFLOW_NODE_RUNTIME_UNSUPPORTED'),
  }
}

export async function getProjectPublishedWorkflowExecutionPlan(
  params: WorkflowTypeParams,
): Promise<PublishedWorkflowExecutionPlan | null> {
  const version = await getProjectPublishedWorkflowDefinitionVersion(params)
  return version ? buildPublishedWorkflowExecutionPlan(version) : null
}

export function assertPublishedWorkflowExecutionPlanExecutable(
  plan: PublishedWorkflowExecutionPlan,
): void {
  if (plan.executable) return
  throw new ApiError('INVALID_PARAMS', {
    code: 'WORKFLOW_EXECUTION_PLAN_NOT_EXECUTABLE',
    message: 'published workflow execution plan contains unsupported or empty runtime steps',
    diagnostics: plan.diagnostics,
  })
}
