'use client'

import TaskStatusInline from '@/components/task/TaskStatusInline'
import { AppIcon } from '@/components/ui/icons'
import type { TaskPresentationState } from '@/lib/task/presentation'

interface GlobalAssetPickerHeaderProps {
  title: string
  onClose: () => void
}

interface GlobalAssetPickerSearchProps {
  value: string
  placeholder: string
  onChange: (value: string) => void
}

interface GlobalAssetPickerEmptyStateProps {
  type: 'character' | 'location' | 'prop' | 'voice'
  noAssetsText: string
  createHintText: string
}

interface GlobalAssetPickerFooterProps {
  cancelLabel: string
  confirmLabel: string
  loading?: boolean
  disabled: boolean
  copyingState: TaskPresentationState | null
  onClose: () => void
  onConfirm: () => void
}

export function GlobalAssetPickerHeader({
  title,
  onClose,
}: GlobalAssetPickerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <h2 className="text-lg font-semibold text-[var(--glass-text-primary)]">{title}</h2>
      <button onClick={onClose} className="glass-btn-base glass-btn-soft text-[var(--glass-text-tertiary)]">
        <AppIcon name="close" className="w-5 h-5" />
      </button>
    </div>
  )
}

export function GlobalAssetPickerSearch({
  value,
  placeholder,
  onChange,
}: GlobalAssetPickerSearchProps) {
  return (
    <div className="px-6 pb-3">
      <div className="relative">
        <AppIcon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--glass-text-tertiary)]"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="glass-input-base w-full pl-9 pr-4 py-2 text-sm"
        />
      </div>
    </div>
  )
}

export function GlobalAssetPickerEmptyState({
  type,
  noAssetsText,
  createHintText,
}: GlobalAssetPickerEmptyStateProps) {
  const iconName =
    type === 'character'
      ? 'userAlt'
      : type === 'location' || type === 'prop'
        ? 'image'
        : 'mic'

  return (
    <div className="flex flex-col items-center justify-center h-40 text-[var(--glass-text-tertiary)]">
      <AppIcon name={iconName} className="w-12 h-12 mb-2" />
      <p>{noAssetsText}</p>
      <p className="text-sm mt-1">{createHintText}</p>
    </div>
  )
}

export function GlobalAssetPickerFooter({
  cancelLabel,
  confirmLabel,
  loading,
  disabled,
  copyingState,
  onClose,
  onConfirm,
}: GlobalAssetPickerFooterProps) {
  return (
    <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface-strong)]">
      <button
        onClick={onClose}
        className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="glass-btn-base glass-btn-primary px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading && (
          <TaskStatusInline
            state={copyingState}
            className="text-white [&>span]:sr-only [&_svg]:text-white"
          />
        )}
        {confirmLabel}
      </button>
    </div>
  )
}
