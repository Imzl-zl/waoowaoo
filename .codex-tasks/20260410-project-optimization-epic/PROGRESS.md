# Progress Log

## Session Start

- **Date**: 2026-04-10
- **Task name**: `20260410-project-optimization-epic`
- **Task dir**: `.codex-tasks/20260410-project-optimization-epic/`
- **Spec**: See `EPIC.md`
- **Plan**: See `SUBTASKS.csv` (7 child tasks)
- **Environment**: Next.js 15 / React 19 / Prisma / BullMQ / Vitest

## Context Recovery Block

- **Current milestone**: #7 — Run final regression and close epic
- **Current status**: DONE
- **Last completed**: #7 — final regression and epic closeout are complete
- **Current artifact**: `tasks/20260410-finalize/`
- **Key context**: 本轮已补齐本地 `.env` 与 Docker/MySQL/Redis 测试环境，重新跑通了此前被环境阻塞的 `check:model-config-contract`、`test:behavior:api`、`test:integration:task`，并完成 `test:guards` 与 `check:file-line-count` 作为最终验收。所有子任务现已关闭。
- **Known issues**: 无。
- **Next action**: Epic 已收尾，无待执行项。

## Milestone 0: Planning skeleton created

- **Status**: DONE
- **Started**: 12:29
- **Completed**: 12:29
- **What was done**:
  - 创建 Epic 级别优化方案骨架。
  - 将优化工作拆为 7 个有依赖关系的子任务。
  - 为每个子任务定义了收敛目标与验证命令。
- **Key decisions**:
  - Decision: 采用 Epic 而不是单个 TODO 列表。
  - Reasoning: 本次优化跨越配置中心、运行时、worker、前端与持久化边界，已经超过单一上下文能安全承载的范围。
  - Alternatives considered: 使用单个 TODO.csv；结论是不利于分阶段验收和后续恢复。
- **Problems encountered**:
  - Problem: 当前仓库未安装依赖，无法直接把 `typecheck` 作为可信基线。
  - Resolution: 将守卫与结构性验证命令作为首轮基线，把依赖安装作为执行阶段前置条件。
  - Retry count: 0
- **Validation**: `test -f .codex-tasks/20260410-project-optimization-epic/EPIC.md && test -f .codex-tasks/20260410-project-optimization-epic/SUBTASKS.csv && test -f .codex-tasks/20260410-project-optimization-epic/PROGRESS.md` -> exit 0
- **Files changed**:
  - `.codex-tasks/20260410-project-optimization-epic/EPIC.md` — 定义总目标、约束、风险与完成标准
  - `.codex-tasks/20260410-project-optimization-epic/SUBTASKS.csv` — 定义子任务、依赖、验收与验证命令
  - `.codex-tasks/20260410-project-optimization-epic/PROGRESS.md` — 固化恢复入口与本次规划决策
- **Next step**: Milestone 1 — Freeze baseline and validation matrix

## Milestone 1: Freeze baseline and validation matrix

- **Status**: DONE
- **Started**: 12:29
- **Completed**: 12:34
- **What was done**:
  - 创建了子任务目录 `tasks/20260410-baseline/`，并固化了 `SPEC.md`、`TODO.csv`、`PROGRESS.md`、`BASELINE.md` 与命令摘录。
  - 记录了结构热点、守卫通过项、文件规模守卫失败项以及后续拆分优先级。
  - 将第一个实际改造目标锁定为 `api-config` 配置中心拆分。
- **Key decisions**:
  - Decision: 在真正改代码前，先把失败守卫和结构热点写成显式基线。
  - Reasoning: 后续每个子任务都需要统一的“为什么先拆这里、最少跑哪些验证”的依据。
  - Alternatives considered: 直接开始拆 `api-config`；结论是缺少稳定基线会让后续回归判断变得模糊。
- **Problems encountered**:
  - Problem: `typecheck` 受 `node_modules` 缺失影响，不能作为可信质量基线。
  - Resolution: 将其标记为 blocked，改用守卫命令和结构热点作为第一阶段输入。
  - Retry count: 0
