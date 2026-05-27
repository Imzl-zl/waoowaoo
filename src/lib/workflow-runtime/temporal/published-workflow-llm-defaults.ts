import { withTextBilling } from '@/lib/billing/service'
import { getProjectModelConfig } from '@/lib/config-service'
import { executeAiTextStep } from '@/lib/ai-runtime'
import type {
  BillPublishedWorkflowLlmText,
  ExecutePublishedWorkflowLlmText,
  ResolvePublishedWorkflowLlmModel,
} from './published-workflow-activity-dependencies'

export const executePublishedWorkflowLlmTextDefault: ExecutePublishedWorkflowLlmText =
  executeAiTextStep

export const resolvePublishedWorkflowLlmModelDefault: ResolvePublishedWorkflowLlmModel =
  async ({ workflow }) => {
    const config = await getProjectModelConfig(workflow.projectId, workflow.userId)
    const model = config.analysisModel?.trim()
    if (!model) {
      throw new Error('published workflow LLM analysisModel is required')
    }
    return model
  }

export const billPublishedWorkflowLlmTextDefault: BillPublishedWorkflowLlmText =
  async (params) => await withTextBilling(
    params.userId,
    params.model,
    params.maxInputTokens,
    params.maxOutputTokens,
    {
      projectId: params.projectId,
      action: params.action,
      billingKey: params.billingKey,
      metadata: params.metadata,
    },
    params.execute,
  )
