import sharp from 'sharp'
import type { Job } from 'bullmq'
import { generateImage } from '@/lib/generator-api'
import { queryFalStatus } from '@/lib/async-submit'
import { fetchWithTimeoutAndRetry } from '@/lib/ark-api'
import { CHARACTER_IMAGE_BANANA_RATIO } from '@/lib/constants'
import { generateUniqueKey, uploadObject } from '@/lib/storage'
import { createLabelSVG } from '@/lib/fonts'
import { assertTaskActive } from '@/lib/workers/utils'
import type { TaskJobData } from '@/lib/task/types'

const POLL_MAX_ATTEMPTS = 60
const POLL_INTERVAL_MS = 2000

export async function generateReferenceImage(params: {
  job: Job<TaskJobData>
  imageIndex: number
  userId: string
  imageModel: string
  prompt: string
  referenceImages?: string[]
  falApiKey?: string | null
  keyPrefix: string
  labelText?: string
}): Promise<string | null> {
  const {
    job,
    imageIndex,
    userId,
    imageModel,
    prompt,
    referenceImages,
    falApiKey,
    keyPrefix,
    labelText,
  } = params

  try {
    await assertTaskActive(job, `reference_to_character_generate_${imageIndex + 1}`)
    const result = await generateImage(
      userId,
      imageModel,
      prompt,
      {
        referenceImages,
        aspectRatio: CHARACTER_IMAGE_BANANA_RATIO,
      },
    )

    let finalImageUrl = result.imageUrl
    const requestId = typeof result.requestId === 'string' ? result.requestId : ''
    const endpoint = typeof result.endpoint === 'string' ? result.endpoint : ''
    if (result.async && requestId && endpoint) {
      if (!falApiKey) {
        throw new Error('reference_to_character async result requires falApiKey')
      }
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
        await assertTaskActive(job, `reference_to_character_poll_${imageIndex + 1}_${attempt + 1}`)
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        const status = await queryFalStatus(endpoint, requestId, falApiKey)
        if (status.completed && status.resultUrl) {
          finalImageUrl = status.resultUrl
          break
        }
        if (status.failed) {
          return null
        }
      }
    }

    if (!result.success || !finalImageUrl) {
      return null
    }

    const imgRes = await fetchWithTimeoutAndRetry(finalImageUrl, {
      logPrefix: `[reference-to-character:${imageIndex + 1}]`,
    })
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const processed = labelText
      ? await (async () => {
        const meta = await sharp(buffer).metadata()
        const width = meta.width || 2160
        const height = meta.height || 2160
        const fontSize = Math.floor(height * 0.04)
        const pad = Math.floor(fontSize * 0.5)
        const barHeight = fontSize + pad * 2
        const svg = await createLabelSVG(width, barHeight, fontSize, pad, labelText)
        return await sharp(buffer)
          .extend({
            top: barHeight,
            bottom: 0,
            left: 0,
            right: 0,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          })
          .composite([{ input: svg, top: 0, left: 0 }])
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer()
      })()
      : await sharp(buffer)
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer()

    const key = generateUniqueKey(`${keyPrefix}-${Date.now()}-${imageIndex}`, 'jpg')
    return await uploadObject(processed, key)
  } catch {
    return null
  }
}
