import type { Job } from 'bullmq'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'
import { handleAiStoryExpandTask } from './ai-story-expand'
import { handleAnalyzeGlobalTask } from './analyze-global'
import { handleAnalyzeNovelTask } from './analyze-novel'
import { handleAssetHubAIDesignTask } from './asset-hub-ai-design'
import { handleAssetHubAIModifyTask } from './asset-hub-ai-modify'
import { handleCharacterProfileTask } from './character-profile'
import { handleClipsBuildTask } from './clips-build'
import { handleEpisodeSplitTask } from './episode-split'
import { handleInsertPanelTask } from './insert-panel'
import { handleReferenceToCharacterTask } from './reference-to-character'
import { handleRegenerateStoryboardTextTask } from './regenerate-storyboard-text'
import { handleScreenplayConvertTask } from './screenplay-convert'
import { handleScriptToStoryboardTask } from './script-to-storyboard'
import { handleShotAITask } from './shot-ai-tasks'
import { handleStoryToScriptTask } from './story-to-script'
import { handleVoiceAnalyzeTask } from './voice-analyze'

export type TextTaskHandler = (job: Job<TaskJobData>) => Promise<Record<string, unknown> | void>

const TEXT_TASK_HANDLERS: Partial<Record<TaskJobData['type'], TextTaskHandler>> = {
  [TASK_TYPE.STORY_TO_SCRIPT_RUN]: handleStoryToScriptTask,
  [TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN]: handleScriptToStoryboardTask,
  [TASK_TYPE.VOICE_ANALYZE]: handleVoiceAnalyzeTask,
  [TASK_TYPE.ANALYZE_NOVEL]: handleAnalyzeNovelTask,
  [TASK_TYPE.AI_STORY_EXPAND]: handleAiStoryExpandTask,
  [TASK_TYPE.CLIPS_BUILD]: handleClipsBuildTask,
  [TASK_TYPE.SCREENPLAY_CONVERT]: handleScreenplayConvertTask,
  [TASK_TYPE.EPISODE_SPLIT_LLM]: handleEpisodeSplitTask,
  [TASK_TYPE.ANALYZE_GLOBAL]: handleAnalyzeGlobalTask,
  [TASK_TYPE.AI_CREATE_CHARACTER]: handleAssetHubAIDesignTask,
  [TASK_TYPE.AI_CREATE_LOCATION]: handleAssetHubAIDesignTask,
  [TASK_TYPE.ASSET_HUB_AI_DESIGN_CHARACTER]: handleAssetHubAIDesignTask,
  [TASK_TYPE.ASSET_HUB_AI_DESIGN_LOCATION]: handleAssetHubAIDesignTask,
  [TASK_TYPE.ASSET_HUB_AI_MODIFY_CHARACTER]: handleAssetHubAIModifyTask,
  [TASK_TYPE.ASSET_HUB_AI_MODIFY_LOCATION]: handleAssetHubAIModifyTask,
  [TASK_TYPE.ASSET_HUB_AI_MODIFY_PROP]: handleAssetHubAIModifyTask,
  [TASK_TYPE.AI_MODIFY_APPEARANCE]: handleShotAITask,
  [TASK_TYPE.AI_MODIFY_LOCATION]: handleShotAITask,
  [TASK_TYPE.AI_MODIFY_PROP]: handleShotAITask,
  [TASK_TYPE.AI_MODIFY_SHOT_PROMPT]: handleShotAITask,
  [TASK_TYPE.ANALYZE_SHOT_VARIANTS]: handleShotAITask,
  [TASK_TYPE.CHARACTER_PROFILE_CONFIRM]: handleCharacterProfileTask,
  [TASK_TYPE.CHARACTER_PROFILE_BATCH_CONFIRM]: handleCharacterProfileTask,
  [TASK_TYPE.REFERENCE_TO_CHARACTER]: handleReferenceToCharacterTask,
  [TASK_TYPE.ASSET_HUB_REFERENCE_TO_CHARACTER]: handleReferenceToCharacterTask,
  [TASK_TYPE.REGENERATE_STORYBOARD_TEXT]: handleRegenerateStoryboardTextTask,
  [TASK_TYPE.INSERT_PANEL]: handleInsertPanelTask,
}

export function resolveTextTaskHandler(taskType: string): TextTaskHandler {
  const handler = TEXT_TASK_HANDLERS[taskType as TaskJobData['type']]
  if (!handler) {
    throw new Error(`Unsupported text task type: ${taskType}`)
  }
  return handler
}
