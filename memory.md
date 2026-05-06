# waoowaoo 项目状态

> 本文件是当前状态快照 + 最近活跃窗口，允许覆盖更新。
> 完整历史归档见 `memory/archive/`，稳定规律见 `tools.md`。

## 当前基线
- 运行栈：Node.js `>=18.18.0` / npm `>=9.0.0` / Next.js 15 / React 19 / Prisma + MySQL / BullMQ + Redis / MinIO / NextAuth / Temporal TS SDK / Vitest。
- 常用启动链路：`cp .env.example .env` -> `docker compose up mysql redis minio -d` -> `npx prisma db push` -> `npm run dev`。
- 验证基线：`npm run verify:commit`、`npm run verify:push`、`npm run test:guards`、`npm run check:file-line-count`。
- 最后更新：2026-05-06

## 已完成能力
- 小说 / 剧本 / 分镜 / 配音 / 视频相关工作流已经落地，包含角色、场景、道具分析与多阶段 storyboard 流程。
- 多 provider 模型配置中心已经具备 capability catalog、pricing catalog、capability validation、用户配置持久化和价格展示链路。
- BullMQ image / video / voice / text workers、watchdog、bull-board 与 graph run runtime 已接通，可追踪任务生命周期、step / event / checkpoint 和 retry invalidation。
- Temporal TypeScript 第一阶段边界已入仓：`src/lib/workflow-runtime/temporal/` 包含 config/client/worker/workflow/activity/contract，`scripts/temporal-worker.ts` 提供显式启动入口，但默认 `dev` / `start` 仍不切换。
- Temporal 启动边界已入仓：`startTemporalWorkflowRun` / `startTemporalWorkflowRunWithClient` 统一 workflowId、taskQueue、run input 校验和 client 注入，仍不接管现有 BullMQ 链路。
- `GraphRun` read model 已具备 Temporal execution metadata：`temporalWorkflowId`、`temporalFirstExecutionRunId`、`temporalTaskQueue`，并由 `recordTemporalWorkflowStart` 显式写入。
- Temporal launch bridge 已入仓：`launchTemporalWorkflowRun` 串联启动与 `GraphRun` metadata 投影。
- Task execution launcher boundary 已入仓：`src/lib/task/execution-launcher.ts` 让 `submitTask` 通过 `launchTaskExecution` 启动执行；默认仍走 BullMQ，显式 `TASK_EXECUTION_RUNTIME=temporal_run_task` 只支持 `story_to_script_run` / `script_to_storyboard_run` 并调用 `launchTemporalWorkflowRun`。
- Temporal run cancel API 已接入：`requestManagedRunCancel` 会在 run 带有 `temporalWorkflowId + temporalFirstExecutionRunId` 时调用 `cancelTemporalWorkflowRun`，legacy linked task 仍保留 `cancelTask` 路径。
- Temporal run lifecycle read-model 投影已入仓：`recordTemporalRunLifecycleEvent` 生成 `GraphEvent.idempotencyKey` 并写入低频 lifecycle 事件，`recordWorkflowStarted` / `recordWorkflowCompleted` Activity 会投影 `run.start` / `run.complete`。
- Temporal lifecycle publish boundary 已入仓：`publishTemporalRunLifecycleEvent` 复用同一幂等 `RunEventInput` 后调用 `publishRunEvent`，Temporal Activities 现在会把低频 run/step lifecycle 发布为 Redis `run.event`。
- Temporal smoke workflow 已形成最小 run + step read-model 生命周期闭环：`run.start -> step.start -> step.complete -> run.complete`，返回的 `TemporalWorkflowRunResult` contract 保持不变。
- Temporal step lifecycle 已具备通用 descriptor boundary：step Activities 可接受 `TemporalWorkflowStepDescriptor`，payload 会携带 `stepKey`、`stepTitle`、`stepIndex`、`stepTotal`、`stepAttempt`，未传时默认 smoke step。
- Temporal failure lifecycle projection boundary 已接入 run-task 业务链路：`recordWorkflowStepFailed` / `recordWorkflowFailed` 可显式写入 `step.error` / `run.error`，payload contract 固定 `errorCode`、`message` / `errorMessage` 和可选 `retryable`。
- Temporal run-centric text task wrapper workflow 已入仓：`runTaskWorkflow` / `executeRunCentricTask` 支持 `story_to_script_run` 与 `script_to_storyboard_run`，通过 `TaskExecutionContext` 复用 worker lifecycle，以持久化 `Task.status=completed` 作为 workflow 成功条件，并在执行 Activity 失败后投影 `step.error` / `run.error` 后 rethrow 原错误。
- Worker task lifecycle context boundary 已入仓：`src/lib/workers/shared.ts` 暴露 `TaskExecutionContext` / `withTaskLifecycleContext` / `reportTaskProgressContext`，BullMQ worker 入口继续通过 `withTaskLifecycle(job, handler)` adapter 兼容。
- Run-centric text handler context boundary 已入仓：`story_to_script_run` / `script_to_storyboard_run` 已有 context-native handler；Temporal `runTextTaskHandlerWithContext` 直接 dispatch context handler，不再创建 fake legacy Job。
- `GraphEvent` 已支持可选 `idempotencyKey` 唯一键；携带幂等键调用 `appendRunEventWithSeq` 时重复写入会返回已有事件，不重复追加。
- 媒体存储链路已统一到 storage key / signed URL 归一化，MinIO / S3 兼容路径与 `/m/*` 媒体路由均有服务端处理入口。
- `next-intl` 中英双语界面、App Router 页面和 API 路由契约已经形成，并配套 guard / test matrix。
- 2026-04-10 的 `20260410-project-optimization-epic` 已完成，`api-config`、LLM / provider adapter、worker runtime、前端热点和 persistence 边界已完成第一轮职责拆分并通过最终验收。

