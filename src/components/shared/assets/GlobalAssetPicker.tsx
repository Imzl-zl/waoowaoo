'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import ImagePreviewModal from '@/components/ui/ImagePreviewModal'
import TaskStatusInline from '@/components/task/TaskStatusInline'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import { AppIcon } from '@/components/ui/icons'
import { apiFetch } from '@/lib/api-fetch'
import {
  GlobalAssetPickerEmptyState,
  GlobalAssetPickerFooter,
  GlobalAssetPickerHeader,
  GlobalAssetPickerSearch,
} from './GlobalAssetPickerChrome'
import type {
  AssetSummary,
  CharacterAssetSummary,
  LocationAssetSummary,
  PropAssetSummary,
  VoiceAssetSummary,
} from '@/lib/assets/contracts'

interface GlobalAssetPickerProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (globalAssetId: string) => void
    type: 'character' | 'location' | 'prop' | 'voice'
    loading?: boolean
}

/** 从 appearances 中提取预览图 URL */
function getCharacterPreview(char: CharacterAssetSummary): string | null {
    const primaryVariant = char.variants.find((variant) => variant.index === 0) || char.variants[0]
    if (!primaryVariant) return null
    const selectedRenderIndex = primaryVariant.selectionState.selectedRenderIndex
    const selectedRender = selectedRenderIndex !== null
        ? primaryVariant.renders.find((render) => render.index === selectedRenderIndex)
        : null
    return selectedRender?.imageUrl
        || primaryVariant.renders.find((render) => render.isSelected)?.imageUrl
        || primaryVariant.renders[0]?.imageUrl
        || null
}

/** 从 variants/renders 中提取预览图 URL */
function getVisualAssetPreview(asset: LocationAssetSummary | PropAssetSummary): string | null {
    const selectedVariant = asset.selectedVariantId
        ? asset.variants.find((variant) => variant.id === asset.selectedVariantId)
        : null
    const targetVariant = selectedVariant || asset.variants[0]
    if (!targetVariant) return null
    return targetVariant.renders.find((render) => render.isSelected)?.imageUrl
        || targetVariant.renders[0]?.imageUrl
        || null
}

