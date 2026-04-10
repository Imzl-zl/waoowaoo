'use client'

interface ClipTab {
  id: string
}

interface ScriptViewAssetViewTabsProps {
  clips: ClipTab[]
  assetViewMode: 'all' | string
  setAssetViewMode: (mode: 'all' | string) => void
  setSelectedClipId: (clipId: string) => void
  tScript: (key: string, values?: Record<string, unknown>) => string
}

export function ScriptViewAssetViewTabs({
  clips,
  assetViewMode,
  setAssetViewMode,
  setSelectedClipId,
  tScript,
}: ScriptViewAssetViewTabsProps) {
  return (
    <div className="px-1 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAssetViewMode('all')}
          className={`glass-btn-base px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${assetViewMode === 'all'
            ? 'bg-gradient-to-br from-[var(--glass-accent-from)] to-[var(--glass-accent-to)] text-white shadow-none'
            : 'glass-btn-secondary text-[var(--glass-text-secondary)]'
            }`}
        >
          {tScript('assetView.allClips')}
        </button>
        {clips.map((clip, index) => (
          <button
            key={clip.id}
            onClick={() => {
              setAssetViewMode(clip.id)
              setSelectedClipId(clip.id)
            }}
            className={`glass-btn-base px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${assetViewMode === clip.id
              ? 'bg-gradient-to-br from-[var(--glass-accent-from)] to-[var(--glass-accent-to)] text-white shadow-none'
              : 'glass-btn-secondary text-[var(--glass-text-secondary)]'
              }`}
          >
            {tScript('segment.title', { index: index + 1 })}
          </button>
        ))}
      </div>
    </div>
  )
}