## 进行中 / 未完成
- `README.md` 明确项目仍处测试初期，功能和稳定性持续快速迭代中，版本升级时数据库兼容策略尚未稳定。
- `docs/project-workflow-refactor-analysis.md` 记录长期方向：Temporal 做 durable workflow kernel、LangGraph 做可选 Agent 子引擎、未来 PG 替换 MySQL；当前已完成 Temporal 运行时、启动、metadata、lifecycle 投影与发布、run cancel API 接入、failure boundary、smoke run+step 生命周期闭环、run-task failure projection、run-centric text task wrapper、task execution launcher boundary、task lifecycle context boundary 和 run-centric text handler context boundary；`submitTask` 默认调度仍走 BullMQ。
- `.gitignore` 已收敛本地任务状态和生成物噪音：新 `.codex-tasks/`、`.tmp/`、测试/浏览器报告、本地 Temporalite/SQLite 数据、缓存和 env 变体默认忽略；正式源码、测试、migrations、`docs/`、`AGENTS.md` 不忽略。
- 仓库尚无独立 `docs/specs` 文档体系；当前真值仍集中在代码、README、standards、guards 和 `tests/contracts/`。
- 当前 `.codex-tasks/20260410-project-optimization-epic/` 已收尾，仓库里未发现处于打开状态的已跟踪开发子任务。

## 关键决策（仍有效）
- API 路由默认采用 `apiHandler` + 显式鉴权，保持 HTTP 壳与业务实现分层。
- 模型 capability / pricing 的唯一真值来自 `standards/*` 和 `src/lib/model-config-contract.ts`，禁止在业务代码里硬编码替代。
- 任务目标状态通过 query / SSE / run-runtime 统一管理，不通过 polling 或局部镜像状态兜底。
- 多步骤协作默认记录在 `.codex-tasks/`；`AGENTS.md` 是唯一 canonical 规则文件。
- Temporal 迁移采用分阶段策略：先建立 SDK/runtime/start contract，再迁移单个业务 workflow；在计费 Saga、read model 投影、SSE 和 artifact 幂等边界完整前，不删除 BullMQ/run-runtime。
- Temporal start result 必须先经过 `recordTemporalWorkflowStart` 投影到 `GraphRun`，再考虑业务 workflow 切流；不要在 API route 或 submitter 中临时散写 Temporal metadata。
- 业务 workflow 后续切流时优先调用 `launchTemporalWorkflowRun`，保持启动和 metadata 投影顺序一致；记录失败应显式暴露，不作为成功启动静默吞掉。
- `submitTask` 不应直接 import/call `addTaskJob`；执行启动统一走 `launchTaskExecution`。Temporal run-task 切流必须显式配置 `TASK_EXECUTION_RUNTIME=temporal_run_task`，不支持的 task type 要显式失败，不允许回退 BullMQ。
- Temporal run-centric text task 先采用 wrapper strangler 方案：workflow 只调 Activity，Activity 内使用 `withTaskLifecycleContext`，再经 `text-task-router.ts` dispatch context-native handler；不要在 workflow deterministic 代码里访问 DB、worker lifecycle 或 provider。
- Temporal run-task Activity 不应 import BullMQ `Job` 或创建 fake BullMQ job；需要任务生命周期时构造 `TaskExecutionContext`，BullMQ 兼容 adapter 只保留在 worker handler 的 Job 入口。
- `runTextTaskHandlerWithContext` 只允许显式登记的 context-native text handler；当前支持 `story_to_script_run` / `script_to_storyboard_run`，其它 task type 要显式失败，不得自动构造 legacy Job。
- run cancel API 接入 Temporal 时必须走 `requestManagedRunCancel`；有 Temporal metadata 时必须同时提供 `temporalWorkflowId` 和 `temporalFirstExecutionRunId` 以绑定 execution chain，terminal run 不触发外部取消副作用。
- Temporal Activity 写低频 read model lifecycle 时使用 `recordTemporalRunLifecycleEvent`；不要把 `step.chunk` 这类高频流式事件混入该入口。
- Temporal Activity 需要前端实时可见的低频 lifecycle 时使用 `publishTemporalRunLifecycleEvent`；Redis publish 失败必须显式暴露，不做静默降级。
- Temporal step projection payload 必须包含 `stepTitle`、`stepIndex`、`stepTotal`，并传入稳定 `stepKey` / `attempt`，以满足 `GraphStep` 和 `GraphStepAttempt` 投影。
- 业务 workflow 后续调用 step lifecycle Activity 时应显式传 `TemporalWorkflowStepDescriptor`；不要依赖 smoke 默认 descriptor。
- Temporal failure projection payload 必须显式携带顶层 `errorCode` 与 `message` / `errorMessage`；不要传 raw `Error` 或依赖隐式 fallback 生成失败展示字段。
- Temporal completion projection 应在 workflow result 构造后执行；投影失败要显式暴露，不把 workflow 标记为成功。

