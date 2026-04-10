# Progress Log

## Session Start

- **Date**: 2026-04-10
- **Task name**: `20260410-worker-runtime`
- **Task dir**: `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/`
- **Spec**: See `SPEC.md`
- **Plan**: See `TODO.csv` (4 milestones)
- **Environment**: BullMQ / Prisma / worker runtime / storyboard pipeline

## Context Recovery Block

- **Current milestone**: #4 — Run first-slice worker-runtime validation and sync epic status
- **Current status**: DONE
- **Last completed**: #4 — Run first-slice worker-runtime validation and sync epic status
- **Current artifact**: `src/lib/workers/shared.ts`
- **Key context**: `text.worker.ts` 已从 714 行降到 22 行；`storyboard-phases.ts` 已从 704 行降到 347 行；`shared.ts` 已继续拆出 `task-flow-events.ts`、`task-lifecycle-helpers.ts`、`task-lifecycle-transitions.ts`，主文件从 730 行降到 195 行，`withTaskLifecycle` 现在只保留编排。`test:integration:task` 已在 Docker 测试环境通过。
- **Known issues**: 无。
- **Next action**: 子任务已关闭。

## Milestone 1: Scaffold worker-runtime child task

- **Status**: DONE
- **Started**: 14:06
- **Completed**: 14:06
- **What was done**:
  - 创建 `20260410-worker-runtime` 子任务目录与 `SPEC.md`、`TODO.csv`、`PROGRESS.md`。
  - 将首轮目标锁定为 `text.worker.ts` 入口瘦身，而不是直接重写 `shared.ts` 生命周期主链。
- **Key decisions**:
  - Decision: 先从 `text.worker.ts` 下刀。
  - Reasoning: 这是当前最明显的“入口 + 业务实现 + 本地重复 helper”混合热点，回归面比 `withTaskLifecycle` 更可控。
  - Alternatives considered: 先拆 `shared.ts`；结论是计费/事件/重试耦合更深，首刀风险更高。
- **Problems encountered**:
  - Problem: 无
  - Resolution: 无
  - Retry count: 0
