import { type Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { type TaskJobData } from '@/lib/task/types'
import {
  assertTaskActive,
  resolveImageSourceFromGeneration,
  toSignedUrlIfCos,
  uploadImageSourceToCos,
} from '../utils'
import {
  normalizeReferenceImagesForGeneration,
  normalizeToBase64ForGeneration,
} from '@/lib/media/outbound-image'
import {
  AnyObj,
  pickFirstString,
  resolveNovelData,
} from './image-task-handler-shared'

export async function handleStoryboardAssetImageModification(input: {
  job: Job<TaskJobData>
  payload: AnyObj
  editModel: string
  modifyPrompt: string
  resolution?: string
}) {
  const panelId = pickFirstString(input.payload.panelId, input.payload.targetId, input.job.data.targetId)
  let panel = panelId
    ? await prisma.novelPromotionPanel.findUnique({
      where: { id: panelId },
      select: {
        id: true,
        storyboardId: true,
        panelIndex: true,
        imageUrl: true,
        previousImageUrl: true,
      },
    })
    : null

  const storyboardId = pickFirstString(input.payload.storyboardId)
  if (!panel && storyboardId && input.payload.panelIndex !== undefined) {
    panel = await prisma.novelPromotionPanel.findFirst({
      where: {
        storyboardId,
        panelIndex: Number(input.payload.panelIndex),
      },
      select: {
        id: true,
        storyboardId: true,
        panelIndex: true,
        imageUrl: true,
        previousImageUrl: true,
      },
    })
  }

  if (!panel || !panel.imageUrl) {
    throw new Error('Storyboard panel image not found')
  }

  const currentUrl = toSignedUrlIfCos(panel.imageUrl, 3600)
  if (!currentUrl) throw new Error('No storyboard panel image url')

  const projectData = await resolveNovelData(input.job.data.projectId)
  if (!projectData.videoRatio) throw new Error('Project videoRatio not configured')

  const requiredReference = await normalizeToBase64ForGeneration(currentUrl)
  const extraReferenceInputs: string[] = []
  const selectedAssets = Array.isArray(input.payload.selectedAssets) ? input.payload.selectedAssets : []
  for (const asset of selectedAssets) {
    if (!asset || typeof asset !== 'object') continue
    const assetImage = (asset as AnyObj).imageUrl
    if (typeof assetImage === 'string' && assetImage.trim()) {
      extraReferenceInputs.push(assetImage.trim())
    }
  }

  if (Array.isArray(input.payload.extraImageUrls)) {
    for (const url of input.payload.extraImageUrls) {
      if (typeof url === 'string' && url.trim().length > 0) {
        extraReferenceInputs.push(url.trim())
      }
    }
  }

  const normalizedExtras = await normalizeReferenceImagesForGeneration(extraReferenceInputs)
  const uniqueReferences = Array.from(new Set([requiredReference, ...normalizedExtras]))
  const source = await resolveImageSourceFromGeneration(input.job, {
    userId: input.job.data.userId,
    modelId: input.editModel,
    prompt: `请根据以下指令修改分镜图片，保持镜头语言和主体一致：\n${input.modifyPrompt}`,
    options: {
      referenceImages: uniqueReferences,
      aspectRatio: projectData.videoRatio,
      ...(input.resolution ? { resolution: input.resolution } : {}),
    },
  })

  const cosKey = await uploadImageSourceToCos(source, 'panel-modify', panel.id)

  await assertTaskActive(input.job, 'persist_storyboard_modify')
  await prisma.novelPromotionPanel.update({
    where: { id: panel.id },
    data: {
      previousImageUrl: panel.imageUrl || panel.previousImageUrl || null,
      imageUrl: cosKey,
      candidateImages: null,
    },
  })

  return {
    type: 'storyboard',
    panelId: panel.id,
    imageUrl: cosKey,
  }
}
