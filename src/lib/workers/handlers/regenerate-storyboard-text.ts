import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import { createWorkerLLMStreamCallbacks, createWorkerLLMStreamContext } from './llm-stream'
import { runStoryboardPhasesForClip } from './storyboard-phase-runner'
import { readAssetKind, readNullableText } from './storyboard-text-utils'

export async function handleRegenerateStoryboardTextTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const storyboardId = typeof payload.storyboardId === 'string' ? payload.storyboardId : job.data.targetId
  if (!storyboardId) throw new Error('regenerate_storyboard_text requires storyboardId')

  const context = await loadRegenerateStoryboardContext(job.data.projectId, storyboardId)
  await reportTaskProgress(job, 20, { stage: 'regenerate_storyboard_prepare', storyboardId })

  const streamContext = createWorkerLLMStreamContext(job, 'regenerate_storyboard')
  const callbacks = createWorkerLLMStreamCallbacks(job, streamContext)
  const finalPanels = await withInternalLLMStreamCallbacks(
    callbacks,
    async () =>
      await runStoryboardPhasesForClip({
        clip: {
          ...context.storyboard.clip,
          props: readNullableText(context.storyboard.clip as unknown as Record<string, unknown>, 'props'),
        },
        novelPromotionData: context.novelPromotionData,
        projectId: job.data.projectId,
        projectName: context.projectName,
        userId: job.data.userId,
        locale: job.data.locale,
      }),
  )
  await callbacks.flush()

  await reportTaskProgress(job, 85, { stage: 'regenerate_storyboard_persist', storyboardId })
  await assertTaskActive(job, 'regenerate_storyboard_transaction')
  await persistRegeneratedPanels(storyboardId, finalPanels)

  return {
    storyboardId,
    panelCount: finalPanels.length,
  }
}

async function loadRegenerateStoryboardContext(projectId: string, storyboardId: string) {
  const storyboard = await prisma.novelPromotionStoryboard.findUnique({
    where: { id: storyboardId },
    include: { clip: true, episode: true },
  })
  if (!storyboard) throw new Error('Storyboard not found')
  if (!storyboard.clip) throw new Error('Storyboard clip not found')

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('Project not found')

  const novelPromotionData = await prisma.novelPromotionProject.findUnique({
    where: { projectId },
    include: {
      characters: { include: { appearances: { orderBy: { appearanceIndex: 'asc' } } } },
      locations: { include: { images: { orderBy: { imageIndex: 'asc' } } } },
    },
  })
  if (!novelPromotionData) throw new Error('Novel promotion data not found')
  if (!novelPromotionData.analysisModel) throw new Error('Analysis model not configured')

  return {
    storyboard,
    projectName: project.name,
    novelPromotionData: {
      ...novelPromotionData,
      analysisModel: novelPromotionData.analysisModel,
      locations: novelPromotionData.locations.filter((item) => readAssetKind(item as unknown as Record<string, unknown>) !== 'prop'),
      props: novelPromotionData.locations
        .filter((item) => readAssetKind(item as unknown as Record<string, unknown>) === 'prop')
        .map((item) => ({ name: item.name, summary: item.summary })),
    },
  }
}

async function persistRegeneratedPanels(storyboardId: string, finalPanels: Array<Record<string, unknown>>) {
  await prisma.$transaction(async (tx) => {
    const panelModel = tx.novelPromotionPanel as unknown as {
      create: (args: { data: Record<string, unknown> }) => Promise<unknown>
    }
    await tx.novelPromotionPanel.deleteMany({ where: { storyboardId } })
    await tx.novelPromotionStoryboard.update({
      where: { id: storyboardId },
      data: { panelCount: finalPanels.length, updatedAt: new Date() },
    })

    for (let index = 0; index < finalPanels.length; index += 1) {
      const panel = finalPanels[index]
      const srtRange = Array.isArray(panel.srt_range) ? panel.srt_range : []
      const srtStart = typeof srtRange[0] === 'number' ? srtRange[0] : null
      const srtEnd = typeof srtRange[1] === 'number' ? srtRange[1] : null
      await panelModel.create({
        data: {
          storyboardId,
          panelIndex: index,
          panelNumber: typeof panel.panel_number === 'number' ? panel.panel_number : index + 1,
          shotType: typeof panel.shot_type === 'string' ? panel.shot_type : null,
          cameraMove: typeof panel.camera_move === 'string' ? panel.camera_move : null,
          description: typeof panel.description === 'string' ? panel.description : null,
          location: typeof panel.location === 'string' ? panel.location : null,
          characters: panel.characters ? JSON.stringify(panel.characters) : null,
          props: panel.props ? JSON.stringify(panel.props) : null,
          srtStart,
          srtEnd,
          duration: typeof panel.duration === 'number' ? panel.duration : null,
          videoPrompt: typeof panel.video_prompt === 'string' ? panel.video_prompt : null,
          sceneType: typeof panel.scene_type === 'string' ? panel.scene_type : null,
          srtSegment: typeof panel.source_text === 'string' ? panel.source_text : null,
          photographyRules: panel.photographyPlan ? JSON.stringify(panel.photographyPlan) : null,
          actingNotes: panel.actingNotes ? JSON.stringify(panel.actingNotes) : null,
        },
      })
    }
  }, { timeout: 30000 })
}
