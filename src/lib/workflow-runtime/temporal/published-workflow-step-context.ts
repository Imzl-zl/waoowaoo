import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalPublishedWorkflowStepResult,
} from './types'

function requirePublishedWorkflowDependency(
  step: TemporalPublishedWorkflowStep,
  context: TemporalPublishedWorkflowStepContext,
  dependencyKey: string,
): TemporalPublishedWorkflowStepResult {
  const dependency = context[dependencyKey]
  if (!dependency) {
    throw new Error(`published workflow dependency ${dependencyKey} is missing for step ${step.stepKey}`)
  }
  return dependency
}

export function pickPublishedWorkflowStepContext(
  step: TemporalPublishedWorkflowStep,
  context: TemporalPublishedWorkflowStepContext,
): TemporalPublishedWorkflowStepContext {
  const dependencies: Record<string, TemporalPublishedWorkflowStepResult> = {}
  for (const dependencyKey of step.dependsOn) {
    dependencies[dependencyKey] = requirePublishedWorkflowDependency(step, context, dependencyKey)
  }
  return dependencies
}

export function readPublishedWorkflowDependencyPayloads(
  step: TemporalPublishedWorkflowStep,
  context: TemporalPublishedWorkflowStepContext,
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {}
  for (const dependencyKey of step.dependsOn) {
    outputs[dependencyKey] = requirePublishedWorkflowDependency(
      step,
      context,
      dependencyKey,
    ).artifactPayload
  }
  return outputs
}

export function readPublishedWorkflowDependencyOutputs(
  step: TemporalPublishedWorkflowStep,
  context: TemporalPublishedWorkflowStepContext,
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {}
  for (const dependencyKey of step.dependsOn) {
    const dependency = requirePublishedWorkflowDependency(step, context, dependencyKey)
    outputs[dependencyKey] = {
      text: dependency.text,
      artifactPayload: dependency.artifactPayload,
    }
  }
  return outputs
}
