'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnEdgesDelete,
  type OnNodeDrag,
  type OnNodesDelete,
} from '@xyflow/react'
import { AppIcon } from '@/components/ui/icons'
import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasNode,
  WorkflowNodeCategory,
  WorkflowNodePortDefinition,
} from '@/lib/workflow-engine/canvas-types'
import {
  connectWorkflowCanvasNodes,
  removeWorkflowCanvasEdge,
  removeWorkflowCanvasNode,
  updateWorkflowCanvasNodePosition,
} from '@/lib/workflow-engine/canvas-editor'
import { getWorkflowNodeRegistration } from '@/lib/workflow-engine/node-catalog'

type Props = {
  definition: WorkflowCanvasDefinition
  selectedNodeId: string | null
  onDefinitionChange: (definition: WorkflowCanvasDefinition) => void
  onSelectNode: (nodeId: string) => void
  t: (key: string) => string
}

type WorkflowFlowNodeData = Record<string, unknown> & {
  category: WorkflowNodeCategory
  inputPorts: readonly WorkflowNodePortDefinition[]
  outputPorts: readonly WorkflowNodePortDefinition[]
  producesStep: boolean
  title: string
  typeLabel: string
}

type WorkflowFlowNode = Node<WorkflowFlowNodeData, 'workflowCanvasNode'>
type WorkflowFlowEdge = Edge<Record<string, never>, 'smoothstep'>

const CATEGORY_ICON: Record<WorkflowNodeCategory, Parameters<typeof AppIcon>[0]['name']> = {
  trigger: 'playCircle',
  input: 'fileText',
  ai: 'brain',
  production: 'clapperboard',
  logic: 'cpu',
  media: 'film',
  data: 'folderOpen',
  output: 'badgeCheck',
}

function isBoundaryCategory(category: WorkflowNodeCategory): boolean {
  return category === 'trigger' || category === 'output'
}

function portOffset(index: number, count: number): string {
  if (count <= 1) return '50%'
  return `${Math.round(((index + 1) / (count + 1)) * 100)}%`
}

function WorkflowFlowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const icon = CATEGORY_ICON[data.category]
  return (
    <div
      className={`min-h-[128px] w-[230px] rounded-lg border bg-[var(--glass-bg-surface-strong)] p-3 text-left shadow-sm transition ${
        selected ? 'border-[var(--glass-stroke-focus)] ring-2 ring-[var(--glass-stroke-focus)]/40' : 'border-[var(--glass-stroke-base)]'
      }`}
    >
      {data.inputPorts.map((port, index) => (
        <Handle
          key={port.key}
          id={port.key}
          type="target"
          position={Position.Left}
          style={{ top: portOffset(index, data.inputPorts.length) }}
          className="!h-3 !w-3 !border-2 !border-[var(--glass-bg-surface-strong)] !bg-[var(--glass-tone-info-fg)]"
        />
      ))}
      <div className="flex items-start justify-between gap-2">
        <span className="glass-surface-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <AppIcon name={icon} className="h-4 w-4 text-[var(--glass-text-secondary)]" />
        </span>
        <span className="glass-chip glass-chip-neutral py-0.5 text-[10px]">
          {data.category}
        </span>
      </div>
      <div className="mt-4 truncate text-sm font-bold text-[var(--glass-text-primary)]">
        {data.title}
      </div>
      <div className="mt-1 truncate font-mono text-[11px] font-semibold text-[var(--glass-text-tertiary)]">
        {data.typeLabel}
      </div>
      {data.producesStep ? (
        <div className="mt-4">
          <span className="glass-chip glass-chip-info py-0.5 text-[10px]">step</span>
        </div>
      ) : null}
      {data.outputPorts.map((port, index) => (
        <Handle
          key={port.key}
          id={port.key}
          type="source"
          position={Position.Right}
          style={{ top: portOffset(index, data.outputPorts.length) }}
          className="!h-3 !w-3 !border-2 !border-[var(--glass-bg-surface-strong)] !bg-[var(--glass-tone-success-fg)]"
        />
      ))}
    </div>
  )
}

const nodeTypes = { workflowCanvasNode: WorkflowFlowNodeCard }

function fallbackPosition(node: WorkflowCanvasNode, index: number) {
  return node.position || { x: index * 280, y: 160 }
}

