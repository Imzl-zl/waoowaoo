'use client'

import type { KeyboardEvent } from 'react'
import { AppIcon } from '@/components/ui/icons'

interface AssistantChatModalHeaderProps {
  title: string
  subtitle: string
  closeLabel: string
  onClose: () => void
}

interface AssistantChatModalCompletedStateProps {
  assistantLabel: string
  completedTitle?: string
  completedMessage?: string
  closeLabel: string
}

interface AssistantChatModalFooterProps {
  completed: boolean
  closeLabel: string
  input: string
  pending: boolean
  inputPlaceholder: string
  sendLabel: string
  pendingLabel: string
  onClose: () => void
  onInputChange: (value: string) => void
  onSend: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function AssistantChatModalHeader({
  title,
  subtitle,
  closeLabel,
  onClose,
}: AssistantChatModalHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--glass-stroke-base)] px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--glass-text-secondary)]">{subtitle}</p>
      </div>
      <button onClick={onClose} className="glass-icon-btn-sm" title={closeLabel}>
        <AppIcon name="close" className="h-4 w-4" />
      </button>
    </div>
  )
}

export function AssistantChatModalCompletedState({
  assistantLabel,
  completedTitle,
  completedMessage,
  closeLabel,
}: AssistantChatModalCompletedStateProps) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-6 py-7 text-center shadow-sm">
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/15">
            <AppIcon name="check" className="h-10 w-10 text-emerald-500" />
          </div>
        </div>
        <div className="text-base font-semibold text-[var(--glass-text-primary)]">
          {completedTitle || assistantLabel}
        </div>
        {completedMessage && (
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--glass-text-secondary)]">
            {completedMessage}
          </div>
        )}
        <div className="mt-4 text-xs text-[var(--glass-text-tertiary)]">{closeLabel}</div>
      </div>
    </div>
  )
}

export function AssistantChatModalFooter({
  completed,
  closeLabel,
  input,
  pending,
  inputPlaceholder,
  sendLabel,
  pendingLabel,
  onClose,
  onInputChange,
  onSend,
  onKeyDown,
}: AssistantChatModalFooterProps) {
  return (
    <div className="border-t border-[var(--glass-stroke-base)] px-4 py-3">
      <div className="flex items-center gap-2">
        {completed ? (
          <button
            onClick={onClose}
            className="glass-btn-base glass-btn-primary ml-auto px-3 py-2 text-sm font-medium"
          >
            {closeLabel}
          </button>
        ) : (
          <>
            <input
              type="text"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={inputPlaceholder}
              className="glass-input-base flex-1 px-3 py-2 text-sm"
              disabled={pending}
            />
            <button
              onClick={onSend}
              disabled={pending}
              className="glass-btn-base glass-btn-primary px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? pendingLabel : sendLabel}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
