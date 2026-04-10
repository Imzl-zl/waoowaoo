'use client'

import TaskStatusInline from '@/components/task/TaskStatusInline'
import { ScriptViewAssetViewTabs } from './ScriptViewAssetViewTabs'
import { ScriptViewCharactersSection } from './ScriptViewCharactersSection'
import { ScriptViewLocationsSection } from './ScriptViewLocationsSection'
import { ScriptViewPropsSection } from './ScriptViewPropsSection'
import type { ScriptViewAssetsPanelProps } from './scriptViewAssetPanelTypes'
import { useScriptViewAssetPanelState } from './useScriptViewAssetPanelState'

export default function ScriptViewAssetsPanel({
  clips,
  assetViewMode,
  setAssetViewMode,
  setSelectedClipId,
  characters,
  locations,
  props,
  activeCharIds,
  activeLocationIds,
  activePropIds,
  selectedAppearanceKeys,
  onUpdateClipAssets,
  onOpenAssetLibrary,
  assetsLoading,
  assetsLoadingState,
  allAssetsHaveImages,
  globalCharIds,
  globalLocationIds,
  globalPropIds,
  missingAssetsCount,
  onGenerateStoryboard,
  isSubmittingStoryboardBuild,
  getSelectedAppearances,
  tScript,
  tAssets,
  tNP,
  tCommon,
}: ScriptViewAssetsPanelProps) {
  const {
    showAddChar,
    setShowAddChar,
    showAddLoc,
    setShowAddLoc,
    showAddProp,
    setShowAddProp,
    mounted,
    charEditorTriggerRef,
    charEditorPopoverRef,
    locEditorTriggerRef,
    locEditorPopoverRef,
    propEditorTriggerRef,
    propEditorPopoverRef,
    pendingAppearanceKeys,
    setPendingAppearanceKeys,
    pendingAppearanceLabels,
    setPendingAppearanceLabels,
    pendingLocationIds,
    setPendingLocationIds,
    pendingLocationLabels,
    setPendingLocationLabels,
    pendingPropIds,
    setPendingPropIds,
    isSavingCharacterSelection,
    isSavingLocationSelection,
    isSavingPropSelection,
    isAllClipsMode,
    hasCharacterSelectionChanges,
    hasLocationSelectionChanges,
    hasPropSelectionChanges,
    handleConfirmCharacterSelection,
    handleConfirmLocationSelection,
    handleConfirmPropSelection,
  } = useScriptViewAssetPanelState({
    clips,
    assetViewMode,
    characters,
    locations,
    activeCharIds,
    activeLocationIds,
    activePropIds,
    selectedAppearanceKeys,
    getSelectedAppearances,
    tAssets,
    onUpdateClipAssets,
  })

  return (
    <div className="col-span-12 lg:col-span-4 flex flex-col min-h-[300px] lg:h-full gap-4">
      <div className="relative z-20 flex flex-col gap-2 px-2">
        <h2 className="text-xl font-bold text-[var(--glass-text-primary)] flex items-center gap-2">
          <span className="w-1.5 h-6 bg-[var(--glass-accent-from)] rounded-full" />
          {tScript('inSceneAssets')}
        </h2>
        <ScriptViewAssetViewTabs
          clips={clips}
          assetViewMode={assetViewMode}
          setAssetViewMode={setAssetViewMode}
          setSelectedClipId={setSelectedClipId}
          tScript={tScript}
        />
      </div>

      <div className="relative z-10 flex-1 min-h-0 glass-surface-modal overflow-hidden p-4 pr-3">
        <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1 app-scrollbar">
          {assetsLoading && characters.length === 0 && locations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--glass-text-tertiary)] animate-pulse">
              <TaskStatusInline state={assetsLoadingState} />
            </div>
          )}

          <ScriptViewCharactersSection
            characters={characters}
            activeCharIds={activeCharIds}
            getSelectedAppearances={getSelectedAppearances}
            onOpenAssetLibrary={onOpenAssetLibrary}
            onUpdateClipAssets={onUpdateClipAssets}
            showAddChar={showAddChar}
            setShowAddChar={setShowAddChar}
            mounted={mounted}
            charEditorTriggerRef={charEditorTriggerRef}
            charEditorPopoverRef={charEditorPopoverRef}
            pendingAppearanceKeys={pendingAppearanceKeys}
            setPendingAppearanceKeys={setPendingAppearanceKeys}
            pendingAppearanceLabels={pendingAppearanceLabels}
            setPendingAppearanceLabels={setPendingAppearanceLabels}
            isAllClipsMode={isAllClipsMode}
            isSavingCharacterSelection={isSavingCharacterSelection}
            hasCharacterSelectionChanges={hasCharacterSelectionChanges}
            handleConfirmCharacterSelection={handleConfirmCharacterSelection}
            onToggleEditor={() => {
              setShowAddChar((previous) => !previous)
              setShowAddLoc(false)
              setShowAddProp(false)
            }}
            tScript={tScript}
            tAssets={tAssets}
            tCommon={tCommon}
          />

          <ScriptViewLocationsSection
            locations={locations}
            activeLocationIds={activeLocationIds}
            onOpenAssetLibrary={onOpenAssetLibrary}
            onUpdateClipAssets={onUpdateClipAssets}
            showAddLoc={showAddLoc}
            setShowAddLoc={setShowAddLoc}
            mounted={mounted}
            locEditorTriggerRef={locEditorTriggerRef}
            locEditorPopoverRef={locEditorPopoverRef}
            pendingLocationIds={pendingLocationIds}
            setPendingLocationIds={setPendingLocationIds}
            pendingLocationLabels={pendingLocationLabels}
            setPendingLocationLabels={setPendingLocationLabels}
            isAllClipsMode={isAllClipsMode}
            isSavingLocationSelection={isSavingLocationSelection}
            hasLocationSelectionChanges={hasLocationSelectionChanges}
            handleConfirmLocationSelection={handleConfirmLocationSelection}
            onToggleEditor={() => {
              setShowAddLoc((previous) => !previous)
              setShowAddChar(false)
              setShowAddProp(false)
            }}
            tScript={tScript}
            tCommon={tCommon}
          />

          <ScriptViewPropsSection
            props={props}
            activePropIds={activePropIds}
            onOpenAssetLibrary={onOpenAssetLibrary}
            onUpdateClipAssets={onUpdateClipAssets}
            onToggleEditor={() => {
              setShowAddProp((previous) => !previous)
              setShowAddChar(false)
              setShowAddLoc(false)
            }}
            showAddProp={showAddProp}
            setShowAddProp={setShowAddProp}
            mounted={mounted}
            propEditorTriggerRef={propEditorTriggerRef}
            propEditorPopoverRef={propEditorPopoverRef}
            pendingPropIds={pendingPropIds}
            setPendingPropIds={setPendingPropIds}
            isSavingPropSelection={isSavingPropSelection}
            hasPropSelectionChanges={hasPropSelectionChanges}
            handleConfirmPropSelection={handleConfirmPropSelection}
            tCommon={tCommon}
          />
        </div>
      </div>

      <div className="mt-4 mb-4">
        {!allAssetsHaveImages && globalCharIds.length + globalLocationIds.length + globalPropIds.length > 0 && (
          <div className="mb-3 p-4 bg-[var(--glass-bg-surface)] border border-[var(--glass-stroke-base)] rounded-2xl shadow-sm">
            <p className="text-sm font-medium text-[var(--glass-text-primary)]">
              {tScript('generate.missingAssets', { count: missingAssetsCount })}
            </p>
            <p className="text-xs text-[var(--glass-text-tertiary)] mt-0.5">
              {tScript('generate.missingAssetsTip')}
              <button
                onClick={onOpenAssetLibrary}
                className="text-[var(--glass-tone-info-fg)] hover:underline mx-1"
              >
                {tNP('buttons.assetLibrary')}
              </button>
              {tScript('generate.missingAssetsTipLink')}
            </p>
          </div>
        )}
        <button
          onClick={onGenerateStoryboard}
          disabled={isSubmittingStoryboardBuild || clips.length === 0 || !allAssetsHaveImages}
          className="glass-btn-base glass-btn-primary w-full py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmittingStoryboardBuild
            ? tScript('generate.generating')
            : tScript('generate.startGenerate')}
        </button>
      </div>
    </div>
  )
}