- **Validation**: `npm run check:api-handler && npm run check:test-coverage-guards` -> exit 0
- **Files changed**:
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-baseline/SPEC.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-baseline/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-baseline/PROGRESS.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-baseline/BASELINE.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-baseline/raw/baseline-commands.md`
  - `.codex-tasks/20260410-project-optimization-epic/SUBTASKS.csv`
  - `.codex-tasks/20260410-project-optimization-epic/PROGRESS.md`
- **Next step**: Milestone 2 — Split API config center into route/service/normalizer modules

## Milestone 2: Split API config center into route/service/normalizer modules

- **Status**: DONE
- **Started**: 12:38
- **Completed**: 18:48
- **What was done**:
  - 将 `src/app/api/user/api-config/route.ts` 从近两千行拆成 40 行 HTTP 壳，并把核心流程迁入 `src/lib/user-api/api-config/service.ts`。
  - 按领域拆出 `types`、`pricing-display`、`stored-payload`、`gemini-compatible-presets`、`default-models`、`model-normalization`、`capability-selections`、`openai-compat-models`、`billing-models`、`persistence` 等模块。
  - 最终补齐本地 `.env` 与 MySQL 容器后，重新跑通 `check:model-config-contract` 与 `test:behavior:api`，解除最初的环境阻塞。
- **Key decisions**:
  - Decision: 采用“route -> service -> domain helpers/persistence” 的分层方式，而不是继续在 route 内局部抽函数。
  - Reasoning: 该模块同时承担 HTTP 协议、模型归一化、能力选择、定价校验和持久化映射，只有按职责层拆分才能稳定收口。
  - Alternatives considered: 只做文件裁剪，不抽 persistence；结论是会把数据边界继续留在 service 层里。
- **Problems encountered**:
  - Problem: `check:model-config-contract` 起初因缺少 `.env` 与 `DATABASE_URL` 无法初始化 Prisma。
  - Resolution: 补充本地 `.env`，用 Docker 启动 MySQL，并在相同 shell 中显式加载环境变量后重跑。
  - Retry count: 1
- **Validation**:
  - `npm run check:api-handler` -> exit 0
  - `set -a && source .env && set +a && npm run check:model-config-contract` -> exit 0
  - `set -a && source .env && set +a && npm run test:behavior:api` -> exit 0
- **Files changed**:
  - `src/app/api/user/api-config/route.ts`
  - `src/lib/user-api/api-config/service.ts`
  - `src/lib/user-api/api-config/types.ts`
  - `src/lib/user-api/api-config/pricing-display.ts`
  - `src/lib/user-api/api-config/stored-payload.ts`
  - `src/lib/user-api/api-config/gemini-compatible-presets.ts`
  - `src/lib/user-api/api-config/default-models.ts`
  - `src/lib/user-api/api-config/model-normalization.ts`
  - `src/lib/user-api/api-config/capability-selections.ts`
  - `src/lib/user-api/api-config/openai-compat-models.ts`
  - `src/lib/user-api/api-config/billing-models.ts`
  - `src/lib/user-api/api-config/persistence.ts`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/PROGRESS.md`
- **Next step**: Milestone 3 — Isolate provider and LLM runtime adapters

## Milestone 3: Isolate provider and LLM runtime adapters

- **Status**: DONE
- **Started**: 13:48
- **Completed**: 14:06
- **What was done**:
  - 完成 `chat-stream` 三轮 provider adapter 拆分，新增 `openai-compat`、`official-static`、`google`、`ark`、`generic-ai-sdk`、`openrouter` 相关模块。
  - 将 AI SDK 流处理、诊断日志与 reasoning fallback 收敛到 `generic-ai-sdk-helpers.ts`，避免把复杂度从主入口平移到新热点。
  - 将 `src/lib/llm/chat-stream.ts` 收敛为 214 行的入口编排文件，只保留 provider 路由、日志输入与统一错误归一化。
- **Key decisions**:
  - Decision: 用多轮低风险 adapter 拆分代替一次性重写整个流式运行时。
  - Reasoning: 该链路覆盖 provider 差异、流 chunk 语义、usage 结算和错误归一化，分轮拆更适合持续验证。
  - Alternatives considered: 直接重写成统一策略表；结论是回归面过大。
- **Problems encountered**:
  - Problem: `generic-ai-sdk` 首版拆分把复杂度转移成新的超大文件，并出现 TypeScript 字面量类型问题。
  - Resolution: 继续下钻拆出 `generic-ai-sdk-helpers.ts`，并通过 `typecheck` 修正 Promise 与字面量类型不匹配。
  - Retry count: 0
- **Validation**:
  - `npm run check:no-api-direct-llm-call` -> exit 0
  - `npm run typecheck` -> exit 0
  - `timeout 60s npm run test:integration:provider` -> exit 0
