# Progress Log

## Session Start

- **Date**: 2026-04-10
- **Task name**: `20260410-api-config`
- **Task dir**: `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/`
- **Spec**: See `SPEC.md`
- **Plan**: See `TODO.csv` (3 milestones)
- **Environment**: Next.js Route Handler / Prisma / TypeScript

## Context Recovery Block

- **Current milestone**: #7 — Close child task and sync epic state
- **Current status**: DONE
- **Last completed**: #7 — Close child task and sync epic state
- **Current artifact**: `src/app/api/user/api-config/route.ts`
- **Key context**: `api-config` 已完成 route/service/normalizer/persistence 收敛，`route.ts` 保持 40 行 HTTP 壳；本地 `.env` 与 Docker MySQL 环境已经补齐，`check:api-handler`、`check:model-config-contract`、`test:behavior:api` 全部通过。
- **Known issues**: 无。
- **Next action**: 子任务已关闭。

## Milestone 1: Scaffold api-config child task

- **Status**: DONE
- **Started**: 12:38
- **Completed**: 12:38
- **What was done**:
  - 创建了 `20260410-api-config` 子任务目录与 `SPEC.md`、`TODO.csv`、`PROGRESS.md`。
  - 将父级 `SUBTASKS.csv` 的子任务 #2 切换为 `IN_PROGRESS`。
- **Key decisions**:
  - Decision: 子任务先从低风险纯逻辑切片开始，而不是直接改 GET/PUT handler 主体。
  - Reasoning: 这能在不动行为路径的前提下建立新模块边界。
  - Alternatives considered: 直接提取完整 service；结论是第一刀风险过高。
- **Problems encountered**:
  - Problem: 无
  - Resolution: 无
  - Retry count: 0
