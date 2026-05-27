---
name: 可视化工作流编排器架构设计
description: waoowaoo Coze-like workflow builder foundation
type: architecture
updated: 2026-05-27
---

# 可视化工作流编排器架构设计

## 目标

最终目标是提供类似扣子 / Dify / n8n 的可视化工作流能力：用户可以在画布上拖拽节点、连接流程、配置模型/工具/媒体任务、校验、发布并运行。

当前改造仍以架构基础优先：UI 可以快速迭代，但后端真值必须是项目自有 DSL、节点目录、校验器、发布版本和执行计划。核心原因是：如果 UI 节点结构直接变成后端真值，后续执行器、权限、版本迁移、Temporal 编排和计费都会被前端组件耦死。

## 参考结论

- Coze/Coze Studio：节点扩展围绕 node type、node registry、form metadata、stage node、DTO/VO 转换、后端 NodeSchema、NodeAdaptor、NodeBuilder 和单节点试运行；node type 需要前后端约定，说明 workflow schema 不能只由画布组件私有状态决定。
- Dify：Workflow/Chatflow 支持拖拽节点编排、串行/并行结构、节点输入输出和 tracing logs；运行时关注节点执行结果而不只是画布形态。
- n8n：workflow 是 connected nodes 的集合，执行、调试和共享都围绕 workflow definition。
- React Flow：官方定位是构建 node-based editors / interactive diagrams，内建拖拽、缩放、选择、增删节点/边；适合作为前端画布层，但不应该成为后端 workflow DSL。
- Temporal：workflow definition / execution / event history 适合承载长任务和可恢复执行；Workflow 必须 deterministic，外部 API、DB、LLM、文件 I/O 应放在 Activity。

## 方案取舍

### 方案 A：React Flow state 直接持久化为后端真值

- 优点：UI 起步最快，前端开发成本最低。
- 缺点：后端校验、发布、版本迁移、执行计划和计费会被前端组件字段耦死。
- 结论：不采用。React Flow 可以作为编辑器实现，但保存/发布必须写入项目自有 DSL。

### 方案 B：自有 WorkflowCanvasDefinition + node catalog + validator + compiler

- 优点：UI、API、持久化、执行计划和运行时 adapter 都依赖同一份稳定 contract。
- 优点：节点类型、端口、运行语义、默认重试和产物类型集中在 node catalog，后续扩展不产生第二真值源。
- 优点：可以先把内置 workflow 迁到同一 definition layer，再逐步接 draft/publish、UI 和 Temporal adapter。
- 成本：前期多一层编译和静态校验。
- 结论：采用。它是当前项目长期维护和扩展成本最低的方案。

### 方案 C：直接引入 Dify / n8n / Coze Studio 运行时模型

- 优点：成熟产品能力多，节点生态完整。
- 缺点：会绕开当前项目已有 task、run-runtime、provider、media、billing、Temporal metadata 和 SSE read model 边界。
- 结论：不采用。可以借鉴产品结构和节点模式，但不能替换项目运行内核。

## 分层

```
Canvas UI
  - React Flow / palette / inspector / validation panel
  - 只编辑 WorkflowCanvasDefinition

Definition Layer
  - WorkflowCanvasDefinition
  - Node catalog
  - Port/config metadata
  - Static validator
  - Connectivity / cycle validation
  - Version migration

Persistence/API
  - Draft / Published definitions
  - Project/user permissions
  - Import/export

Execution Planner
  - Compile published definition to execution plan
  - Topological order / dependency graph
  - Unsupported node failures

Runtime Adapters
  - Temporal durable workflow adapter
  - Legacy BullMQ adapter during migration
  - High-frequency Redis/SSE stream remains separate
```

## 当前落地状态

当前已落地的链路：

- `WorkflowCanvasDefinition`：稳定的 UI-agnostic DSL。
- `WorkflowNodeTypeRegistration`：节点目录，描述分类、端口、默认重试、是否产生 run step。
- `validateWorkflowCanvasDefinition`：静态校验，返回显式错误列表。
- `compileWorkflowCanvasDefinition`：把合法定义编译为现有 `WorkflowDefinition`。
- `WorkflowDefinition` / `WorkflowDefinitionVersion`：草稿可保存、发布版本不可变且递增。
- `/workspace/[projectId]/workflows`：React Flow 画布、palette、inspector、validation panel、save/publish/run 控件。
- `PublishedWorkflowExecutionPlan`：只消费已发布版本，生成 Temporal step descriptors，并在 launch 前拒绝 unsupported nodes。
- `publishedWorkflow` Temporal runtime：通过 `executePublishedWorkflowStep` Activity 执行支持节点；provider、DB、storage、billing 都留在 Activity。
- 当前支持节点：`runtime.smoke`、`input.user`、`data.transform`、`artifact.persist`、`llm.transform`、`llm.analysis`、`media.generate(image|video|audio)`、`story.extractBible`、`story.planEpisodes`、`scene.breakdown`、`shot.plan`、`human.review`。

## 边界规则

- UI 可以用 React Flow，但保存/发布的不是 React Flow 私有结构，而是项目自己的 DSL。
- 节点新增必须先进入 node catalog，再进入 UI palette 和 runtime adapter。
- 校验器不做静默修复；错误必须携带 code 和 node/edge 引用。
- 执行器只消费已发布定义；草稿可以保存但不能直接运行。
- 用户配置和 provider secret 不写入 workflow definition，只引用现有配置边界。
- Temporal 仍是 durable kernel；LangGraph 只作为复杂 Agent 节点内部实现，不作为全局 workflow 真源。
- 编译器必须保留跨非 step 节点的真实依赖；路由、合并、条件节点不应该让下游 step 丢失上游 step 依赖。
- 断开的节点岛必须在发布前失败，不能靠运行时忽略。
- `media.generate(video)` 必须直接依赖一个 `media.generate(image)` step；跨层变量引用要先进入 DSL/data-scope contract，不能偷传全量历史。
- audio/TTS 不复用 video/image 语义；`media.generate(audio)` 单独使用 `audioModel`、`audioVoice`、`audioRate`、`audioMaxFreezeSeconds`、`generateAudio`、`withVoiceBilling`、`processMediaResult(type=audio)` 和 `workflow.media` artifacts。

## 参考资料

- Dify Workflow & Chatflow docs: https://docs.dify.ai/en/use-dify/build/workflow-chatflow
- Dify key concepts: https://docs.dify.ai/en/use-dify/getting-started/key-concepts
- n8n Workflows docs: https://docs.n8n.io/workflows/
- React Flow core concepts: https://reactflow.dev/learn/concepts/core-concepts
- Temporal Workflow docs: https://docs.temporal.io/workflows
- Coze Studio node type guide: https://github.com/coze-dev/coze-studio/wiki/10.-Add-new-workflow-node-types-(frontend)
- Coze Studio backend node guide: https://github.com/coze-dev/coze-studio/wiki/11.-%E6%96%B0%E5%A2%9E%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%8A%82%E7%82%B9%E7%B1%BB%E5%9E%8B%EF%BC%88%E5%90%8E%E7%AB%AF%EF%BC%89