- **Files changed**:
  - `src/lib/llm/chat-stream.ts`
  - `src/lib/llm/chat-stream-shared.ts`
  - `src/lib/llm/stream-providers/openai-compat.ts`
  - `src/lib/llm/stream-providers/official-static.ts`
  - `src/lib/llm/stream-providers/google.ts`
  - `src/lib/llm/stream-providers/ark.ts`
  - `src/lib/llm/stream-providers/generic-ai-sdk.ts`
  - `src/lib/llm/stream-providers/generic-ai-sdk-helpers.ts`
  - `src/lib/llm/stream-providers/openrouter.ts`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-llm-runtime/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-llm-runtime/PROGRESS.md`
  - `.codex-tasks/20260410-project-optimization-epic/SUBTASKS.csv`
  - `.codex-tasks/20260410-project-optimization-epic/PROGRESS.md`
- **Next step**: Milestone 4 — Refactor worker lifecycle router and storyboard pipeline

## Milestone 4: Refactor worker lifecycle router and storyboard pipeline

- **Status**: DONE
- **Started**: 14:06
- **Completed**: 18:48
- **What was done**:
  - 将 `text.worker.ts` 收敛为 22 行 worker 壳，并通过 `text-task-router.ts` 注册表替代长 `switch`。
  - 将 `storyboard-phases.ts`、`shared.ts` 继续按 phase shared、task flow、lifecycle helpers、lifecycle transitions 分层拆开。
  - 在 Docker 可用后，补跑 `test:integration:task`，验证 task 创建去重链路在真实 MySQL/Redis 容器环境下通过。
- **Key decisions**:
  - Decision: 先拆入口和生命周期编排，再做集成验证闭环。
  - Reasoning: worker 改造的真实风险不在编译，而在任务提交、事件流和重试链路能否在实际依赖下继续工作。
  - Alternatives considered: 仅依赖单测关闭子任务；结论是对 BullMQ/Prisma/Redis 组合链路不够。
- **Problems encountered**:
  - Problem: `test:integration:task` 最初被 WSL 中不可用的 `docker` 命令阻塞。
  - Resolution: 在 Windows Docker Desktop 启用 WSL 集成后，直接复用项目内 `docker-compose.test.yml` 完成测试环境拉起与回收。
  - Retry count: 1
- **Validation**:
  - `npm run check:test-tasktype-coverage` -> exit 0
  - `timeout 180s npm run test:integration:task` -> exit 0
- **Files changed**:
  - `src/lib/workers/text.worker.ts`
  - `src/lib/workers/handlers/text-task-router.ts`
  - `src/lib/storyboard-phases.ts`
  - `src/lib/storyboard-phase-shared.ts`
  - `src/lib/workers/shared.ts`
  - `src/lib/workers/task-flow-events.ts`
  - `src/lib/workers/task-lifecycle-helpers.ts`
  - `src/lib/workers/task-lifecycle-transitions.ts`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/PROGRESS.md`
- **Next step**: Milestone 5 — Reduce oversized profile and workspace UI modules

## Milestone 5: Reduce oversized profile and workspace UI modules

- **Status**: DONE
- **Started**: 15:10
- **Completed**: 18:48
- **What was done**:
  - 连续清理 profile/workspace/shared UI/hook/mutation/worker 热点，把 repo 级 `file-line-count` 失败清单彻底清空。
  - 将 `hooks.ts`、`useProviderCardState`、`ScriptViewAssetsPanel`、`ApiConfigTabContainer`、`AssetsStage` 等热点拆回单一职责模块。
  - 在环境打通后补跑 `test:behavior:api`，确认前后端契约类改造没有破坏行为测试。
- **Key decisions**:
  - Decision: 以守卫清单为准逐批清理热点，而不是仅限最初的 profile/workspace 范围。
  - Reasoning: `check:file-line-count` 是 repo 级约束，只有把新暴露的 shared UI、mutation、worker 一并处理掉，守卫才能稳定通过。
  - Alternatives considered: 只做最早锁定的几个页面文件；结论是无法完成最终预算目标。
- **Problems encountered**:
  - Problem: 热点清理过程中不断暴露出 shared UI 与 worker-handler 的新大文件。
  - Resolution: 顺着守卫输出继续拆到 query hooks、mutations 与 storyboard/script worker 主干，最终让 `check:file-line-count` 全绿。
  - Retry count: 1
- **Validation**:
  - `npm run check:file-line-count` -> exit 0
  - `set -a && source .env && set +a && npm run test:behavior:api` -> exit 0
