# waoowaoo Tools

## Concepts
- 本文件记录可复用的协作知识，不替代代码、README、catalog、guard 或 contract。
- 真值优先级：`src/` + `prisma/` + `package.json` + `.env.example` / `docker-compose*.yml` -> `README.md` -> `standards/*` + `scripts/guards/*` + `tests/contracts/*` -> `AGENTS.md`。
- 主链路：UI / App Router -> API routes -> `src/lib/**` services / query / run-runtime / workers -> Prisma + MySQL / Redis + BullMQ / MinIO。

## Read First
- `README.md`
- `package.json`
- `prisma/schema.prisma`
- `scripts/guards/api-route-contract-guard.mjs`
- `scripts/guards/file-line-count-guard.mjs`
- `tests/contracts/route-catalog.ts`
- `standards/capabilities/image-video.catalog.json`
- `standards/pricing/image-video.pricing.json`

## Tools
- 环境初始化：`cp .env.example .env`
- 基础设施：`docker compose up mysql redis minio -d`
- 整站容器启动：`docker compose up -d`
- 数据库初始化：`npx prisma db push`
- 本地开发：`npm run dev`
- Temporal worker（显式启动，不在默认 dev/start 内）：`npm run dev:temporal-worker`
- 生产运行：`npm run start`
- Temporal worker 生产入口（显式启动）：`npm run start:temporal-worker`
- Canonical 验证：`npm run verify:commit`、`npm run verify:push`
- 守卫矩阵：`npm run test:guards`、`npm run check:file-line-count`、`npm run check:model-config-contract`、`npm run check:config-center-guards`、`npm run check:test-coverage-guards`
- 定向验证：`npm run test:behavior:api`、`npm run test:integration:provider`、`npm run test:integration:task`、`npm run test:billing:integration`
- 关键入口路径：`src/lib/storage/init.ts`、`src/lib/workers/index.ts`、`scripts/watchdog.ts`、`scripts/bull-board.ts`、`src/lib/run-runtime/service.ts`、`src/lib/workflow-engine/registry.ts`
- Temporal metadata 写入入口：`src/lib/run-runtime/service.ts` 的 `recordTemporalWorkflowStart`
- Temporal 显式启动+metadata 投影入口：`src/lib/workflow-runtime/temporal/launch.ts` 的 `launchTemporalWorkflowRun`
- Temporal 显式取消入口：`src/lib/workflow-runtime/temporal/cancel.ts` 的 `cancelTemporalWorkflowRun`
- run cancel 控制面协调入口：`src/lib/run-runtime/cancel.ts` 的 `requestManagedRunCancel`
- Temporal lifecycle read-model 投影入口：`src/lib/workflow-runtime/temporal/read-model.ts` 的 `recordTemporalRunLifecycleEvent`
- Temporal lifecycle Redis 发布入口：`src/lib/workflow-runtime/temporal/events.ts` 的 `publishTemporalRunLifecycleEvent`
- Temporal failure lifecycle Activity 边界：`recordWorkflowStepFailed` 写 `step.error`，`recordWorkflowFailed` 写 `run.error`，当前仍未接业务链路。
- Temporal step lifecycle Activity 已支持可选 `TemporalWorkflowStepDescriptor`；未传时默认 smoke step，后续业务 workflow 应显式传 `stepKey` / `stepTitle` / `stepIndex` / `stepTotal` / `attempt`。
- Temporal smoke workflow 当前会按 `run.start -> step.start -> step.complete -> run.complete` 写低频 read model lifecycle；它仍只在显式 Temporal worker 路径中运行，不接管业务任务。
- Temporal run-centric text task workflow：`runTaskWorkflow` -> `executeRunCentricTask`（`src/lib/workflow-runtime/temporal/run-task.ts`），当前只支持 `story_to_script_run` / `script_to_storyboard_run`，复用既有 text worker lifecycle。
- 数据 / 配置 / 约束根目录：`prisma/`、`standards/`、`messages/`、`scripts/guards/`、`tests/contracts/`、`.codex-tasks/`

