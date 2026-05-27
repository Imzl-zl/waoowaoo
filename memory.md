# waoowaoo 项目状态

> 当前状态快照 + 最近活跃窗口。完整历史看 `memory/archive/`，稳定命令和模式看 `tools.md`。

## 当前基线
- 最后更新：2026-05-27
- 栈：Node.js `>=18.18.0` / npm `>=9.0.0` / Next.js 15 / React 19 / Prisma + MySQL / BullMQ + Redis / MinIO / NextAuth / Temporal TS SDK / Vitest。
- 启动链路：`cp .env.example .env` -> `docker compose up mysql redis minio -d` -> `npx prisma db push` -> `npm run dev`。
- 验证基线：`npm run verify:commit`、`npm run verify:push`、`npm run test:guards`、`npm run check:file-line-count`。
- 当前重点：visual workflow foundation、production-bible foundation、Production Prep workspace MVP 和兼容冗余清理均已完成当前切片；下一步应围绕 scene/shot 细化工作台、novel-promotion 映射或媒体生成接入做独立切片。

## 已完成能力
- 既有小说 / 剧本 / 分镜 / 配音 / 视频 workflow、BullMQ workers、watchdog、bull-board、graph run runtime、provider model config、media storage 和中英双语 App Router/API 契约已经形成。
- Temporal 基础边界已入仓：SDK/worker 显式入口、start/launch bridge、GraphRun metadata、run/step lifecycle read-model + Redis publish、failure projection、cancel API、run-task wrapper、task lifecycle context、text handler context、run-task contract。
- 架构复核结论已入仓：`docs/workflow-architecture-decision.md` 选择 Temporal durable kernel + Redis/SSE 高频事件 + 可选 LangGraph Activity 子图；PG 替换不纳入当前切流。
- Visual workflow builder child #1 完成：`WorkflowCanvasDefinition`、node catalog、validator、graph/connectivity 校验、compiler、内置 definitions 和 registry 编译桥。
- Visual workflow builder child #2 完成：`WorkflowDefinition` / `WorkflowDefinitionVersion` Prisma models、migration、`definition-store`、项目级 `/api/projects/[projectId]/workflows/**` 草稿/发布 API 和 contract tests。
- Visual workflow builder child #3 完成：`/workspace/[projectId]/workflows` DSL-first UI shell、query hooks、`canvas-editor`、节点 palette、顺序 preview、inspector、validation panel、保存草稿和发布控件。
- Visual workflow builder child #4 完成：`getProjectPublishedWorkflowDefinitionVersion`、`PublishedWorkflowExecutionPlan` types、`buildPublishedWorkflowExecutionPlan`、`getProjectPublishedWorkflowExecutionPlan`、`assertPublishedWorkflowExecutionPlanExecutable`；published version 可编译成 Temporal step descriptors，并显式报告 unsupported nodes。
- Visual workflow builder child #5 完成：新增 `runtime.smoke` 可执行节点、published workflow execute service/API、Temporal smoke plan step descriptors、UI Run 控件和单测/contract 覆盖；已发布的 smoke workflow 可创建 run 并启动 Temporal smoke。
- Visual workflow builder child #6 完成：引入 `@xyflow/react`，将线性 preview 替换为真实 React Flow 画布；拖拽位置、连线、删边/删节点通过 `canvas-editor` helper 回写 `WorkflowCanvasDefinition`，不持久化 React Flow 私有状态。
- Visual workflow builder child #7 完成：新增 catalog-driven node config schema、默认 config helper、DSL config 校验和通用 Inspector 表单；配置字段真值在 `node-config-catalog.ts` / `WorkflowNodeTypeRegistration.configSchema`。
- Visual workflow builder child #8 完成：新增 dedicated `publishedWorkflow` Temporal workflow、`executePublishedWorkflowStep` Activity、runtime executor registry、deterministic `data.transform` 支持，将 `input.user` 接为真实执行 step，将 `artifact.persist` 接入 run-runtime `GraphArtifact` 幂等 upsert，将 `llm.transform` / `llm.analysis` 接入现有模型配置、AI runtime 和同步文本计费边界，并将 `media.generate(image|video|audio)` 接入 provider/storage/billing/cache 与外部任务 checkpoint 边界；`runtime.smoke`、`input.user`、`data.transform`、`artifact.persist`、`llm.transform`、`llm.analysis` 与 `media.generate(image|video|audio)` 当前可执行。
- Visual workflow builder child #9 / final audit 完成：builder execute 改用 `usePublishedWorkflowRunStream`，published workflow queued/running `runId` 通过 shared run-stream 读取 `/api/runs/:runId/events`，`WorkflowRunStatePanel` 展示 run id、run 状态、进度、ordered step 状态、错误与输出摘要。
- Production bible foundation 完成：新增 `src/lib/production-bible/` 严格 schema、语义校验、节点输出解析和提示词构造；新增 `story.extractBible`、`story.planEpisodes`、`scene.breakdown`、`shot.plan`、`human.review` 节点；published workflow runtime 通过现有 LLM Activity/model/billing/cache 边界执行前四个 production 节点，并严格解析为 production-prep 结构；`human.review` 产出显式 review checkpoint。
- Production Prep workspace MVP 完成：新增项目级 `ProjectProductionPrep` 真值源、`src/lib/production-prep/**` service/store/generation/merge 边界、项目级 production-prep API、React Query hooks、`/workspace/[projectId]/production-prep` 工作台、锁定保留冲突摘要和中英文文案。
- 兼容冗余清理完成：删除 production/published workflow runtime 中无调用的支持判断 helper 和 `workflow-engine/node-types.ts` 转发壳；直接依赖读取收敛到 `published-workflow-step-context.ts`，仍保持缺失依赖显式失败。
- 全仓旧兼容清理当前切片完成：删除无引用旧脚本/dev routes/workspaceRedesign 文案/旧 generator alias/`LegacyMediaRefBackup`；收紧 `novel-promotion panel PATCH` 为 `panelId` 唯一路径；移除 logging 旧签名 overload、`ProjectAuthContext` alias、`customPricing.input/output` 旧价格结构和对应迁移入口。