export default function GlobalAssetPicker({
    isOpen,
    onClose,
    onSelect,
    type,
    loading: externalLoading
}: GlobalAssetPickerProps) {
    const t = useTranslations('assetPicker')

    // 轻量级查询：只查询当前 type，不附带任务状态
    const charactersQuery = useQuery({
        queryKey: ['global-assets', 'characters'],
        queryFn: async () => {
            const res = await apiFetch('/api/assets?scope=global&kind=character')
            if (!res.ok) throw new Error('Failed to fetch characters')
            const data = await res.json()
            return data.assets as CharacterAssetSummary[]
        },
        enabled: type === 'character',
    })
    const locationsQuery = useQuery({
        queryKey: ['global-assets', 'locations'],
        queryFn: async () => {
            const res = await apiFetch('/api/assets?scope=global&kind=location')
            if (!res.ok) throw new Error('Failed to fetch locations')
            const data = await res.json()
            return data.assets as LocationAssetSummary[]
        },
        enabled: type === 'location',
    })
    const propsQuery = useQuery({
        queryKey: ['global-assets', 'props'],
        queryFn: async () => {
            const res = await apiFetch('/api/assets?scope=global&kind=prop')
            if (!res.ok) throw new Error('Failed to fetch props')
            const data = await res.json()
            return data.assets as PropAssetSummary[]
        },
        enabled: type === 'prop',
    })
    const voicesQuery = useQuery({
        queryKey: ['global-assets', 'voices'],
        queryFn: async () => {
            const res = await apiFetch('/api/assets?scope=global&kind=voice')
            if (!res.ok) throw new Error('Failed to fetch voices')
            const data = await res.json()
            return data.assets as VoiceAssetSummary[]
        },
        enabled: type === 'voice',
    })

    const characters = (charactersQuery.data || []) as CharacterAssetSummary[]
    const locations = (locationsQuery.data || []) as LocationAssetSummary[]
    const props = (propsQuery.data || []) as PropAssetSummary[]
    const voices = (voicesQuery.data || []) as VoiceAssetSummary[]
    const isLoading = type === 'character'
        ? charactersQuery.isFetching
        : type === 'location'
            ? locationsQuery.isFetching
            : type === 'prop'
                ? propsQuery.isFetching
            : voicesQuery.isFetching
    const loadingState = isLoading
        ? resolveTaskPresentationState({
            phase: 'processing',
            intent: 'process',
            resource: type === 'voice' ? 'audio' : 'image',
            hasOutput: false,
        })
        : null
    const copyingState = externalLoading
        ? resolveTaskPresentationState({
            phase: 'processing',
            intent: 'process',
            resource: type === 'voice' ? 'audio' : 'image',
            hasOutput: false,
        })
        : null
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [previewAudio, setPreviewAudio] = useState<string | null>(null)
    const [isPlayingAudio, setIsPlayingAudio] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // 提取稳定的 refetch 引用，避免 useEffect 无限循环
    const refetchCharacters = charactersQuery.refetch
    const refetchLocations = locationsQuery.refetch
    const refetchProps = propsQuery.refetch
    const refetchVoices = voicesQuery.refetch

    // 停止音频播放的辅助函数
    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            audioRef.current = null
        }
        setIsPlayingAudio(false)
        setPreviewAudio(null)
    }

    useEffect(() => {
        if (isOpen) {
            setSelectedId(null)
            setSearchQuery('')
            if (type === 'character') {
                refetchCharacters()
            } else if (type === 'location') {
                refetchLocations()
            } else if (type === 'prop') {
                refetchProps()
            } else {
                refetchVoices()
            }
        } else {
            // 关闭对话框时停止播放
            stopAudio()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, type])

    const handleConfirm = () => {
        if (selectedId) {
            stopAudio()  // 确认复制时停止音频播放
            onSelect(selectedId)
        }
    }

    const filteredCharacters = characters.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredLocations = locations.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredProps = props.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredVoices = voices.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.voiceMeta.description && v.voiceMeta.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    // 播放/暂停音频预览
    const handlePlayAudio = (audioUrl: string, e: React.MouseEvent) => {
        e.stopPropagation()

        // 如果点击的是当前正在播放的音频，则暂停
        if (previewAudio === audioUrl && isPlayingAudio) {
            stopAudio()
            return
        }

        // 停止之前的播放
        stopAudio()

        // 开始播放新音频
        setIsPlayingAudio(true)
        setPreviewAudio(audioUrl)
        const audio = new Audio(audioUrl)
        audioRef.current = audio
        audio.play()
        audio.onended = () => {
            setIsPlayingAudio(false)
            setPreviewAudio(null)
            audioRef.current = null
        }
        audio.onerror = () => {
            setIsPlayingAudio(false)
            setPreviewAudio(null)
            audioRef.current = null
        }
    }

    if (!isOpen) return null

    const items = type === 'character'
        ? filteredCharacters
        : type === 'location'
            ? filteredLocations
            : type === 'prop'
                ? filteredProps
                : filteredVoices
    const hasNoAssets = type === 'character'
        ? characters.length === 0
        : type === 'location'
            ? locations.length === 0
            : type === 'prop'
                ? props.length === 0
                : voices.length === 0

    return (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50">
            <div className="glass-surface-modal w-[600px] max-h-[80vh] flex flex-col">
                <GlobalAssetPickerHeader
                    title={type === 'character' ? t('selectCharacter') : type === 'location' ? t('selectLocation') : type === 'prop' ? t('selectProp') : t('selectVoice')}
                    onClose={onClose}
                />
                <GlobalAssetPickerSearch
                    value={searchQuery}
                    placeholder={t('searchPlaceholder')}
                    onChange={setSearchQuery}
                />

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <TaskStatusInline state={loadingState} />
                        </div>
                    ) : hasNoAssets ? (
                        <GlobalAssetPickerEmptyState
                            type={type}
                            noAssetsText={t('noAssets')}
                            createHintText={t('createInAssetHub')}
                        />
                    ) : items.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-[var(--glass-text-tertiary)]">
                            <p>{t('noSearchResults')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {type === 'character' ? (
                                filteredCharacters.map((char) => {
                                    const charPreview = getCharacterPreview(char)
                                    return (
                                        <div
                                            key={char.id}
                                            onClick={() => setSelectedId(char.id)}
                                            className={`relative cursor-pointer rounded-xl border-2 p-2 transition-all hover:shadow-md ${selectedId === char.id
                                                ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
                                                : 'border-[var(--glass-stroke-base)] hover:border-[var(--glass-stroke-focus)]'
                                                }`}
                                        >
                                            {selectedId === char.id && (
                                                <AppIcon name="badgeCheck" className="absolute -top-2 -right-2 w-6 h-6 text-[var(--glass-tone-info-fg)] bg-[var(--glass-bg-surface)] rounded-full" />
                                            )}

                                            <div className="aspect-[3/2] rounded-lg overflow-hidden bg-[var(--glass-bg-muted)] mb-2 relative">
                                                {charPreview ? (
                                                    <MediaImageWithLoading
                                                        src={charPreview}
                                                        alt={char.name}
                                                        containerClassName="w-full h-full"
                                                        className="w-full h-full object-contain cursor-zoom-in"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setPreviewImage(charPreview)
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--glass-text-tertiary)]">
                                                        <AppIcon name="image" className="w-12 h-12" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-center">
                                                <p className="font-medium text-sm text-[var(--glass-text-primary)] truncate">{char.name}</p>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : type === 'location' ? (
                                filteredLocations.map((loc) => {
                                    const locPreview = getVisualAssetPreview(loc)
                                    return (
                                        <div
                                            key={loc.id}
                                            onClick={() => setSelectedId(loc.id)}
                                            className={`relative cursor-pointer rounded-xl border-2 p-2 transition-all hover:shadow-md ${selectedId === loc.id
                                                ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
                                                : 'border-[var(--glass-stroke-base)] hover:border-[var(--glass-stroke-focus)]'
                                                }`}
                                        >
                                            {selectedId === loc.id && (
                                                <AppIcon name="badgeCheck" className="absolute -top-2 -right-2 w-6 h-6 text-[var(--glass-tone-info-fg)] bg-[var(--glass-bg-surface)] rounded-full" />
                                            )}

                                            <div className="aspect-video rounded-lg overflow-hidden bg-[var(--glass-bg-muted)] mb-2 relative">
                                                {locPreview ? (
                                                    <MediaImageWithLoading
                                                        src={locPreview}
                                                        alt={loc.name}
                                                        containerClassName="w-full h-full"
                                                        className="w-full h-full object-cover cursor-zoom-in"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setPreviewImage(locPreview)
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--glass-text-tertiary)]">
                                                        <AppIcon name="image" className="w-12 h-12" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-center">
                                                <p className="font-medium text-sm text-[var(--glass-text-primary)] truncate">{loc.name}</p>
                                                <p className="text-xs text-[var(--glass-text-secondary)] mt-1">
                                                    {loc.variants.length} {t('images')}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : type === 'prop' ? (
                                filteredProps.map((prop) => {
                                    const propPreview = getVisualAssetPreview(prop)
                                    return (
                                        <div
                                            key={prop.id}
                                            onClick={() => setSelectedId(prop.id)}
                                            className={`relative cursor-pointer rounded-xl border-2 p-2 transition-all hover:shadow-md ${selectedId === prop.id
                                                ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
                                                : 'border-[var(--glass-stroke-base)] hover:border-[var(--glass-stroke-focus)]'
                                                }`}
                                        >
                                            {selectedId === prop.id && (
                                                <AppIcon name="badgeCheck" className="absolute -top-2 -right-2 w-6 h-6 text-[var(--glass-tone-info-fg)] bg-[var(--glass-bg-surface)] rounded-full" />
                                            )}
                                            <div className="aspect-video rounded-lg overflow-hidden bg-[var(--glass-bg-muted)] mb-2 relative">
                                                {propPreview ? (
                                                    <MediaImageWithLoading
                                                        src={propPreview}
                                                        alt={prop.name}
                                                        containerClassName="w-full h-full"
                                                        className="w-full h-full object-cover cursor-zoom-in"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setPreviewImage(propPreview)
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--glass-text-tertiary)]">
                                                        <AppIcon name="image" className="w-12 h-12" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-center">
                                                <p className="font-medium text-sm text-[var(--glass-text-primary)] truncate">{prop.name}</p>
                                                <p className="text-xs text-[var(--glass-text-secondary)] mt-1">
                                                    {prop.variants.length} {t('images')}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                filteredVoices.map((voice) => {
                                    const genderIcon = voice.voiceMeta.gender === 'male' ? 'M' : voice.voiceMeta.gender === 'female' ? 'F' : ''
                                    const previewVoiceUrl = voice.voiceMeta.customVoiceUrl
                                    const isVoicePlaying = previewAudio === previewVoiceUrl && isPlayingAudio
                                    return (
                                        <div
                                            key={voice.id}
                                            onClick={() => setSelectedId(voice.id)}
                                            className={`relative cursor-pointer glass-surface overflow-hidden transition-all hover:shadow-md ${selectedId === voice.id
                                                ? 'ring-2 ring-[var(--glass-stroke-focus)]'
                                                : 'hover:ring-2 hover:ring-[var(--glass-focus-ring-strong)]'
                                                }`}
                                        >
                                            {selectedId === voice.id && (
                                                <div className="absolute top-2 right-2 w-6 h-6 glass-chip glass-chip-info rounded-full flex items-center justify-center z-10 p-0">
                                                    <AppIcon name="checkSolid" className="w-4 h-4 text-white" />
                                                </div>
                                            )}

                                            <div className="relative bg-[var(--glass-bg-muted)] p-6 flex items-center justify-center">
                                                <div className="w-16 h-16 rounded-full glass-surface-soft flex items-center justify-center">
                                                    <AppIcon name="mic" className="w-8 h-8 text-[var(--glass-tone-info-fg)]" />
                                                </div>

                                                {genderIcon && (
                                                    <div className="absolute top-2 left-2 glass-chip glass-chip-neutral text-xs px-2 py-0.5 rounded-full">
                                                        {genderIcon}
                                                    </div>
                                                )}

                                                {previewVoiceUrl && (
                                                    <button
                                                        onClick={(e) => handlePlayAudio(previewVoiceUrl, e)}
                                                        className={`absolute bottom-2 right-2 w-10 h-10 rounded-full glass-btn-base flex items-center justify-center transition-all ${isVoicePlaying
                                                            ? 'glass-btn-tone-info animate-pulse'
                                                            : 'glass-btn-secondary text-[var(--glass-tone-info-fg)]'
                                                            }`}
                                                    >
                                                        {isVoicePlaying ? (
                                                            <AppIcon name="pause" className="w-5 h-5" />
                                                        ) : (
                                                            <AppIcon name="play" className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="p-3">
                                                <h3 className="font-medium text-[var(--glass-text-primary)] text-sm truncate">{voice.name}</h3>
                                                {voice.voiceMeta.description && (
                                                    <p className="mt-1 text-xs text-[var(--glass-text-secondary)] line-clamp-2">{voice.voiceMeta.description}</p>
                                                )}
                                                {voice.voiceMeta.voicePrompt && !voice.voiceMeta.description && (
                                                    <p className="mt-1 text-xs text-[var(--glass-text-tertiary)] line-clamp-2 italic">{voice.voiceMeta.voicePrompt}</p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>

                <GlobalAssetPickerFooter
                    cancelLabel={t('cancel')}
                    confirmLabel={t('confirmCopy')}
                    loading={externalLoading}
                    disabled={!selectedId || !!externalLoading}
                    copyingState={copyingState}
                    onClose={onClose}
                    onConfirm={handleConfirm}
                />
            </div>

            {
                previewImage && (
                    <ImagePreviewModal
                        imageUrl={previewImage}
                        onClose={() => setPreviewImage(null)}
                    />
                )
            }
        </div >
    )
}
