export const TEMPORAL_DEFAULT_ADDRESS = 'localhost:7233'
export const TEMPORAL_DEFAULT_NAMESPACE = 'default'
export const TEMPORAL_DEFAULT_TASK_QUEUE = 'waoowaoo-workflows'
export const TEMPORAL_WORKFLOW_ID_PREFIX = 'waoowaoo-run-'
export const TEMPORAL_SMOKE_STEP = {
  KEY: 'temporal.smoke',
  TITLE: 'Temporal smoke lifecycle',
  INDEX: 1,
  TOTAL: 1,
  ATTEMPT: 1,
} as const

export const TEMPORAL_WORKFLOW_TYPE = {
  SMOKE: 'smokeWorkflow',
  RUN_TASK: 'runTaskWorkflow',
} as const

export type TemporalWorkflowType =
  (typeof TEMPORAL_WORKFLOW_TYPE)[keyof typeof TEMPORAL_WORKFLOW_TYPE]

export type TemporalRuntimeConfig = Readonly<{
  address: string
  namespace: string
  taskQueue: string
}>

export type TemporalWorkflowRunInput = Readonly<{
  runId: string
  workflowType: string
  projectId: string
  userId: string
  episodeId?: string | null
  taskId?: string | null
  targetType: string
  targetId: string
  payload?: Record<string, unknown> | null
}>

export type TemporalWorkflowRunResult = Readonly<{
  runId: string
  workflowType: string
  status: 'completed'
  activityId: string
}>

export type TemporalTaskWorkflowResult = Readonly<{
  runId: string
  workflowType: string
  taskId: string
  taskType: string
  status: 'completed'
  activityId: string
}>

export type TemporalWorkflowStepDescriptor = Readonly<{
  stepKey: string
  stepTitle: string
  stepIndex: number
  stepTotal: number
  attempt: number
}>

export type TemporalWorkflowCompletionPayload = Readonly<{
  temporalActivityType: 'recordWorkflowCompleted'
  activityId: string
  workflowResult: TemporalWorkflowRunResult
}>

type TemporalWorkflowStepBasePayload = Readonly<{
  activityId: string
  stepKey: string
  stepTitle: string
  stepIndex: number
  stepTotal: number
  stepAttempt: number
}>

export type TemporalWorkflowStepPayload = TemporalWorkflowStepBasePayload & Readonly<{
  temporalActivityType: 'recordWorkflowStepStarted' | 'recordWorkflowStepCompleted'
  artifactPayload?: TemporalWorkflowRunResult
  text?: string
}>

export type TemporalWorkflowFailureInput = Readonly<{
  errorCode: string
  message: string
  retryable?: boolean | null
}>

export type TemporalWorkflowFailureDetails = Readonly<{
  errorCode: string
  message: string
  errorMessage: string
  retryable?: boolean
}>

export type TemporalWorkflowFailurePayload = TemporalWorkflowFailureDetails & Readonly<{
  temporalActivityType: 'recordWorkflowFailed'
  activityId: string
}>

export type TemporalWorkflowStepFailurePayload =
  TemporalWorkflowStepBasePayload
  & TemporalWorkflowFailureDetails
  & Readonly<{
    temporalActivityType: 'recordWorkflowStepFailed'
    artifactPayload: TemporalWorkflowFailureDetails
  }>

export type TemporalWorkflowStartResult = Readonly<{
  runId: string
  workflowType: string
  temporalWorkflowType: TemporalWorkflowType
  workflowId: string
  firstExecutionRunId: string
  taskQueue: string
}>
