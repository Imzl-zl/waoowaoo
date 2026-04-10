# Progress Log

## Session Start

- **Date**: 2026-04-10
- **Task name**: `20260410-persistence`
- **Task dir**: `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/`
- **Spec**: See `SPEC.md`
- **Plan**: See `TODO.csv`
- **Environment**: Prisma / UserPreference / api-config persistence

## Context Recovery Block

- **Current milestone**: #5 — Collapse persistence readers behind a single generic selector
- **Current status**: DONE
- **Last completed**: #5 — Collapse persistence readers behind a single generic selector
- **Current artifact**: `src/lib/user-preference/persistence.ts`
- **Key context**: persistence 子任务已经完成，并继续做了额外收敛：`UserPreference` 的写入口收敛到了 generic helper，读入口也先收敛到 shared readers，再进一步统一成 `readUserPreferenceFields` 泛型 select reader。`api-config/persistence.ts` 已不再直接 `findUnique`，底层 Prisma 读取只剩 `user-preference/persistence.ts` 一个总入口。`check:file-line-count`、`check:api-handler`、`check:config-center-guards` 全部通过。
- **Known issues**: `check:model-config-contract` 仍受 `DATABASE_URL` 缺失阻塞；`test:integration:task` 仍受 `docker` 缺失阻塞。
- **Next action**: 子任务已完成；若继续推进 Epic，切到最终回归收尾，并显式记录 `DATABASE_URL` / `docker` 环境阻塞。

## Milestone 1: Scaffold persistence child task

- **Status**: DONE
- **Started**: 18:02
- **Completed**: 18:02
- **What was done**:
  - 创建 `20260410-persistence` 子任务目录与 `SPEC.md`、`TODO.csv`、`PROGRESS.md`。
  - 将首轮目标锁定为 `api-config` 的 `UserPreference` 读写边界收敛。
- **Key decisions**:
  - Decision: 先从 `api-config/service.ts` 下刀，而不是直接碰 schema/migration。
  - Reasoning: 这是当前最清晰、最低风险、又能实质收敛 persistence 边界的一层。
  - Alternatives considered: 直接对 `UserPreference` 做 schema 拆分；结论是回归面过大，且不符合“避免一次性大迁移”约束。
- **Problems encountered**:
  - Problem: 无。
  - Resolution: 无。
  - Retry count: 0
- **Validation**: `test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/SPEC.md && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/TODO.csv && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/PROGRESS.md` -> exit 0
- **Files changed**:
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/SPEC.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-persistence/PROGRESS.md`
- **Next step**: Milestone 2 — Extract api-config UserPreference persistence helpers

## Milestone 2: Extract api-config UserPreference persistence helpers

- **Status**: DONE
- **Started**: 18:02
- **Completed**: 18:06
- **What was done**:
  - 新增 `src/lib/user-api/api-config/persistence.ts`，收敛 `UserPreference` 的 select/upsert、default-model 字段映射、workflow concurrency 字段映射，以及 provider API Key 加解密与存储序列化。
  - 将 `src/lib/user-api/api-config/service.ts` 从直接操作 Prisma 改为调用 persistence helper，主文件从 `310` 行降到 `215` 行。
  - 让 `src/lib/user-api/model-template/save.ts`、`src/lib/api-config.ts` 和 `src/app/api/user/models/route.ts` 复用共享的 raw preference reader。
- **Key decisions**:
  - Decision: 优先抽 “读/写 + 字段映射 + 加解密” 这一层，而不碰上层 normalization 语义。
  - Reasoning: 这样可以在不改外部协议和校验语义的前提下，把持久化边界真正收拢。
  - Alternatives considered: 直接继续拆 `model-normalization.ts`；结论是那更偏输入归一化，不是 persistence 第一优先级。
- **Problems encountered**:
  - Problem: `model-template/save.ts` 需要保持对 `customProviders` 缺失时的创建语义。
  - Resolution: 通过共享 upsert helper 时，显式保留 “仅在 pref 不存在该字段时补默认空数组” 的逻辑。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npm run check:file-line-count` -> exit 0
- **Files changed**:
  - `src/lib/user-api/api-config/persistence.ts`
  - `src/lib/user-api/api-config/service.ts`
  - `src/lib/user-api/model-template/save.ts`
  - `src/lib/api-config.ts`
  - `src/app/api/user/models/route.ts`
- **Next step**: Milestone 3 — Converge simple userPreference upsert callers and sync validation

## Milestone 3: Converge simple userPreference upsert callers and sync validation

- **Status**: DONE
- **Started**: 18:06
- **Completed**: 18:07
- **What was done**:
  - 新增 `src/lib/user-preference/persistence.ts`，将通用的 `ensureUserPreference` / `upsertUserPreferenceFields` 收敛到 generic helper。
  - 将 `src/app/api/user-preference/route.ts` 改为使用 generic helper，不再直接调用 `prisma.userPreference.upsert`。
  - `src/lib/user-api/api-config/persistence.ts` 也改为复用 generic upsert，剩余 direct `userPreference.upsert` 调用已集中到一个文件。
- **Key decisions**:
  - Decision: 不把 `/api/user-preference` 继续留在 persistence 边界之外。
  - Reasoning: 如果 route 层继续自己写 upsert，持久化边界就仍然是分叉的。
  - Alternatives considered: 只保留 `api-config` 私有 helper；结论是不利于收敛 `UserPreference` 的统一入口。