## 进行中 / 未完成
- `submitTask` 默认仍走 BullMQ；Temporal 只在显式 `TASK_EXECUTION_RUNTIME=temporal_run_task` 且支持 task type 时使用。
- 用户发布的 visual workflow 已接入 dedicated published runtime；LLM 文本节点、`media.generate(image|video|audio)` 和 production-prep 节点已接入 real Activities。当前 visual workflow child deliverables #1-#9、production-bible foundation 和 Production Prep workspace MVP 均完成。
- `.codex-tasks/20260526-visual-workflow-builder-epic/` final validation 已通过；当前目标范围内已能 UI 创建/连接/配置/校验/发布/执行并观察 run/step 状态。
- README 仍标注项目处于测试初期，数据库兼容和升级策略仍在快速迭代。
- 仓库当前有未提交/未跟踪改动来自本轮 Production Prep workspace；不要清理无关 `.serena/` 或他人改动。

## 关键决策
- API route 默认是 `apiHandler` + 显式鉴权 + 薄协议壳；业务逻辑进 `src/lib/**`。
- 模型 capability / pricing 真值来自 `standards/*` 和 `src/lib/model-config-contract.ts`，禁止业务代码复制硬编码。
- 任务目标状态通过 query / SSE / run-runtime 管理，不引入 polling 或组件局部镜像状态。
- 可视化 workflow 采用 UI-agnostic DSL + node catalog + validator + compiler；React Flow 只能做编辑体验，不能成为后端真值。
- React Flow 画布是 `WorkflowCanvasDefinition` 的 UI 投影；新增画布交互必须回写 DSL helper，不允许保存 React Flow viewport/nodes/edges 为后端真值。
- workflow draft 可保存静态校验失败的合法 DSL；publish 必须重新校验通过并创建不可变递增版本。
- runtime adapter 只能消费 published `WorkflowDefinitionVersion`，不能执行 draft、React Flow state 或 UI 局部状态。
- workflow builder 运行状态必须复用 `usePublishedWorkflowRunStream`、shared run-stream executor 和 run-runtime events/read-model；不要在 builder 里新增第二套 polling/state mirror。
- node config schema 是 catalog/DSL 边界的一部分；Inspector 只做 schema renderer，validator 负责发布前校验，provider secret 不允许进入 workflow definition。
- Temporal published workflow execution launch 前必须检查 `assertPublishedWorkflowExecutionPlanExecutable`，unsupported nodes 必须显式失败，不允许 no-op、mock success 或 BullMQ fallback。
- Temporal published workflow 使用 `TEMPORAL_WORKFLOW_TYPE.PUBLISHED_WORKFLOW`，通过 `executePublishedWorkflowStep` Activity 执行显式支持的节点；支持判断和 dispatch 都来自同一个 executor registry。
- `runtime.smoke`、`input.user`、`data.transform`、`artifact.persist`、`llm.transform`、`llm.analysis` 与 `media.generate(image|video|audio)` 是当前可执行的 visual workflow 节点。
- `story.extractBible`、`story.planEpisodes`、`scene.breakdown`、`shot.plan` 和 `human.review` 是当前可执行的 production-prep visual workflow 节点；前四个复用 LLM Activity/model/billing/cache 后严格解析为 production-bible schema，`human.review` 只记录 checkpoint，不伪造已审批。
- 项目级 Production Prep 长期真值在 `ProjectProductionPrep.document`；workflow run artifact 只能作为生成过程产物，不替代保存后的 Production Prep 文档。
- Production Prep 自动生成必须通过 `src/lib/production-prep/merge.ts` 的锁定策略，保留 locked characters/locations/props/style/continuity 并返回显式 conflicts。
- Published workflow execute API 接受结构化 execution input；`input.user` Activity 读取 `config.outputKey`，缺少输入时显式失败，不做空值 fallback 或 mock output。
- `artifact.persist` Activity 只把直接依赖 step 的 `artifactPayload` 通过 run-runtime `createArtifact` 幂等写入 `GraphArtifact`；它不是媒体资产入库，不处理 storage key、signed URL、provider output 或计费。
- `llm.transform` / `llm.analysis` Activity 只保存 instruction/outputFormat/temperature 等非 secret 配置；模型从项目/用户 `analysisModel` 解析，provider key 仍通过既有 `api-config` 边界读取；调用走 `executeAiTextStep`，计费走 `withTextBilling`，成功结果缓存为 `workflow.llm.result` GraphArtifact。
- `media.generate(image)` Activity 只保存 prompt/mediaKind/imageModelSlot/aspectRatio 等非 secret 配置；模型从项目/用户 image model slot 解析，provider key 仍通过既有配置边界读取；调用走 `generateImage`，计费走 `withImageBilling`，存储走 `processMediaResult` + `ensureMediaObjectFromStorageKey`，成功结果缓存为 `workflow.media.result` GraphArtifact。async/externalId 通过 `workflow.media.external-job` checkpoint 恢复，避免 retry 重复提交外部媒体任务。
- `media.generate(video)` Activity 通过项目 `videoModel` 解析模型，源图只允许直接上游 `media.generate(image)` 产物，调用走 `generateVideo`，计费走 `withVideoBilling` 并提取 `actualVideoTokens`，存储走 `processMediaResult(type='video')` + `ensureMediaObjectFromStorageKey`；planner 会在 launch 前拒绝没有直接 image media 依赖的视频节点。
- `media.generate(audio)` Activity 通过项目 `audioModel` 解析模型，文本来自节点 prompt 加直接依赖上下文，节点 config 必须显式提供 `audioVoice`，可配置 `audioRate` 和 `audioMaxFreezeSeconds`；调用走 `generateAudio`，计费走 `withVoiceBilling` 并提取 `actualDurationSeconds` / `actualSeconds`，存储走 `processMediaResult(type='audio')` + `ensureMediaObjectFromStorageKey`。
- workflow shared node type contract 在 `src/lib/workflow-contract/node-types.ts`；不要让 `workflow-engine` 与 `workflow-runtime` 互相引用。
- Published visual workflow Activity context 当前只传直接 `dependsOn` 结果；未来如需任意上游变量引用，先显式扩展 DSL/data-scope contract。
- Published workflow 直接依赖读取统一走 `src/lib/workflow-runtime/temporal/published-workflow-step-context.ts`；不要在 LLM、media、production、artifact 或 workflow loop 中复制缺失依赖检查。
- 新增 workflow node type 先进入 `node-catalog.ts`，再接 UI palette、validator、runtime adapter；不要复制节点能力、端口或默认 runtime 语义。
- canvas compiler 必须保留跨非 step 节点的真实 step 依赖；validator 必须拒绝 cycle、断开节点岛、缺 trigger/output、错误端口和重复 step key。
- Temporal 迁移继续 strangler：保留 BullMQ/run-runtime，逐步迁移单个业务 workflow；在 billing Saga、artifact 幂等、read model、SSE、cancel/retry 闭环前不删除旧链路。