- **Validation**: `test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/SPEC.md && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/TODO.csv && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/PROGRESS.md` -> exit 0
- **Files changed**:
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/SPEC.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/PROGRESS.md`
  - `.codex-tasks/20260410-project-optimization-epic/SUBTASKS.csv`
- **Next step**: Milestone 2 — Extract shared types and pricing display logic

## Milestone 2: Extract shared types and pricing display logic

- **Status**: DONE
- **Started**: 12:38
- **Completed**: 12:40
- **What was done**:
  - 新增 `src/lib/user-api/api-config/types.ts`，承接 `route.ts` 的共享类型定义。
  - 新增 `src/lib/user-api/api-config/pricing-display.ts`，承接 pricing display 的纯函数逻辑。
  - 更新 `src/app/api/user/api-config/route.ts`，改为导入共享类型和定价展示模块。
- **Key decisions**:
  - Decision: 第一轮只迁出不依赖 `prisma` / `request` / `response` 的纯逻辑。
  - Reasoning: 可以在最小回归面上验证模块拆分方向是否成立。
  - Alternatives considered: 先提取 `normalize*` 或 `parseStored*`；结论是先从更纯的定价展示逻辑开始更稳妥。
- **Problems encountered**:
  - Problem: 无法用 `typecheck` 做快速兜底。
  - Resolution: 使用 `check:api-handler` 做本轮最小验证，并保留后续更强验证口径。
  - Retry count: 0
- **Validation**: `npm run check:api-handler` -> exit 0
- **Files changed**:
  - `src/lib/user-api/api-config/types.ts`
  - `src/lib/user-api/api-config/pricing-display.ts`
  - `src/app/api/user/api-config/route.ts`
- **Next step**: Milestone 3 — Extract stored payload parsing helpers

## Milestone 3: Extract stored payload parsing helpers

- **Status**: DONE
- **Started**: 12:40
- **Completed**: 12:46
- **What was done**:
  - 新增 `src/lib/user-api/api-config/stored-payload.ts`，统一 `JSON.parse + Array.isArray` 样板。
  - 让 `src/app/api/user/api-config/route.ts`、`src/app/api/user/models/route.ts`、`src/lib/user-api/model-template/save.ts` 复用该 helper。
  - 保持各调用点自身的错误语义和后续归一化逻辑不变。
- **Key decisions**:
  - Decision: 先抽共享“数组解析”能力，而不是立刻统一三套完整的模型/Provider 语义。
  - Reasoning: 三个调用方后续处理强度不同，但最外层 JSON 解析样板完全重复。
  - Alternatives considered: 直接抽统一 `parseStoredModels/Providers`；结论是会过早绑死不同调用方的行为。
- **Problems encountered**:
  - Problem: `model-template/save.ts` 与 route 层错误语义不同。
  - Resolution: 共享 helper 只负责数组解析，把错误实例构造留给调用方。
  - Retry count: 0
- **Validation**: `npm run check:api-handler` -> exit 0
- **Files changed**:
  - `src/lib/user-api/api-config/stored-payload.ts`
  - `src/app/api/user/api-config/route.ts`
  - `src/app/api/user/models/route.ts`
  - `src/lib/user-api/model-template/save.ts`
- **Next step**: Milestone 4 — Extract GET-side gemini preset expansion logic

## Milestone 4: Extract GET-side gemini preset expansion logic

- **Status**: DONE
- **Started**: 12:46
- **Completed**: 12:53
- **What was done**:
  - 新增 `src/lib/user-api/api-config/gemini-compatible-presets.ts`。
  - 将 GET handler 中 `gemini-compatible` disabled preset 的拼装逻辑迁出 `route.ts`。
  - 保留返回结构不变，仍由路由层组合 `pricedModels + disabledPresets`。
- **Key decisions**:
  - Decision: 把这段逻辑归类为“GET 侧展示拼装 helper”，而不是并入 pricing-display。
  - Reasoning: 它依赖 provider 列表、已保存模型集合和 preset 清单，职责比单纯定价展示更高一层。
  - Alternatives considered: 继续留在 GET handler；结论是会让 route.ts 持续承担过多页面展示组装责任。
- **Problems encountered**:
  - Problem: 无
  - Resolution: 无
  - Retry count: 0
- **Validation**: `npm run check:api-handler` -> exit 0
- **Files changed**:
  - `src/lib/user-api/api-config/gemini-compatible-presets.ts`
  - `src/app/api/user/api-config/route.ts`
- **Next step**: Milestone 5 — Extract request normalization and validation chains

## Milestone 5: Extract default model and workflow concurrency helpers

- **Status**: DONE
- **Started**: 12:53
- **Completed**: 12:56
- **What was done**:
  - 新增 `src/lib/user-api/api-config/default-models.ts`。
  - 将默认模型字段常量、workflow concurrency 归一化、默认模型定价校验、按 billing 模式清洗默认模型等逻辑迁出 `route.ts`。
  - 更新 `route.ts` 改为导入这些 helper，并清理多余导入。
- **Key decisions**:
  - Decision: 将默认模型与 workflow concurrency 视为一个独立配置域，一起迁出。
  - Reasoning: 这两块都属于用户配置中心的纯规则层，不需要留在 route handler 中。
  - Alternatives considered: 只抽 `normalizeWorkflowConcurrencyInput`；结论是会把同域规则再次拆散。
- **Problems encountered**:
  - Problem: 需要避免把 route 里其他 pricing 校验逻辑一起拖动，扩大改动面。
  - Resolution: 本轮只迁出默认模型相关常量和 helper，保留 `validateBillableModelPricing` 在路由文件内。
  - Retry count: 0
- **Validation**: `npm run check:api-handler` -> exit 0
- **Files changed**:
  - `src/lib/user-api/api-config/default-models.ts`
  - `src/app/api/user/api-config/route.ts`
- **Next step**: Milestone 6 — Extract remaining request normalization and validation chains

## Milestone 6: Extract remaining request normalization and validation chains

- **Status**: DONE
- **Started**: 12:56
- **Completed**: 13:10
- **What was done**:
  - 新增 `src/lib/user-api/api-config/model-normalization.ts`，迁出 provider/model 的输入归一化、存储解析与 provider 一致性校验。
  - 新增 `src/lib/user-api/api-config/capability-selections.ts`，迁出 capability selection 的解析、清洗与校验链。
  - 新增 `src/lib/user-api/api-config/openai-compat-models.ts`，迁出 OpenAI Compatible 模型协议和媒体模板补全链。
  - 新增 `src/lib/user-api/api-config/billing-models.ts`，迁出 billing 过滤与定价校验链。
  - 清理 `route.ts` 中已被新模块接管的旧 helper，使其体积降至 `339` 行。
- **Key decisions**:
  - Decision: 把 normalize/validate 链按“配置域”而不是按 GET/PUT 分支拆分。
  - Reasoning: 这些逻辑同时被 GET/PUT 与其他用户配置能力共享，按领域模块拆更稳定。
  - Alternatives considered: 继续只拆局部 helper；结论是收益已经低于整链迁移。
- **Problems encountered**:
  - Problem: 拆分过程中一度出现新模块导入先接上、文件未落盘的机械性遗漏。
  - Resolution: 补齐缺失模块并重新跑守卫，确认路由契约未受影响。
  - Retry count: 0
- **Validation**: `npm run check:api-handler` -> exit 0
- **Files changed**:
  - `src/lib/user-api/api-config/model-normalization.ts`
  - `src/lib/user-api/api-config/capability-selections.ts`
  - `src/lib/user-api/api-config/openai-compat-models.ts`
  - `src/lib/user-api/api-config/billing-models.ts`
  - `src/app/api/user/api-config/route.ts`
- **Next step**: Milestone 7 — Close child task and sync epic state

## Milestone 7: Close child task and sync epic state

- **Status**: DONE
- **Started**: 13:10
- **Completed**: 18:48
- **What was done**:
  - 完成 `api-config` 最后收尾，将 `service.ts` 与 `persistence.ts` 作为核心承载层稳定下来。
  - 在仓库根目录补齐 `.env`，启动本地 MySQL 容器，并用 Prisma 验证 schema 已与数据库同步。
  - 重新执行此前受环境阻塞的 `check:model-config-contract` 与 `test:behavior:api`，确认子任务按原验收口径闭合。
- **Key decisions**:
  - Decision: 用真实本地 MySQL 环境补完合同校验，而不是把数据库验证继续留作“已知阻塞”。
  - Reasoning: `api-config` 的最终风险在配置数据形状与行为契约，必须在 Prisma 实例下实测。
  - Alternatives considered: 只保留 `check:api-handler` 与 `typecheck`；结论是信号不够完整。
- **Problems encountered**:
  - Problem: `check:model-config-contract` 初次重跑时未自动读取 `.env`。
  - Resolution: 在同一 shell 中显式 `source .env` 后再执行脚本。
  - Retry count: 1
- **Validation**:
  - `npm run check:api-handler` -> exit 0
  - `set -a && source .env && set +a && npm run check:model-config-contract` -> exit 0
  - `set -a && source .env && set +a && npm run test:behavior:api` -> exit 0
- **Files changed**:
  - `.env`
  - `src/app/api/user/api-config/route.ts`
  - `src/lib/user-api/api-config/service.ts`
  - `src/lib/user-api/api-config/persistence.ts`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-api-config/PROGRESS.md`
- **Next step**: Child task complete
