import type {
  WorkflowNodeConfigValue,
  WorkflowNodeTypeRegistration,
} from './canvas-types'

export function createDefaultWorkflowNodeConfig(
  registration: WorkflowNodeTypeRegistration,
): Record<string, WorkflowNodeConfigValue> | undefined {
  const config: Record<string, WorkflowNodeConfigValue> = {}
  for (const field of registration.configSchema?.fields || []) {
    if (field.defaultValue === undefined) continue
    if (
      field.requiredWhen
      && config[field.requiredWhen.key] !== field.requiredWhen.equals
    ) {
      continue
    }
    config[field.key] = field.defaultValue
  }

  if (Object.keys(config).length === 0) return undefined
  return config
}