## 坑点
- 首次本地启动前必须 `npx prisma db push`，否则会缺表。
- 大量 `tsx --env-file=.env` 脚本依赖 `.env`。
- 本地端口以 `.env.example` / `docker-compose.yml` 为准：MySQL `13306`、Redis `16379`、MinIO `19000`。
- Temporal worker 不随默认 `npm run dev` / `npm run start` 启动，需要 `npm run dev:temporal-worker` 或 `npm run start:temporal-worker`。
- DB-backed integration tests 可能通过 `docker-compose.test.yml down -v --remove-orphans` 清掉本地服务，跑完要按需重启基础设施。
- `.dockerignore` 排除 Markdown / tests / docs / AGENTS；容器内不是协作文档真值。

## 最近活跃窗口
- 2026-05-27：完成 Production Prep workspace MVP。新增项目级 `project_production_preps` Prisma model/migration、`src/lib/production-prep` service 边界、GET/PUT/extract/plan-episodes API、React Query hooks、`/workspace/[projectId]/production-prep` 工作台和 route/unit 覆盖。验证：production-prep 定向 4 files / 17 tests、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check`、Prisma schema validate 通过；sqlite schema 需用 sqlite URL 校验。
- 2026-05-27：完成 child #8 Business node runtime Activities。新增 dedicated `publishedWorkflow`、`executePublishedWorkflowStep` Activity、published node executor registry、`data.transform`、structured `input.user`、`artifact.persist`、`llm.transform` / `llm.analysis`、`media.generate(image)`、async external-job checkpoint/resume、`media.generate(video)` 和 `media.generate(audio)`。audio 独立走 `audioModel`、`audioVoice`、`audioRate`、`audioMaxFreezeSeconds`、`generateAudio`、`withVoiceBilling(actualDurationSeconds/actualSeconds)`、`processMediaResult(type='audio')`。目标 workflow-engine/runtime/API/UI/billing 测试 9 files / 100 tests、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过。
- 2026-05-27：完成全仓旧兼容/冗余清理当前切片。删除旧一次性脚本、dev routes、workspaceRedesign 文案、旧 generator alias、`LegacyMediaRefBackup`、`customPricing.input/output` 迁移入口；logging 和 project action 日志只保留 canonical signature；`novel-promotion panel PATCH` 只接受 `panelId`。验证：API/worker/user-api-config/generator 定向测试、Prisma validate、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过。
- 2026-05-27：完成 production-bible foundation。新增影视前期准备资产 contract、production 节点 catalog/config/runtime、严格 LLM 输出解析、架构文档和单测。验证：production-bible/workflow-engine/runtime 定向 4 files / 50 tests、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过。
- 2026-05-27：完成兼容冗余清理。删除 `isProductionWorkflowNodeType` / `PRODUCTION_NODE_TYPES` / `isTemporalPublishedWorkflowNodeSupported` 和 `workflow-engine/node-types.ts` 转发壳；新增 `published-workflow-step-context.ts` 统一直接依赖读取。验证：production-bible/workflow-engine/runtime 定向 5 files / 66 tests、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过。
- 2026-05-27：完成 final run observability / epic audit。`WorkflowBuilderShell` 执行 published workflow 后通过 `usePublishedWorkflowRunStream` 观察 `/api/runs/:runId/events`；新增 `WorkflowRunStatePanel` 显示 run/step 状态。验证：run-stream/组件 5 files / 25 tests、workflow matrix 11 files / 107 tests、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过。
- 2026-05-27：完成 child #7 Node configuration schema and forms。新增 `node-config-catalog.ts`、`node-config.ts`、`canvas-config-validation.ts` 和 `WorkflowNodeConfigForm.tsx`；目标 canvas 测试、`registry.test.ts`、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过；浏览器烟测在拦截 API 后渲染 3 nodes / 2 edges，schema-driven `Message` config 可见，console errors 0。`npm run dev` 因本地 MinIO 未启动失败，`dev:next` 期间 MySQL/Redis 未启动错误按真实环境问题保留。
- 2026-05-27：完成 child #6 React Flow canvas editor。新增 `@xyflow/react`、真实拖拽/连线画布、DSL edge/position helpers 和对应单测；目标 canvas 测试、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过；浏览器烟测在拦截最小 API 后渲染 2 nodes / 1 edge，console errors 0，React Flow warnings 0。
- 2026-05-27：完成 child #5 End-to-end smoke workflow。新增 `runtime.smoke`、published workflow execute service/API、Temporal smoke step descriptors 和 UI Run 控件；目标 execution-plan/execution/temporal/route 测试、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过。
- 2026-05-27：完成 visual workflow builder child #4 Runtime execution adapter。官方资料复核后继续选择 DSL + catalog + compiler + planner；新增 published-version read service 和 execution plan adapter；目标 workflow-engine 单测、`typecheck`、`check:file-line-count`、`test:guards`、`git diff --check` 通过。
- 2026-05-27：完成 child #3 Canvas UI shell。新增 `/workspace/[projectId]/workflows`、query hooks、`canvas-editor`、palette、preview、inspector、validation panel、save/publish controls 与 zh/en 文案；浏览器 smoke 路由 200，API 401 源于未登录。
- 2026-05-26：完成 child #2 persistence/API。新增 Prisma models、migration、definition-store、项目级 workflow API、route catalog/tests；目标 service/route 测试、typecheck、guards、Prisma schema validate 通过。
- 2026-05-26：完成 child #1 definition contract。新增 visual workflow 架构文档、canvas DSL、node catalog、validator/compiler 和 registry bridge；目标单测、typecheck、guards 通过。
- 2026-05-26：完成 Temporal 架构复核和 run-task contract 收敛；结论继续 Temporal kernel + Redis/SSE + 可选 LangGraph Activity 子图。