- **Validation**: `test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/SPEC.md && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/TODO.csv && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/PROGRESS.md` -> exit 0
- **Files changed**:
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/SPEC.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/PROGRESS.md`
- **Next step**: Milestone 2 — Extract storyboard text handlers from text.worker

## Milestone 2: Extract storyboard text handlers from text.worker

- **Status**: DONE
- **Started**: 14:06
- **Completed**: 14:37
- **What was done**:
  - 新增 `src/lib/workers/handlers/regenerate-storyboard-text.ts` 与 `src/lib/workers/handlers/insert-panel.ts`，将两个 storyboard 文本 mutation 从 `text.worker.ts` 迁出。
  - 新增 `src/lib/workers/handlers/storyboard-phase-runner.ts` 与 `src/lib/workers/handlers/storyboard-text-utils.ts`，分别承接 phase 汇总与本地 JSON/panel 辅助逻辑。
  - 删除 `text.worker.ts` 内部与 `handlers/llm-stream.ts` 重复的 stream helper，改为统一走共享版。
- **Key decisions**:
  - Decision: 以“专用 handler + 小型 helper”替代继续堆在 worker 入口里。
  - Reasoning: `REGENERATE_STORYBOARD_TEXT` 和 `INSERT_PANEL` 都是完整业务链路，放在入口文件会让后续 router/registry 拆分继续受阻。
  - Alternatives considered: 只抽 `switch`，暂时保留本地 handler；结论是热点仍会留在 `text.worker.ts`。
- **Problems encountered**:
  - Problem: `INSERT_PANEL` 链路同时依赖 prompt 拼装、LLM 流式回调和事务重排，拆分时需要补齐局部 helper。
  - Resolution: 把 panel/prompt/JSON 辅助函数收敛到 `storyboard-text-utils.ts` 和 `insert-panel.ts` 内部 helper，避免再制造新的入口耦合。
  - Retry count: 0
- **Validation**: `npm run typecheck` -> exit 0
- **Files changed**:
  - `src/lib/workers/handlers/regenerate-storyboard-text.ts`
  - `src/lib/workers/handlers/insert-panel.ts`
  - `src/lib/workers/handlers/storyboard-phase-runner.ts`
  - `src/lib/workers/handlers/storyboard-text-utils.ts`
  - `src/lib/workers/text.worker.ts`
- **Next step**: Milestone 3 — Replace processTextTask switch with registry router

## Milestone 3: Replace processTextTask switch with registry router

- **Status**: DONE
- **Started**: 14:06
- **Completed**: 14:37
- **What was done**:
  - 新增 `src/lib/workers/handlers/text-task-router.ts`，把 text worker 的 task-type 到 handler 映射集中成 registry。
  - 将 `src/lib/workers/text.worker.ts` 收敛为 22 行 worker 壳，只保留 `reportTaskProgress`、router 调用和 `withTaskLifecycle` 封装。
  - 新增 `tests/unit/worker/text-task-router.test.ts` 覆盖 grouped task type 与 storyboard mutation 的分发映射。
- **Key decisions**:
  - Decision: 用 registry 替代长 `switch`。
  - Reasoning: 后续继续迁 handler 或引入按类别注册时，registry 更容易局部修改和单独测试。
  - Alternatives considered: 保留 `switch` 仅做换行/分段；结论是结构收益太小。
- **Problems encountered**:
  - Problem: 原有 `task-type-catalog` 对 `REGENERATE_STORYBOARD_TEXT` / `INSERT_PANEL` 的 owner 指向不准确。
  - Resolution: 将 owner 更新到新的 router 单测文件，保证守卫映射与实际职责一致。
  - Retry count: 0
- **Validation**:
  - `npm run check:test-tasktype-coverage` -> exit 0
  - `npx vitest run tests/unit/worker/text-task-router.test.ts` -> exit 0
- **Files changed**:
  - `src/lib/workers/handlers/text-task-router.ts`
  - `src/lib/workers/text.worker.ts`
  - `tests/unit/worker/text-task-router.test.ts`
  - `tests/contracts/task-type-catalog.ts`
- **Next step**: Milestone 4 — Run first-slice worker-runtime validation and sync epic status

## Milestone 4: Run first-slice worker-runtime validation and sync epic status

- **Status**: DONE
- **Started**: 14:37
- **Completed**: 18:48
- **What was done**:
  - 已完成首轮静态验证：`typecheck`、`test-tasktype-coverage`、router 单测均通过。
  - 在环境未就绪时，先通过 `timeout 60s npm run test:integration:task` 明确了阻塞来自 `docker` 缺失而非代码。
  - 继续完成 `storyboard-phases.ts` 共享层拆分，新增 `src/lib/storyboard-phase-shared.ts`，把 clip 资产解析、prompt 片段构建、数组型 phase 的重试执行抽出主文件。
  - `src/lib/storyboard-phases.ts` 已从 704 行降到 347 行，并保持对外导出接口不变。
  - 继续完成 `shared.ts` 的事件/flow 层拆分，新增 `src/lib/workers/task-flow-events.ts` 与 `src/lib/workers/task-lifecycle-helpers.ts`，把 flow 字段解析、run/task 事件镜像、重试决策和项目名注册迁出主文件。
  - 继续完成 `withTaskLifecycle` 主体拆分，新增 `src/lib/workers/task-lifecycle-transitions.ts`，把 processing/completed/retry/failed 分支迁出主文件。
  - `src/lib/workers/shared.ts` 已从 730 行降到 195 行，生命周期主链现在只保留编排。
  - 在 Docker Desktop WSL 集成就绪后，重新执行 `timeout 180s npm run test:integration:task`，由项目自带 `docker-compose.test.yml` 自动拉起 `waoowaoo-test-mysql` 与 `waoowaoo-test-redis`，最终 1 个文件 3 个测试通过。
- **Key decisions**:
  - Decision: 在静态验证之外，额外尝试 task integration。
  - Reasoning: 这轮涉及 worker 分发链路，单靠编译和单测还不够。
  - Alternatives considered: 只跑单测；结论是信号不足。
- **Problems encountered**:
  - Problem: `test:integration:task` 依赖 `docker compose`，早期尝试时当前 WSL 环境没有 `docker` 命令。
  - Resolution: 待 Docker Desktop WSL integration 启用后重跑真实测试，不引入 mock 或 fallback。
  - Retry count: 1
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npm run check:test-tasktype-coverage` -> exit 0
  - `npx vitest run tests/unit/worker/text-task-router.test.ts` -> exit 0
  - `npx vitest run tests/unit/worker/script-to-storyboard-orchestrator.retry.test.ts` -> exit 0
  - `npx vitest run tests/unit/worker/script-to-storyboard-atomic-retry.test.ts` -> exit 0
  - `npx vitest run tests/unit/worker/shared.direct-run-events.test.ts` -> exit 0 (已扩展到 5 个测试，覆盖 retry/failed 分支)
  - `timeout 180s npm run test:integration:task` -> exit 0
- **Files changed**:
  - `src/lib/storyboard-phase-shared.ts`
  - `src/lib/storyboard-phases.ts`
  - `src/lib/workers/task-flow-events.ts`
  - `src/lib/workers/task-lifecycle-helpers.ts`
  - `src/lib/workers/task-lifecycle-transitions.ts`
  - `src/lib/workers/shared.ts`
  - `tests/unit/worker/shared.direct-run-events.test.ts`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-worker-runtime/PROGRESS.md`
- **Next step**: Child task complete
