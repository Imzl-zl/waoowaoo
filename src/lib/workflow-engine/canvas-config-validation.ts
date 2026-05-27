import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasNode,
  WorkflowCanvasValidationError,
  WorkflowNodeConfigFieldDefinition,
  WorkflowNodeTypeRegistration,
} from './canvas-types'

function isEmptyConfigValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)
}

function addConfigError(params: {
  errors: WorkflowCanvasValidationError[]
  code: WorkflowCanvasValidationError['code']
  message: string
  node: WorkflowCanvasNode
  configKey: string
}) {
  params.errors.push({
    code: params.code,
    message: params.message,
    nodeId: params.node.id,
    nodeType: params.node.type,
    configKey: params.configKey,
  })
}

function hasValidConfigType(field: WorkflowNodeConfigFieldDefinition, value: unknown): boolean {
  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false
    if (field.min !== undefined && value < field.min) return false
    if (field.max !== undefined && value > field.max) return false
    return true
  }
  if (field.type === 'boolean') return typeof value === 'boolean'
  return typeof value === 'string'
}

function isFieldRequired(
  field: WorkflowNodeConfigFieldDefinition,
  config: Record<string, unknown>,
): boolean {
  if (field.required) return true
  if (!field.requiredWhen) return false
  return config[field.requiredWhen.key] === field.requiredWhen.equals
}

function validateConfigField(params: {
  node: WorkflowCanvasNode
  field: WorkflowNodeConfigFieldDefinition
  value: unknown
  config: Record<string, unknown>
  errors: WorkflowCanvasValidationError[]
}) {
  if (isEmptyConfigValue(params.value)) {
    if (isFieldRequired(params.field, params.config)) {
      addConfigError({
        errors: params.errors,
        code: 'CONFIG_FIELD_REQUIRED',
        message: `Config field ${params.field.key} is required`,
        node: params.node,
        configKey: params.field.key,
      })
    }
    return
  }

  if (!hasValidConfigType(params.field, params.value)) {
    addConfigError({
      errors: params.errors,
      code: 'INVALID_CONFIG_FIELD_TYPE',
      message: `Config field ${params.field.key} has an invalid value type`,
      node: params.node,
      configKey: params.field.key,
    })
    return
  }

  if (params.field.type !== 'select' || !params.field.options) return
  if (params.field.options.some((option) => option.value === params.value)) return

  addConfigError({
    errors: params.errors,
    code: 'INVALID_CONFIG_FIELD_OPTION',
    message: `Config field ${params.field.key} has an unsupported option`,
    node: params.node,
    configKey: params.field.key,
  })
}

export function validateWorkflowNodeConfigs(params: {
  definition: WorkflowCanvasDefinition
  registrations: ReadonlyMap<string, WorkflowNodeTypeRegistration>
  errors: WorkflowCanvasValidationError[]
}) {
  for (const node of params.definition.nodes) {
    const registration = params.registrations.get(node.id)
    if (!registration) continue
    const fields = registration.configSchema?.fields || []
    const fieldsByKey = new Map(fields.map((field) => [field.key, field]))
    const config = node.config || {}

    for (const configKey of Object.keys(config)) {
      if (fieldsByKey.has(configKey)) continue
      addConfigError({
        errors: params.errors,
        code: 'UNKNOWN_CONFIG_FIELD',
        message: `Unknown config field ${configKey}`,
        node,
        configKey,
      })
    }

    for (const field of fields) {
      validateConfigField({
        node,
        field,
        value: config[field.key],
        config,
        errors: params.errors,
      })
    }
  }
}