- **Files changed**:
  - `src/app/[locale]/profile/components/api-config/hooks.ts`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewAssetsPanel.tsx`
  - `src/app/[locale]/profile/components/api-config-tab/ApiConfigTabContainer.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/AssetsStage.tsx`
  - `src/components/ui/config-modals/ConfigEditModal.tsx`
  - `src/components/shared/assets/GlobalAssetPicker.tsx`
  - `src/components/ui/icons/custom.tsx`
  - `src/lib/query/hooks/useTaskTargetStateMap.ts`
  - `src/lib/query/hooks/useAssets.ts`
  - `src/lib/query/hooks/run-stream/state-machine.ts`
  - `src/lib/workers/handlers/script-to-storyboard.ts`
  - `src/lib/workers/handlers/story-to-script.ts`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/PROGRESS.md`
- **Next step**: Milestone 6 — Converge config persistence and migration boundaries

## Milestone 6: Converge config persistence and migration boundaries

- **Status**: DONE
- **Started**: 18:02
- **Completed**: 18:17
- **What was done**:
  - 收敛 `UserPreference` 的 shared upsert/readers，把 Prisma 读取压缩到 `src/lib/user-preference/persistence.ts` 单一入口。
  - 让 `api-config`、`config-service`、项目默认值、analysis fallback、billing、voice/lip-sync 等路径都复用共享 persistence reader/upsert。
  - 修正 `no-model-key-downgrade` 与 pricing catalog guard 的真实锚点，确保结构改造后守卫语义仍然匹配现状。
- **Key decisions**:
  - Decision: 不做 schema 迁移，只先收拢运行时 persistence 边界。
  - Reasoning: 当前收益最大的风险点是读写入口分散，不是字段本身立刻拆表。
  - Alternatives considered: 直接启动数据库迁移；结论是回归面过大，不适合作为本轮结构优化的一部分。
- **Problems encountered**:
  - Problem: guard 一度仍锚定旧 route 文件，并把 `containsVideoInput` 误当成用户 capability。
  - Resolution: 把 guard 锚点改到新 service/default-models 责任文件，并改 pricing guard 识别内部 tier 字段。
  - Retry count: 1
- **Validation**:
  - `npm run check:config-center-guards` -> exit 0
  - `npm run typecheck` -> exit 0
- **Files changed**:
  - `src/lib/user-api/api-config/persistence.ts`
  - `src/lib/user-preference/persistence.ts`
  - `src/lib/config-service.ts`
  - `src/app/api/user-preference/route.ts`
  - `scripts/guards/no-model-key-downgrade.mjs`
  - `scripts/check-pricing-catalog.mjs`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/PROGRESS.md`
- **Next step**: Milestone 7 — Run final regression and close epic

## Milestone 7: Run final regression and close epic

- **Status**: DONE
- **Started**: 18:42
- **Completed**: 18:48
- **What was done**:
  - 新建本地 `.env`，使用 Docker 启动开发 MySQL/Redis/MinIO，并确认 Prisma schema 已与本地 MySQL 同步。
  - 跑通此前环境阻塞的 `check:model-config-contract`、`test:behavior:api`、`test:integration:task`。
  - 追加执行 `test:guards` 与 `check:file-line-count`，完成 Epic 最终验收。
- **Key decisions**:
  - Decision: 不再把环境阻塞保留为“已知问题”，而是在当前 WSL 会话里直接把依赖拉齐并做真验证。
  - Reasoning: 这轮收尾的价值不在更多重构，而在把所有待定结果变成明确的 PASS/FAIL。
  - Alternatives considered: 仅更新账本，保留环境阻塞；结论是不符合本次 Epic 的收尾标准。
- **Problems encountered**:
  - Problem: `check:model-config-contract` 初次重跑时即使存在 `.env`，脚本仍没有自动拿到 `DATABASE_URL`。
  - Resolution: 在同一 shell 中通过 `set -a && source .env && set +a` 显式导出环境变量后重跑。
  - Retry count: 1
- **Validation**:
  - `set -a && source .env && set +a && npm run check:model-config-contract` -> exit 0
  - `set -a && source .env && set +a && npm run test:behavior:api` -> exit 0
  - `timeout 180s npm run test:integration:task` -> exit 0
  - `timeout 180s npm run test:guards` -> exit 0
  - `npm run check:file-line-count` -> exit 0
- **Files changed**:
  - `.env`
  - `.codex-tasks/20260410-project-optimization-epic/SUBTASKS.csv`
  - `.codex-tasks/20260410-project-optimization-epic/PROGRESS.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-finalize/SPEC.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-finalize/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-finalize/PROGRESS.md`
- **Next step**: Epic complete
