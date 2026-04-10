'use client'

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type CSSProperties,
} from 'react'
import type { ModelCapabilityOption, CapabilityFieldDefinition } from './config-modals/ModelCapabilityDropdown'
import type { CapabilityValue } from '@/lib/model-config-contract'

export interface ModelDropdownTestProps {
  models: ModelCapabilityOption[]
  value: string | undefined
  onModelChange: (modelKey: string) => void
  capabilityFields: CapabilityFieldDefinition[]
  capabilityOverrides: Record<string, CapabilityValue>
  onCapabilityChange: (field: string, rawValue: string, sample: CapabilityValue) => void
  placeholder?: string
}

const VIEWPORT_EDGE_GAP = 8
const DEFAULT_MAX_HEIGHT = 400

export function useDropdown(
  isOpen: boolean,
  setIsOpen: (val: boolean) => void,
  alignRight = false,
) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_EDGE_GAP
    const spaceAbove = rect.top - VIEWPORT_EDGE_GAP

    let openUpward = false
    let currentMaxHeight = DEFAULT_MAX_HEIGHT

    if (spaceBelow < 250 && spaceAbove > spaceBelow) {
      openUpward = true
      currentMaxHeight = Math.min(DEFAULT_MAX_HEIGHT, spaceAbove)
    } else {
      currentMaxHeight = Math.min(DEFAULT_MAX_HEIGHT, spaceBelow)
    }

    const width = Math.max(rect.width, alignRight ? 240 : 320)
    const left = alignRight ? rect.right - width : rect.left

    setPanelStyle({
      position: 'fixed',
      left,
      width,
      maxHeight: currentMaxHeight,
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      zIndex: 9999,
    })
  }, [alignRight])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setIsOpen])

  useLayoutEffect(() => {
    if (!isOpen) return

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, updatePosition])

  return { triggerRef, panelRef, panelStyle }
}

export function resolveParamSummary(
  fields: CapabilityFieldDefinition[],
  overrides: Record<string, CapabilityValue>,
) {
  return fields
    .map((definition) => {
      const value = overrides[definition.field] !== undefined
        ? String(overrides[definition.field])
        : String(definition.options[0] || '')
      if (definition.field === 'duration') return `${value}s`
      return value
    })
    .filter(Boolean)
    .join(' · ')
}