## Patterns
- API route = `apiHandler` + 鉴权 + 薄协议壳；领域逻辑、归一化和持久化放进 `src/lib/**`。
- 模型配置改动通常需要同时触达 `src/lib/user-api/api-config/*`、`standards/*`、`src/lib/model-config-contract.ts` 与对应 guards / tests，而不是只改其中一处。
- workflow / task 改动通常横跨 `src/lib/task/*`、`src/lib/workers/*`、`src/lib/run-runtime/*`、`src/lib/workflow-engine/*` 与相应测试目录。
- Temporal start result 写入现有 run read model 时统一调用 `recordTemporalWorkflowStart`，不要在 API route / submitter / worker handler 里直接散写 `GraphRun` Temporal 字段。
- 单个业务 workflow 正式切流时优先经 `launchTemporalWorkflowRun` 串联 Temporal start 与 metadata 投影；当前默认任务提交链路仍不调用它。
- Temporal run-task wrapper 不写额外 smoke lifecycle；成功以持久化 `Task.status=completed` 为准，`failed` / `canceled` / `dismissed` 转 non-retryable `TASK_TERMINAL_FAILURE`。
- run cancel API 通过 `requestManagedRunCancel` 接入 Temporal cancellation；有 Temporal metadata 时必须调用 `cancelTemporalWorkflowRun` 并同时传入 `temporalWorkflowId` 与 `temporalFirstExecutionRunId`，legacy linked task 仍走 `cancelTask`。
- run cancel 只在 `requestRunCancel` 后状态为 `canceling` / `canceled` 时触发 Temporal / task 取消和 `run.canceled` 事件；terminal run 不应再触发外部取消副作用。
- Temporal Activity 写低频 run/step lifecycle projection 时走 `recordTemporalRunLifecycleEvent`；它会为 `appendRunEventWithSeq` 生成 `GraphEvent.idempotencyKey`，避免 Activity retry 重复追加事件。
- Temporal Activity 面向前端实时更新时走 `publishTemporalRunLifecycleEvent`；它复用同一幂等 `RunEventInput` 后调用 `publishRunEvent`，Redis 发布失败会显式让 Activity 失败并交给 Temporal retry。
- Temporal step lifecycle payload 必须包含 `stepTitle`、`stepIndex`、`stepTotal`，并显式传 `stepKey` / `attempt`，否则 `GraphStep` / `GraphStepAttempt` projection 信息不完整。
- Temporal step lifecycle payload 现在也携带 `stepKey` / `stepAttempt`，但 `RunEventInput.stepKey` / `attempt` 仍是投影主入口，不要只依赖 payload fallback。
- Temporal failure projection payload 顶层必须包含 `errorCode` 和 `message` / `errorMessage`；step failure 还必须保留 step 元数据，并用 `artifactPayload` 记录 `step.error` 详情。
- Temporal workflow 中先构造稳定业务 result，再通过 completion Activity 写 `run.complete`；completion 投影失败应暴露为 workflow 失败，不做成功兜底。
- 高频 token / chunk streaming 不走 Temporal lifecycle helper，仍按 Redis Pub/Sub -> SSE 分层处理。
- UI 任务状态应经过 query + SSE + target-state map 统一流转，不要用组件局部 polling 或镜像状态兜底。
- 多步骤任务默认在 `.codex-tasks/` 建档；恢复工作时先看 `TODO.csv` / `SUBTASKS.csv` 和 `PROGRESS.md`，不要依赖聊天上下文。
- `.codex-tasks/` 是本地 agent 任务状态，当前已通过 `.gitignore` 忽略新任务噪音；历史已跟踪任务 artifact 仍按 Git tracked 状态处理。

## Pitfalls
- `README.md` 明确要求在 `npm install` 之前先复制并编辑 `.env`；仓库里大量 `tsx --env-file=.env` 脚本假定该文件存在。
- Temporal worker 当前是显式入口，不会随默认 `npm run dev` / `npm run start` 自动启动；没有 Temporal Server 时启动会直接连接失败。
- 本地开发使用非标准端口映射，`mysql:13306`、`redis:16379`、`minio:19000` 已由 `.env.example` 和 `docker-compose.yml` 预设。
- 首次本地启动前跳过 `npx prisma db push` 会导致缺表错误，例如 `The table 'tasks' does not exist`。
- 浏览器走纯 HTTP 时可能受并发连接限制导致卡顿；README 给出的 `caddy run --config Caddyfile` 是本地 HTTPS 方案。
- 版本升级时 README 明确要求必要时执行 `docker compose down -v`、重新拉取 compose 文件并清浏览器缓存。
- `.dockerignore` 会排除 `*.md`、`tests`、`docs`、`AGENTS.md` 等内容；容器运行时不能作为协作文档真值来源。