function toFlowNodes(definition: WorkflowCanvasDefinition, selectedNodeId: string | null): WorkflowFlowNode[] {
  return definition.nodes.map((node, index) => {
    const registration = getWorkflowNodeRegistration(node.type)
    const category = registration?.category || 'logic'
    return {
      id: node.id,
      type: 'workflowCanvasNode',
      position: fallbackPosition(node, index),
      selected: node.id === selectedNodeId,
      deletable: !isBoundaryCategory(category),
      data: {
        category,
        inputPorts: registration?.ports.filter((port) => port.direction === 'input') || [],
        outputPorts: registration?.ports.filter((port) => port.direction === 'output') || [],
        producesStep: Boolean(registration?.runtime.producesStep),
        title: node.title || registration?.label || node.id,
        typeLabel: node.type,
      },
    }
  })
}

function toFlowEdges(definition: WorkflowCanvasDefinition): WorkflowFlowEdge[] {
  return definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePort,
    target: edge.targetNodeId,
    targetHandle: edge.targetPort,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: 'var(--glass-tone-info-fg)', strokeWidth: 1.8 },
    selected: false,
    deletable: true,
    data: {},
  }))
}

function WorkflowCanvasEditor({
  definition,
  selectedNodeId,
  onDefinitionChange,
  onSelectNode,
  t,
}: Props) {
  const projectedNodes = useMemo(() => toFlowNodes(definition, selectedNodeId), [definition, selectedNodeId])
  const projectedEdges = useMemo(() => toFlowEdges(definition), [definition])
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(projectedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowFlowEdge>(projectedEdges)

  useEffect(() => setNodes(projectedNodes), [projectedNodes, setNodes])
  useEffect(() => setEdges(projectedEdges), [projectedEdges, setEdges])

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    onDefinitionChange(connectWorkflowCanvasNodes(definition, {
      sourceNodeId: connection.source,
      sourcePort: connection.sourceHandle || undefined,
      targetNodeId: connection.target,
      targetPort: connection.targetHandle || undefined,
    }))
  }, [definition, onDefinitionChange])

  const handleNodeDragStop: OnNodeDrag<WorkflowFlowNode> = useCallback((_event, node) => {
    onDefinitionChange(updateWorkflowCanvasNodePosition(definition, node.id, node.position))
  }, [definition, onDefinitionChange])

  const handleNodesDelete: OnNodesDelete<WorkflowFlowNode> = useCallback((deletedNodes) => {
    const nextDefinition = deletedNodes.reduce(
      (current, node) => removeWorkflowCanvasNode(current, node.id),
      definition,
    )
    onDefinitionChange(nextDefinition)
  }, [definition, onDefinitionChange])

  const handleEdgesDelete: OnEdgesDelete<WorkflowFlowEdge> = useCallback((deletedEdges) => {
    const nextDefinition = deletedEdges.reduce(
      (current, edge) => removeWorkflowCanvasEdge(current, edge.id),
      definition,
    )
    onDefinitionChange(nextDefinition)
  }, [definition, onDefinitionChange])

  return (
    <section className="glass-surface flex min-h-[620px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--glass-stroke-base)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
          <AppIcon name="link" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
          {t('canvas')}
        </h2>
        <span className="text-xs font-semibold text-[var(--glass-text-tertiary)]">
          {definition.nodes.length} / {definition.edges.length}
        </span>
      </div>
      <div className="workflow-flow-canvas h-[560px] min-h-[560px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_event, node) => onSelectNode(node.id)}
          onNodeDragStop={handleNodeDragStop}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={{ padding: 0.28 }}
          minZoom={0.35}
          maxZoom={1.6}
          colorMode="light"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--glass-stroke-subtle)" gap={22} size={1} variant={BackgroundVariant.Dots} />
          <MiniMap pannable zoomable nodeBorderRadius={8} className="!bg-[var(--glass-bg-surface)]" />
          <Controls className="!border !border-[var(--glass-stroke-base)] !bg-[var(--glass-bg-surface)]" />
        </ReactFlow>
      </div>
    </section>
  )
}

export default function WorkflowCanvasPreview(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasEditor {...props} />
    </ReactFlowProvider>
  )
}
