# Optimization Baseline

## Snapshot

- Captured at: `2026-04-10 12:32 CST`
- Project root: `/home/zl/code/waoowaoo`
- `node_modules`: `missing`
- `src` file count: `924`
- Test file count: `271`
- Baseline policy:
  - 守卫通过项直接作为后续子任务的最小验证集。
  - 守卫失败项保留为优化目标，不通过弱化规则获取“干净基线”。

## Structural Hotspots

### Core runtime hotspots

这些文件虽然未全部被 `check:file-line-count` 覆盖，但已经是当前系统复杂度核心来源，应作为第一轮拆分主目标。

| File | Lines | Current responsibility concentration |
| --- | ---: | --- |
| `src/app/api/user/api-config/route.ts` | 1908 | HTTP 入口、provider/model 归一化、价格映射、能力校验、加密存储 |
| `src/lib/run-runtime/service.ts` | 1199 | run 生命周期、lease、event、checkpoint、artifact、retry |
| `src/lib/billing/service.ts` | 1080 | 报价、冻结、补扣、回滚、task 结算 |
| `src/lib/llm/chat-stream.ts` | 874 | provider 分发、流式输出、reasoning 兼容、usage 记录 |
| `src/lib/workers/shared.ts` | 730 | worker 生命周期、心跳、事件发布、重试、billing 补偿 |
| `src/lib/workers/text.worker.ts` | 714 | task router、本地 handler、故事板局部编排 |
| `src/lib/storyboard-phases.ts` | 704 | phase1/2/2-acting/3 提示词、重试、解析、日志 |

### Guard-confirmed oversized files

`npm run check:file-line-count` 当前失败，明确暴露出以下第一批热点：

- `component`
  - `src/app/[locale]/profile/components/api-config/hooks.ts` `795 > 500`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts` `833 > 500`
  - `src/app/[locale]/profile/components/api-config-tab/ApiConfigTabContainer.tsx` `513 > 500`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/AssetsStage.tsx` `538 > 500`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewAssetsPanel.tsx` `888 > 500`
  - `src/app/[locale]/workspace/asset-hub/components/CharacterCard.tsx` `521 > 500`
  - `src/components/assistant/AssistantChatModal.tsx` `528 > 500`
  - `src/components/llm-console/LLMStageStreamCard.tsx` `512 > 500`
  - `src/components/shared/assets/GlobalAssetPicker.tsx` `559 > 500`
  - `src/components/ui/config-modals/ConfigEditModal.tsx` `514 > 500`
  - `src/components/ui/icons/custom.tsx` `733 > 500`
  - `src/components/ui/model-dropdown-innovative.tsx` `588 > 500`
  - `src/components/ui/model-dropdown-variants.tsx` `543 > 500`
- `hook`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts` `833 > 400`
  - `src/lib/query/hooks/run-stream/state-machine.ts` `587 > 400`
  - `src/lib/query/hooks/useAssets.ts` `496 > 400`
  - `src/lib/query/hooks/useTaskTargetStateMap.ts` `441 > 400`
- `worker-handler`
  - `src/lib/workers/handlers/analyze-novel.ts` `393 > 300`
  - `src/lib/workers/handlers/image-task-handlers-core.ts` `371 > 300`
  - `src/lib/workers/handlers/reference-to-character.ts` `304 > 300`
  - `src/lib/workers/handlers/script-to-storyboard-atomic-retry.ts` `539 > 300`
  - `src/lib/workers/handlers/script-to-storyboard-helpers.ts` `442 > 300`
  - `src/lib/workers/handlers/script-to-storyboard.ts` `565 > 300`
  - `src/lib/workers/handlers/story-to-script.ts` `610 > 300`
  - `src/lib/workers/handlers/voice-analyze.ts` `346 > 300`
- `mutation`
  - `src/lib/query/mutations/asset-hub-character-mutations.ts` `377 > 300`
  - `src/lib/query/mutations/asset-hub-location-mutations.ts` `315 > 300`
  - `src/lib/query/mutations/character-base-mutations.ts` `406 > 300`
  - `src/lib/query/mutations/location-image-mutations.ts` `401 > 300`
  - `src/lib/query/mutations/location-management-mutations.ts` `373 > 300`
  - `src/lib/query/mutations/storyboard-panel-mutations.ts` `327 > 300`

## Validation Matrix

### Passing commands

| Command | Result | Signal |
| --- | --- | --- |
| `npm run check:api-handler` | PASS | 路由契约守卫可用，当前 `routes=141 public=6 apiHandlerExceptions=3` |
| `npm run check:test-coverage-guards` | PASS | 路由/任务类型/行为覆盖矩阵可用，当前 `routes=141 taskTypes=40` |
| `npm run check:no-api-direct-llm-call` | PASS | API 层未直接绕过统一 LLM 调用入口 |

### Failing / blocked commands

| Command | Result | Meaning |
| --- | --- | --- |
| `npm run check:file-line-count` | FAIL | 复杂度预算已被多处突破，是本 Epic 的显式治理目标 |
| `npm run typecheck` | BLOCKED | 当前工作区缺少 `node_modules`，失败来源于依赖缺失，暂不作为代码质量基线 |

## First-Wave Split Boundaries

### Wave 1

- `api-config` 配置中心
  - 目标：把 HTTP 编排、输入归一化、存储解析、价格/能力校验拆开。
  - 子任务：Epic `#2`
  - 预期结果：`route.ts` 只保留请求读取、鉴权、调用 service、返回响应。

- `chat-stream` provider 入口
  - 目标：把 provider-specific 分支下沉到 adapter。
  - 子任务：Epic `#3`
  - 预期结果：入口层只负责模型解析、统一回调和 adapter 调度。

- `workers/shared` 与 `text.worker`
  - 目标：分开生命周期驱动、事件发布、重试策略、billing 补偿、task router。
  - 子任务：Epic `#4`
  - 预期结果：worker 入口通过注册表或职责模块组合，不再靠单文件膨胀。

### Wave 2

- Profile / workspace 前端热点
  - 目标：把表单状态、视图组合、provider-card 状态机与 mutation 调用拆开。
  - 子任务：Epic `#5`

- 配置持久化与迁移边界
  - 目标：收敛 `UserPreference` 的“杂物抽屉”职责，并让迁移脚本按责任分类。
  - 子任务：Epic `#6`

## Recommended Validation by Area

- 每次改 `api-config` 后至少跑：
  - `npm run check:api-handler`
  - `npm run check:model-config-contract`
  - `npm run test:behavior:api`
- 每次改 LLM/provider 入口后至少跑：
  - `npm run check:no-api-direct-llm-call`
  - `npm run test:integration:provider`
- 每次改 worker/runtime 后至少跑：
  - `npm run check:test-tasktype-coverage`
  - `npm run test:integration:task`
- 每次改前端热点后至少跑：
  - `npm run check:file-line-count`
  - 与受影响区域最接近的行为/API 测试

## Notes

- `check:file-line-count` 当前失败不是噪音，而是本 Epic 的核心输入。
- 在依赖未安装前，不以 `typecheck` 成功与否决定拆分顺序。
- 第一个实际改造目标应从 `src/app/api/user/api-config/route.ts` 开始，因为它同时影响前端配置页、模型能力、价格、provider 存储和后续持久化边界。