## 仍需注意的坑点
- 首次本地启动前跳过 `npx prisma db push` 会直接触发缺表错误。
- `tsx --env-file=.env` 链路广泛存在；没有 `.env` 或环境变量不全会阻断本地验证。
- 本地基础设施使用非标准端口映射；需要以 `.env.example` / `docker-compose.yml` 为准，不要手工猜端口。
- `.dockerignore` 不会把 Markdown / tests / docs 打进镜像；容器内不应作为协作文档真值来源。
- Temporal worker 需要单独启动 `npm run dev:temporal-worker` 或 `npm run start:temporal-worker`；当前默认 `npm run dev` / `npm run start` 仍只启动既有 BullMQ/watchdog/bull-board 链路。
- DB-backed integration tests 需要 Docker 可用；`BILLING_TEST_BOOTSTRAP=1` 会调用 `docker compose -f docker-compose.test.yml down -v --remove-orphans`，会清掉同一 compose project 下的本地 MySQL/Redis/MinIO，跑完后需要按需重启 `docker compose up mysql redis minio -d`。

## 最近活跃窗口
- 2026-05-06：完成 `20260506-task-launcher-boundary`，新增 `src/lib/task/execution-launcher.ts`，`submitTask` 改为通过 launcher 启动执行；默认 BullMQ 不变，显式 `TASK_EXECUTION_RUNTIME=temporal_run_task` 可启动已支持的 run-centric text workflow。`execution-launcher` / `submitter-launcher` 单测、DB-backed submitter 回归、`typecheck`、`check:file-line-count`、`test:guards` 通过。
- 2026-05-06：完成 `20260506-temporal-task-context`，新增 `TaskExecutionContext` lifecycle boundary；Temporal run-task Activity 不再 import BullMQ `Job` 或创建 `createTemporalTaskJob`，BullMQ workers 仍通过 adapter 兼容。Temporal activity、worker shared、launcher / submitter 单测、`typecheck`、`check:file-line-count`、`test:guards` 通过。
- 2026-05-06：完成 `20260506-run-text-handler-context`，`story_to_script_run` / `script_to_storyboard_run` 迁到 context-native handler，`llm-stream` 和 progress / stream helper 提供 context 入口，BullMQ handler 保持 adapter。相关 worker / Temporal / launcher 单测、`typecheck`、`check:file-line-count`、`test:guards` 通过。
- 2026-05-06：完成 `20260506-run-task-failure-projection`，`runTaskWorkflow` 在 `executeRunCentricTask` 失败后投影固定 `run_task.execute` 的 `step.error` 与 `run.error`，再 rethrow 原业务错误；workflow 单测、相关 Temporal / worker / launcher 单测、`typecheck`、`check:file-line-count`、`test:guards` 通过。
- 2026-05-03：完成 `20260502-temporal-run-task-workflow`，新增 `runTaskWorkflow` / `executeRunCentricTask`，Temporal worker 现在可执行真实 run-centric text task wrapper；默认 `submitTask` 仍未切流。定向 Temporal 测试、`typecheck`、`check:file-line-count`、`check:changed-test-impact`、`test:guards` 和 Temporal 全量单测通过。
- 2026-05-02：完成 `20260502-temporal-run-cancel-api`，`/api/runs/[runId]/cancel` 改为薄 route + `requestManagedRunCancel` 协调器；Temporal-backed run 调用 `cancelTemporalWorkflowRun`，legacy linked task 仍调用 `cancelTask`，`run.canceled` 使用幂等键；定向测试、`typecheck`、`check:file-line-count`、`test:guards` 通过。
- 2026-05-02：完成 `20260502-temporal-step-descriptor-gitignore`，`.gitignore` 忽略本地 task state / 临时产物 / 测试报告 / 本地 Temporalite 数据等噪音；新增 `TemporalWorkflowStepDescriptor`，step payload builders 和 Activities 支持通用 step descriptor；Temporal 定向单测、`typecheck`、`check:file-line-count` 通过。
- 2026-05-02：完成 `20260502-temporal-lifecycle-publish-boundary`，新增 `publishTemporalRunLifecycleEvent` 并让 Temporal Activities 通过 `publishRunEvent` 发布低频 `run.event`；Temporal 定向单测、`typecheck`、`check:file-line-count` 通过，未接入业务链路。
- 2026-05-02：完成 `20260503-temporal-failure-projection`，新增 Temporal run/step failure payload contract 与 `recordWorkflowStepFailed` / `recordWorkflowFailed` Activity；Temporal 定向单测、`typecheck`、`check:file-line-count` 通过，未接入业务链路。
- 2026-05-03：完成 `20260502-temporal-smoke-step-lifecycle`，`smokeWorkflow` 现在写 `run.start -> step.start -> step.complete -> run.complete`，新增固定 smoke step contract 和 step payload builders；Temporal 定向单测、`typecheck`、`check:file-line-count` 通过。
- 2026-05-02：完成 `20260502-temporal-smoke-completion`，`smokeWorkflow` 现在写 `run.start -> run.complete`，新增 `recordWorkflowCompleted` Activity 和 completion payload contract；Temporal 定向单测、`typecheck`、`check:file-line-count` 通过。
- 2026-05-02：完成 `20260502-temporal-cancel-boundary`，新增 `cancelTemporalWorkflowRun` / `cancelTemporalWorkflowRunWithClient` 和 `tests/unit/workflow-runtime/temporal-cancel.test.ts`；定向 Temporal 单测、`typecheck`、`check:file-line-count` 通过，未接入现有 API/worker。
- 2026-05-02：完成 `20260502-temporal-run-lifecycle-events`，`GraphEvent.idempotencyKey`、幂等 `appendRunEventWithSeq`、`recordTemporalRunLifecycleEvent` 和 `recordWorkflowStarted` run.start 投影入仓；定向单测、`npx prisma generate`、`typecheck`、`check:file-line-count` 通过。
- 2026-05-01：完成 `20260501-temporal-launch-bridge`，新增 `launchTemporalWorkflowRun` 与 `tests/unit/workflow-runtime/temporal-launch.test.ts`，验证启动后记录、记录失败暴露、启动失败不记录。
- 2026-05-01：完成 `20260501-temporal-run-metadata`，`GraphRun` 增加 Temporal metadata 与 migration，`recordTemporalWorkflowStart` 和 `tests/unit/run-runtime/temporal-metadata.test.ts` 入仓，定向单测、`typecheck`、`check:file-line-count` 通过。
- 2026-05-01：完成 `20260501-temporal-start-boundary`，新增 `src/lib/workflow-runtime/temporal/starter.ts` 与 `tests/unit/workflow-runtime/temporal-starter.test.ts`，定向 Temporal 测试、`typecheck` 和 `check:file-line-count` 通过。
- 2026-05-01：完成 `20260501-temporal-workflow-kernel` 第一阶段，Temporal SDK 依赖、显式 worker 脚本、最小 workflow/activity 和基础 contract 测试入仓。
- 2026-04-10：完成 `20260410-project-optimization-epic` 收尾，`npm run test:guards` 与 `npm run check:file-line-count` 通过。
- 2026-04-10：`src/app/api/user/api-config/route.ts` 拆成 route / service / domain / persistence 边界，`check:model-config-contract` 与 `test:behavior:api` 通过。
- 2026-04-10：LLM / provider adapter 拆分完成，`chat-stream` 收敛为入口编排，`test:integration:provider` 通过。
- 2026-04-10：worker runtime 和 storyboard pipeline 改为注册表 / 分层结构，`test:integration:task` 通过。
- 2026-04-10：profile / workspace / shared UI 热点与 config persistence 收敛完成，`check:config-center-guards` 与 repo 级 file-line-count 守卫恢复全绿。
