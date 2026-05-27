export type WorkflowFailureMode = 'fail_run'

export type WorkflowNodeCategory =
  | 'trigger'
  | 'input'
  | 'ai'
  | 'production'
  | 'logic'
  | 'media'
  | 'data'
  | 'output'

export type WorkflowValueType = 'text' | 'json' | 'asset' | 'media' | 'any'

export type WorkflowPortDirection = 'input' | 'output'

export type WorkflowNodePortDefinition = Readonly<{
  key: string
  label: string
  direction: WorkflowPortDirection
  dataTypes: readonly WorkflowValueType[]
}>

export type WorkflowNodeRuntimeDefinition = Readonly<{
  producesStep: boolean
  retryable: boolean
  artifactTypes: readonly string[]
  failureMode: WorkflowFailureMode
}>

export type WorkflowNodeConfigFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select'

export type WorkflowNodeConfigOption = Readonly<{
  value: string
  label: string
}>

export type WorkflowNodeConfigValue = string | number | boolean

export type WorkflowNodeConfigFieldDefinition = Readonly<{
  key: string
  label: string
  type: WorkflowNodeConfigFieldType
  required?: boolean
  requiredWhen?: Readonly<{
    key: string
    equals: WorkflowNodeConfigValue
  }>
  defaultValue?: WorkflowNodeConfigValue
  placeholder?: string
  helpText?: string
  min?: number
  max?: number
  step?: number
  options?: readonly WorkflowNodeConfigOption[]
}>

export type WorkflowNodeConfigSchema = Readonly<{
  fields: readonly WorkflowNodeConfigFieldDefinition[]
}>

export type WorkflowNodeTypeRegistration = Readonly<{
  type: string
  label: string
  category: WorkflowNodeCategory
  ports: readonly WorkflowNodePortDefinition[]
  configSchema?: WorkflowNodeConfigSchema
  runtime: WorkflowNodeRuntimeDefinition
}>

export type WorkflowCanvasPosition = Readonly<{
  x: number
  y: number
}>

export type WorkflowCanvasNodeStep = Readonly<{
  key?: string
  retryable?: boolean
  artifactTypes?: readonly string[]
  failureMode?: WorkflowFailureMode
}>

export type WorkflowCanvasNode = Readonly<{
  id: string
  type: string
  title?: string
  position?: WorkflowCanvasPosition
  config?: Record<string, unknown> | null
  step?: WorkflowCanvasNodeStep | null
}>

export type WorkflowCanvasEdge = Readonly<{
  id: string
  sourceNodeId: string
  sourcePort: string
  targetNodeId: string
  targetPort: string
}>

export type WorkflowCanvasDefinition = Readonly<{
  schemaVersion: 1
  workflowType: string
  title: string
  nodes: readonly WorkflowCanvasNode[]
  edges: readonly WorkflowCanvasEdge[]
}>

export type WorkflowStepDefinition = Readonly<{
  key: string
  dependsOn: string[]
  retryable: boolean
  artifactTypes: string[]
  failureMode: WorkflowFailureMode
}>

export type WorkflowDefinition = Readonly<{
  workflowType: string
  orderedSteps: WorkflowStepDefinition[]
  resolveRetryInvalidationStepKeys: (params: {
    stepKey: string
    existingStepKeys: string[]
  }) => string[]
}>

export type WorkflowCanvasValidationErrorCode =
  | 'WORKFLOW_TYPE_REQUIRED'
  | 'TITLE_REQUIRED'
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'UNKNOWN_NODE_TYPE'
  | 'UNKNOWN_EDGE_NODE'
  | 'UNKNOWN_PORT'
  | 'INVALID_PORT_DIRECTION'
  | 'UNKNOWN_CONFIG_FIELD'
  | 'CONFIG_FIELD_REQUIRED'
  | 'INVALID_CONFIG_FIELD_TYPE'
  | 'INVALID_CONFIG_FIELD_OPTION'
  | 'DUPLICATE_STEP_KEY'
  | 'MISSING_TRIGGER'
  | 'MISSING_OUTPUT'
  | 'TRIGGER_HAS_INCOMING_EDGE'
  | 'OUTPUT_HAS_OUTGOING_EDGE'
  | 'NODE_NOT_REACHABLE_FROM_SOURCE'
  | 'NODE_CANNOT_REACH_OUTPUT'
  | 'WORKFLOW_HAS_CYCLE'

export type WorkflowCanvasValidationError = Readonly<{
  code: WorkflowCanvasValidationErrorCode
  message: string
  nodeId?: string
  edgeId?: string
  nodeType?: string
  portKey?: string
  configKey?: string
}>

export type WorkflowCanvasValidationResult = Readonly<{
  valid: boolean
  errors: WorkflowCanvasValidationError[]
}>
