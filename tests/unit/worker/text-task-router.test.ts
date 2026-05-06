import { describe, expect, it, vi } from 'vitest'
import { TASK_TYPE } from '@/lib/task/types'
import type { TaskExecutionContext } from '@/lib/workers/shared'

const handleStoryToScriptTaskMock = vi.hoisted(() => vi.fn())
const handleStoryToScriptTaskContextMock = vi.hoisted(() => vi.fn())
const handleScriptToStoryboardTaskMock = vi.hoisted(() => vi.fn())
const handleScriptToStoryboardTaskContextMock = vi.hoisted(() => vi.fn())
const handleVoiceAnalyzeTaskMock = vi.hoisted(() => vi.fn())
const handleAnalyzeNovelTaskMock = vi.hoisted(() => vi.fn())
const handleAiStoryExpandTaskMock = vi.hoisted(() => vi.fn())
const handleClipsBuildTaskMock = vi.hoisted(() => vi.fn())
const handleScreenplayConvertTaskMock = vi.hoisted(() => vi.fn())
const handleEpisodeSplitTaskMock = vi.hoisted(() => vi.fn())
const handleAnalyzeGlobalTaskMock = vi.hoisted(() => vi.fn())
const handleAssetHubAIDesignTaskMock = vi.hoisted(() => vi.fn())
const handleAssetHubAIModifyTaskMock = vi.hoisted(() => vi.fn())
const handleShotAITaskMock = vi.hoisted(() => vi.fn())
const handleCharacterProfileTaskMock = vi.hoisted(() => vi.fn())
const handleReferenceToCharacterTaskMock = vi.hoisted(() => vi.fn())
const handleRegenerateStoryboardTextTaskMock = vi.hoisted(() => vi.fn())
const handleInsertPanelTaskMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/workers/handlers/story-to-script', () => ({
  handleStoryToScriptTask: handleStoryToScriptTaskMock,
  handleStoryToScriptTaskContext: handleStoryToScriptTaskContextMock,
}))
vi.mock('@/lib/workers/handlers/script-to-storyboard', () => ({
  handleScriptToStoryboardTask: handleScriptToStoryboardTaskMock,
  handleScriptToStoryboardTaskContext: handleScriptToStoryboardTaskContextMock,
}))
vi.mock('@/lib/workers/handlers/voice-analyze', () => ({ handleVoiceAnalyzeTask: handleVoiceAnalyzeTaskMock }))
vi.mock('@/lib/workers/handlers/analyze-novel', () => ({ handleAnalyzeNovelTask: handleAnalyzeNovelTaskMock }))
vi.mock('@/lib/workers/handlers/ai-story-expand', () => ({ handleAiStoryExpandTask: handleAiStoryExpandTaskMock }))
vi.mock('@/lib/workers/handlers/clips-build', () => ({ handleClipsBuildTask: handleClipsBuildTaskMock }))
vi.mock('@/lib/workers/handlers/screenplay-convert', () => ({ handleScreenplayConvertTask: handleScreenplayConvertTaskMock }))
vi.mock('@/lib/workers/handlers/episode-split', () => ({ handleEpisodeSplitTask: handleEpisodeSplitTaskMock }))
vi.mock('@/lib/workers/handlers/analyze-global', () => ({ handleAnalyzeGlobalTask: handleAnalyzeGlobalTaskMock }))
vi.mock('@/lib/workers/handlers/asset-hub-ai-design', () => ({ handleAssetHubAIDesignTask: handleAssetHubAIDesignTaskMock }))
vi.mock('@/lib/workers/handlers/asset-hub-ai-modify', () => ({ handleAssetHubAIModifyTask: handleAssetHubAIModifyTaskMock }))
vi.mock('@/lib/workers/handlers/shot-ai-tasks', () => ({ handleShotAITask: handleShotAITaskMock }))
vi.mock('@/lib/workers/handlers/character-profile', () => ({ handleCharacterProfileTask: handleCharacterProfileTaskMock }))
vi.mock('@/lib/workers/handlers/reference-to-character', () => ({ handleReferenceToCharacterTask: handleReferenceToCharacterTaskMock }))
vi.mock('@/lib/workers/handlers/regenerate-storyboard-text', () => ({ handleRegenerateStoryboardTextTask: handleRegenerateStoryboardTextTaskMock }))
vi.mock('@/lib/workers/handlers/insert-panel', () => ({ handleInsertPanelTask: handleInsertPanelTaskMock }))

