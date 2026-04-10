import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { executeAiTextStep } from '@/lib/ai-runtime'
import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import { getArtStylePrompt } from '@/lib/constants'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import { createWorkerLLMStreamCallbacks, createWorkerLLMStreamContext } from './llm-stream'
import type { TaskJobData } from '@/lib/task/types'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { resolveAnalysisModel } from './resolve-analysis-model'
import {
  createAnalyzedCharacters,
  createAnalyzedLocations,
  createAnalyzedProps,
  parseJsonResponse,
  readAssetKind,
  readText,
} from './analyze-novel-helpers'

export async function handleAnalyzeNovelTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const projectId = job.data.projectId

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
    },
  })
  if (!project) {
    throw new Error('Project not found')
  }

  const novelData = await prisma.novelPromotionProject.findUnique({
    where: { projectId },
    include: {
      characters: true,
      locations: true,
    },
  })
  if (!novelData) {
    throw new Error('Novel promotion data not found')
  }
  const analysisModel = await resolveAnalysisModel({
    userId: job.data.userId,
    inputModel: payload.model,
    projectAnalysisModel: novelData.analysisModel,
  })

  const firstEpisode = await prisma.novelPromotionEpisode.findFirst({
    where: { novelPromotionProjectId: novelData.id },
    orderBy: { createdAt: 'asc' },
    select: {
      novelText: true,
    },
  })

  let contentToAnalyze = readText(novelData.globalAssetText) || readText(firstEpisode?.novelText)
  if (!contentToAnalyze.trim()) {
    throw new Error('请先填写全局资产设定或剧本内容')
  }

  const maxContentLength = 30000
  if (contentToAnalyze.length > maxContentLength) {
    contentToAnalyze = contentToAnalyze.substring(0, maxContentLength)
  }

  const charactersLibName = (novelData.characters || []).map((item) => item.name).join(', ')
  const locationsLibName = (novelData.locations || [])
    .filter((item) => readAssetKind(item as unknown as Record<string, unknown>) !== 'prop')
    .map((item) => item.name)
    .join(', ')
  const propsLibName = (novelData.locations || [])
    .filter((item) => readAssetKind(item as unknown as Record<string, unknown>) === 'prop')
    .map((item) => item.name)
    .join(', ')
  const characterPromptTemplate = buildPrompt({
    promptId: PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE,
    locale: job.data.locale,
    variables: {
      input: contentToAnalyze,
      characters_lib_info: charactersLibName || '无',
    },
  })
  const locationPromptTemplate = buildPrompt({
    promptId: PROMPT_IDS.NP_SELECT_LOCATION,
    locale: job.data.locale,
    variables: {
      input: contentToAnalyze,
      locations_lib_name: locationsLibName || '无',
    },
  })
  const propPromptTemplate = buildPrompt({
    promptId: PROMPT_IDS.NP_SELECT_PROP,
    locale: job.data.locale,
    variables: {
      input: contentToAnalyze,
      props_lib_name: propsLibName || '无',
    },
  })

  await reportTaskProgress(job, 20, {
    stage: 'analyze_novel_prepare',
    stageLabel: '准备资产分析参数',
    displayMode: 'detail',
  })
  await assertTaskActive(job, 'analyze_novel_prepare')

  const streamContext = createWorkerLLMStreamContext(job, 'analyze_novel')
  const streamCallbacks = createWorkerLLMStreamCallbacks(job, streamContext)
  const [characterCompletion, locationCompletion, propCompletion] = await (async () => {
    try {
      return await withInternalLLMStreamCallbacks(
        streamCallbacks,
        async () =>
          await Promise.all([
            executeAiTextStep({
              userId: job.data.userId,
              model: analysisModel,
              messages: [{ role: 'user', content: characterPromptTemplate }],
              temperature: 0.7,
              projectId,
              action: 'analyze_characters',
              meta: {
                stepId: 'analyze_characters',
                stepTitle: '角色分析',
                stepIndex: 1,
                stepTotal: 2,
              },
            }),
            executeAiTextStep({
              userId: job.data.userId,
              model: analysisModel,
              messages: [{ role: 'user', content: locationPromptTemplate }],
              temperature: 0.7,
              projectId,
              action: 'analyze_locations',
              meta: {
                stepId: 'analyze_locations',
                stepTitle: '场景分析',
                stepIndex: 2,
                stepTotal: 3,
              },
            }),
            executeAiTextStep({
              userId: job.data.userId,
              model: analysisModel,
              messages: [{ role: 'user', content: propPromptTemplate }],
              temperature: 0.7,
              projectId,
              action: 'analyze_props',
              meta: {
                stepId: 'analyze_props',
                stepTitle: '道具分析',
                stepIndex: 3,
                stepTotal: 3,
              },
            }),
          ]),
      )
    } finally {
      await streamCallbacks.flush()
    }
  })()

  const characterResponseText = characterCompletion.text
  const locationResponseText = locationCompletion.text
  const propResponseText = propCompletion.text

  await reportTaskProgress(job, 60, {
    stage: 'analyze_novel_characters_done',
    stageLabel: '角色分析完成',
    displayMode: 'detail',
    stepId: 'analyze_characters',
    stepTitle: '角色分析',
    stepIndex: 1,
    stepTotal: 3,
    done: true,
    output: characterResponseText,
  })

  await reportTaskProgress(job, 70, {
    stage: 'analyze_novel_locations_done',
    stageLabel: '场景分析完成',
    displayMode: 'detail',
    stepId: 'analyze_locations',
    stepTitle: '场景分析',
    stepIndex: 2,
    stepTotal: 3,
    done: true,
    output: locationResponseText,
  })

  await reportTaskProgress(job, 80, {
    stage: 'analyze_novel_props_done',
    stageLabel: '道具分析完成',
    displayMode: 'detail',
    stepId: 'analyze_props',
    stepTitle: '道具分析',
    stepIndex: 3,
    stepTotal: 3,
    done: true,
    output: propResponseText,
  })

  const charactersData = parseJsonResponse(characterResponseText)
  const locationsData = parseJsonResponse(locationResponseText)
  const propsData = parseJsonResponse(propResponseText)
  const parsedCharacters = Array.isArray(charactersData.characters)
    ? (charactersData.characters as Array<Record<string, unknown>>)
    : []
  const parsedLocations = Array.isArray(locationsData.locations)
    ? (locationsData.locations as Array<Record<string, unknown>>)
    : []
  const parsedProps = Array.isArray(propsData.props)
    ? (propsData.props as Array<Record<string, unknown>>)
    : []

  await reportTaskProgress(job, 75, {
    stage: 'analyze_novel_persist',
    stageLabel: '保存资产分析结果',
    displayMode: 'detail',
  })
  await assertTaskActive(job, 'analyze_novel_persist')

  const existingLocations = (novelData.locations || []) as Array<Record<string, unknown> & { name: string }>
  const createdCharacters = await createAnalyzedCharacters({
    novelPromotionProjectId: novelData.id,
    existingCharacters: novelData.characters || [],
    parsedCharacters,
  })
  const createdLocations = await createAnalyzedLocations({
    novelPromotionProjectId: novelData.id,
    existingLocations,
    parsedLocations,
  })
  const createdProps = await createAnalyzedProps({
    novelPromotionProjectId: novelData.id,
    existingLocations,
    parsedProps,
  })

  await prisma.novelPromotionProject.update({
    where: { id: novelData.id },
    data: {
      artStylePrompt: getArtStylePrompt(novelData.artStyle, job.data.locale) || '',
    },
  })

  await reportTaskProgress(job, 96, {
    stage: 'analyze_novel_done',
    stageLabel: '资产分析已完成',
    displayMode: 'detail',
  })

  return {
    success: true,
    characters: createdCharacters,
    locations: createdLocations,
    props: createdProps,
    characterCount: createdCharacters.length,
    locationCount: createdLocations.length,
    propCount: createdProps.length,
  }
}