- **Problems encountered**:
  - Problem: 需要避免把 `GET` 的“确保存在”语义和 `PATCH` 的“带字段更新”语义混在一个 helper 里。
  - Resolution: 拆成 `ensureUserPreference` 与 `upsertUserPreferenceFields` 两个清晰入口。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npm run check:file-line-count` -> exit 0
  - `npm run check:api-handler` -> exit 0
  - `npx vitest run tests/unit/user-api/model-template-save.test.ts` -> exit 0
- **Files changed**:
  - `src/lib/user-preference/persistence.ts`
  - `src/lib/user-api/api-config/persistence.ts`
  - `src/app/api/user-preference/route.ts`
- **Next step**: Decide whether to keep converging `UserPreference` readers in `config-service` / project creation paths

## Milestone 4: Converge remaining UserPreference readers and repair config guard anchors

- **Status**: DONE
- **Started**: 18:08
- **Completed**: 18:15
- **What was done**:
  - 为 `UserPreference` 补齐共享 readers：`analysisModel`、`customModels`、`audioModel`、`lipSyncModel`、`workflowConcurrency`、`modelConfig`、`projectDefaults`。
  - 将 `config-service.ts`、`resolve-analysis-model.ts`、`shot-ai-persist.ts`、`app/api/projects/route.ts`、`billing/service.ts`、`voice-generate/route.ts`、`lip-sync/route.ts` 接入共享 reader，不再各自直接 `findUnique`。
  - 修正 `scripts/guards/no-model-key-downgrade.mjs` 的锚点，使其跟随后端 `api-config` 重构后的真实责任文件。
  - 修正 `scripts/check-pricing-catalog.mjs`，允许 `containsVideoInput` 作为 video pricing tier 的内部派生字段，避免把它误提升为用户可配置 capability。
- **Key decisions**:
  - Decision: 不把 `containsVideoInput` 塞进 capability catalog。
  - Reasoning: 它是运行时派生字段，不是用户可配置项；如果写进 capability catalog，会错误暴露到能力选择层。
  - Alternatives considered: 给 Seedance 2 模型加 `containsVideoInputOptions`；结论是会污染用户侧能力定义。
- **Problems encountered**:
  - Problem: `check:config-center-guards` 先后暴露了两个真实问题：guard 仍锚定旧 route 文件，以及 pricing catalog 校验过度要求 `containsVideoInput` 必须出现在 capability options 中。
  - Resolution: 前者改 guard 目标到 `service.ts + default-models.ts`；后者改 pricing guard 识别 internal tier field，并回退错误的 catalog 改动。
  - Retry count: 1
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npm run check:file-line-count` -> exit 0
  - `npm run check:api-handler` -> exit 0
  - `npm run check:config-center-guards` -> exit 0
  - `npx vitest run tests/unit/user-api/model-template-save.test.ts` -> exit 0
  - `npx vitest run tests/unit/worker/resolve-analysis-model.test.ts tests/integration/api/specific/project-create-default-audio-model.test.ts tests/integration/api/specific/voice-generate-default-audio-model.test.ts` -> exit 0
- **Files changed**:
  - `src/lib/user-preference/persistence.ts`
  - `src/lib/config-service.ts`
  - `src/lib/workers/handlers/resolve-analysis-model.ts`
  - `src/lib/workers/handlers/shot-ai-persist.ts`
  - `src/app/api/projects/route.ts`
  - `src/lib/billing/service.ts`
  - `src/app/api/novel-promotion/[projectId]/voice-generate/route.ts`
  - `src/app/api/novel-promotion/[projectId]/lip-sync/route.ts`
  - `scripts/guards/no-model-key-downgrade.mjs`
  - `scripts/check-pricing-catalog.mjs`
- **Next step**: Child task complete

## Milestone 5: Collapse persistence readers behind a single generic selector

- **Status**: DONE
- **Started**: 18:16
- **Completed**: 18:17
- **What was done**:
  - 在 `src/lib/user-preference/persistence.ts` 新增 `readUserPreferenceFields` 泛型 select reader。
  - 将该文件里已有的 analysis/customModels/audio/lipSync/workflow/modelConfig/projectDefaults reader 统一改为复用泛型 reader。
  - 将 `src/lib/user-api/api-config/persistence.ts` 改为依赖 `readUserPreferenceFields`，不再直接调用 `prisma.userPreference.findUnique`。
- **Key decisions**:
  - Decision: 不继续新增更多专用 reader 再扩散依赖，而是在 persistence 层内部补一个泛型 select 入口。
  - Reasoning: 这样既保留调用方的显式语义函数名，又把 Prisma 读取真正压缩到一个总入口。
  - Alternatives considered: 保持多个专用 reader 直接各自 `findUnique`；结论是不利于继续收敛边界。
- **Problems encountered**:
  - Problem: 无。
  - Resolution: 无。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npm run check:file-line-count` -> exit 0
  - `npm run check:api-handler` -> exit 0
- **Files changed**:
  - `src/lib/user-preference/persistence.ts`
  - `src/lib/user-api/api-config/persistence.ts`
- **Next step**: Child task complete