import {
  resolveTextTaskContextHandler,
  resolveTextTaskHandler,
  runTextTaskHandlerWithContext,
} from '@/lib/workers/handlers/text-task-router'

describe('text task router', () => {
  it('routes grouped task types to the expected handlers', () => {
    expect(resolveTextTaskHandler(TASK_TYPE.STORY_TO_SCRIPT_RUN)).toBe(handleStoryToScriptTaskMock)
    expect(resolveTextTaskHandler(TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN)).toBe(handleScriptToStoryboardTaskMock)
    expect(resolveTextTaskHandler(TASK_TYPE.AI_CREATE_CHARACTER)).toBe(handleAssetHubAIDesignTaskMock)
    expect(resolveTextTaskHandler(TASK_TYPE.ASSET_HUB_AI_MODIFY_PROP)).toBe(handleAssetHubAIModifyTaskMock)
    expect(resolveTextTaskHandler(TASK_TYPE.AI_MODIFY_PROP)).toBe(handleShotAITaskMock)
    expect(resolveTextTaskHandler(TASK_TYPE.CHARACTER_PROFILE_BATCH_CONFIRM)).toBe(handleCharacterProfileTaskMock)
    expect(resolveTextTaskHandler(TASK_TYPE.ASSET_HUB_REFERENCE_TO_CHARACTER)).toBe(handleReferenceToCharacterTaskMock)
  })

  it('routes storyboard text mutations to dedicated handlers', () => {
    expect(resolveTextTaskHandler(TASK_TYPE.REGENERATE_STORYBOARD_TEXT)).toBe(handleRegenerateStoryboardTextTaskMock)
    expect(resolveTextTaskHandler(TASK_TYPE.INSERT_PANEL)).toBe(handleInsertPanelTaskMock)
  })

  it('throws for unsupported task types', () => {
    expect(() => resolveTextTaskHandler('unsupported_text_task')).toThrow('Unsupported text task type: unsupported_text_task')
  })

  it('routes supported run-centric task types to context handlers', async () => {
    const context: TaskExecutionContext = {
      queueName: 'temporal:text',
      data: {
        taskId: 'task-1',
        type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
        locale: 'zh',
        projectId: 'project-1',
        episodeId: 'episode-1',
        targetType: 'NovelPromotionEpisode',
        targetId: 'episode-1',
        payload: {},
        billingInfo: null,
        userId: 'user-1',
        trace: null,
      },
      retryState: {
        attemptsMade: 0,
        maxAttempts: 5,
        backoff: null,
      },
    }

    expect(resolveTextTaskContextHandler(TASK_TYPE.STORY_TO_SCRIPT_RUN)).toBe(handleStoryToScriptTaskContextMock)
    expect(resolveTextTaskContextHandler(TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN)).toBe(handleScriptToStoryboardTaskContextMock)

    await runTextTaskHandlerWithContext(context)
    expect(handleStoryToScriptTaskContextMock).toHaveBeenCalledWith(context)
    expect(handleStoryToScriptTaskMock).not.toHaveBeenCalled()
  })

  it('throws for unsupported context task types instead of creating a legacy job', () => {
    expect(() => resolveTextTaskContextHandler(TASK_TYPE.VOICE_ANALYZE)).toThrow(
      `Unsupported context text task type: ${TASK_TYPE.VOICE_ANALYZE}`,
    )
  })
})
