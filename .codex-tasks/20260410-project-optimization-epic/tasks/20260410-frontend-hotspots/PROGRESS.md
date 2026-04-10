# Progress Log

## Session Start

- **Date**: 2026-04-10
- **Task name**: `20260410-frontend-hotspots`
- **Task dir**: `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/`
- **Spec**: See `SPEC.md`
- **Plan**: See `TODO.csv` (6 milestones)
- **Environment**: React / Next.js profile api-config UI

## Context Recovery Block

- **Current milestone**: #12 — Finish storyboard/script worker hotspot cleanup
- **Current status**: DONE
- **Last completed**: #12 — Finish storyboard/script worker hotspot cleanup
- **Current artifact**: `src/lib/workers/handlers/story-to-script.ts`
- **Key context**: `file-line-count` 已经全绿。这一轮把最后 3 个 storyboard/script 主干文件全部拆回预算内：`script-to-storyboard-atomic-retry.ts` `538->251+273 split`、`script-to-storyboard.ts` `564->230`、`story-to-script.ts` `609->223`，并分别新增 task/pipeline/retry/shared helper。相关 23 个 worker 单测通过。
- **Known issues**: 无。本子任务验收所需的 `test:behavior:api` 已补跑通过。
- **Next action**: 子任务已关闭。

## Milestone 1: Scaffold frontend-hotspots child task

- **Status**: DONE
- **Started**: 15:10
- **Completed**: 15:10
- **What was done**:
  - 创建 `20260410-frontend-hotspots` 子任务目录与 `SPEC.md`、`TODO.csv`、`PROGRESS.md`。
  - 将首轮目标锁定为 `profile/api-config/hooks.ts` 和 `provider-card` / `script-view` 热点。
- **Key decisions**:
  - Decision: 先从 `profile/api-config` 下刀，再补 `script-view` 一刀。
  - Reasoning: 这组文件与前面 `api-config` 后端拆分形成自然闭环，回归验证也更集中。
  - Alternatives considered: 直接从 `ScriptViewAssetsPanel.tsx` 开始；结论是 `hooks.ts` 的低风险收益更大。
- **Problems encountered**:
  - Problem: 无
  - Resolution: 无
  - Retry count: 0
- **Validation**: `test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/SPEC.md && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/TODO.csv && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/PROGRESS.md` -> exit 0
- **Files changed**:
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/SPEC.md`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/PROGRESS.md`
- **Next step**: Milestone 2 — Extract api-config pure helpers and persistence layer

## Milestone 2: Extract api-config pure helpers and persistence layer

- **Status**: DONE
- **Started**: 15:10
- **Completed**: 15:31
- **What was done**:
  - 新增 `config-helpers.ts`、`hook-types.ts`、`useApiConfigPersistence.ts`，把纯 helper 和 fetch/save 持久化层迁出 `hooks.ts`。
  - 保持 `useProviders` 的外部返回结构不变，同时移除 `hooks.ts` 里只写不读的 ref。
- **Key decisions**:
  - Decision: 先把纯逻辑和持久化层迁出，再拆 mutation。
  - Reasoning: 这部分对 UI 协议零影响，最适合先建立组合 hook 边界。
  - Alternatives considered: 直接先拆 mutation；结论是会把 fetch/save/ref 耦合一起拖进下一层。
- **Problems encountered**:
  - Problem: `presetProviders` 需要 memo 化，否则 persistence hook 可能重复触发。
  - Resolution: 在 `hooks.ts` 用 `useMemo` 固化 locale 相关 provider 列表。
  - Retry count: 0
- **Validation**: `npm run typecheck` -> exit 0
- **Files changed**:
  - `src/app/[locale]/profile/components/api-config/config-helpers.ts`
  - `src/app/[locale]/profile/components/api-config/hook-types.ts`
  - `src/app/[locale]/profile/components/api-config/useApiConfigPersistence.ts`
  - `src/app/[locale]/profile/components/api-config/hooks.ts`
- **Next step**: Milestone 3 — Extract provider/model/default-model mutation callbacks

## Milestone 3: Extract provider/model/default-model mutation callbacks

- **Status**: DONE
- **Started**: 15:10
- **Completed**: 15:31
- **What was done**:
  - 新增 `useApiConfigMutations.ts`，把 provider/model/default-model/workflow/capability 回调迁出 `hooks.ts`。
  - 继续拆 `provider-card/hooks/useProviderCardState.ts`，新增 `providerCardStateHelpers.ts`、`useProviderConnectionTest.ts`、`useProviderAssistantState.ts`，主 hook 832 -> 442。
  - 继续拆 `ScriptViewAssetsPanel.tsx`，新增 `ScriptViewAssetViewTabs.tsx` 与 `ScriptViewPropsSection.tsx`，主文件 888 -> 786。
- **Key decisions**:
  - Decision: 在 `profile/api-config` 完成组合 hook 后，顺手处理最相邻的 `provider-card` 和 `script-view` 热点。
  - Reasoning: 这样一轮就能把前端热点从 state、interaction 到展示层都切出边界。
  - Alternatives considered: 只收 `hooks.ts`；结论是热点会立刻迁移到 `useProviderCardState.ts`。
- **Problems encountered**:
  - Problem: `provider-card` 拆分后出现 helper re-export、`optionPricesJson` 校验、`compatMediaTemplate` 类型兼容问题。
  - Resolution: 恢复主文件 helper re-export，补严格的数值校验，并收紧 assistant draft 类型。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/api-config/provider-card-protocol-probe.test.ts tests/unit/api-config/provider-card-pricing-form.test.ts tests/unit/api-config/provider-card-assistant-saved-label.test.ts tests/unit/api-config/provider-card-shell.test.ts tests/unit/api-config/provider-card-tutorial-modal.test.ts tests/unit/api-config/use-providers-order.test.ts tests/unit/api-config/api-config-state-helpers.test.ts` -> exit 0
  - `npx vitest run tests/unit/script-view/script-view-assets-panel.test.ts` -> exit 0
- **Files changed**:
  - `src/app/[locale]/profile/components/api-config/useApiConfigMutations.ts`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/providerCardStateHelpers.ts`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderConnectionTest.ts`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderAssistantState.ts`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewAssetViewTabs.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewPropsSection.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewAssetsPanel.tsx`
  - `tests/unit/api-config/api-config-state-helpers.test.ts`
- **Next step**: Milestone 4 — Run frontend-hotspots first-slice validation and sync epic status

## Milestone 4: Run frontend-hotspots first-slice validation and sync epic status

- **Status**: DONE
- **Started**: 15:31
- **Completed**: 15:32
- **What was done**:
  - 运行 `typecheck` 与 `api-config` 状态辅助相关单测，确认 `profile/api-config` 侧的拆分没有破坏现有协议。
  - 将首轮拆分结果同步回子任务账本，作为第二轮热点拆分的基线。
- **Key decisions**:
  - Decision: 先锁定首轮验证，再继续压 `script-view` / `provider-card`。
  - Reasoning: 先把低风险切分固化，才能准确识别第二轮热点是否只是复杂度转移。
  - Alternatives considered: 不做中间验证直接继续拆；结论是不利于定位回归。
- **Problems encountered**:
  - Problem: 无。
  - Resolution: 无。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/api-config/use-providers-order.test.ts tests/unit/api-config/api-config-state-helpers.test.ts` -> exit 0
- **Files changed**:
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/TODO.csv`
  - `.codex-tasks/20260410-project-optimization-epic/tasks/20260410-frontend-hotspots/PROGRESS.md`
- **Next step**: Milestone 5 — Split ScriptViewAssetsPanel into section/state modules

## Milestone 5: Split ScriptViewAssetsPanel into section/state modules

- **Status**: DONE
- **Started**: 15:32
- **Completed**: 15:40
- **What was done**:
  - 新增 `scriptViewAssetPanelTypes.ts`、`scriptViewAssetPanelUtils.ts`、`ScriptViewCharactersSection.tsx`、`ScriptViewLocationsSection.tsx`、`useScriptViewAssetPanelState.ts`，并继续拆出 `scriptViewAssetPanelDrafts.ts` 与 `scriptViewAssetPanelSelection.ts`。
  - 将 `ScriptViewAssetsPanel.tsx` 从 `888` 行压到 `223` 行，把主文件收敛成工具栏/区块编排与底部生成区。
  - 保持 `ScriptViewPropsSection.tsx` 的外部行为不变，脚本视图单测持续通过。
- **Key decisions**:
  - Decision: 不接受“热点搬家”，继续把 `useScriptViewAssetPanelState.ts` 再拆成草稿层和选择提交层。
  - Reasoning: 如果只把 JSX 迁出，复杂度会从组件平移到 hook，守卫没有实质改善。
  - Alternatives considered: 仅拆角色区和场景区；结论是会留下一个新的 658 行 hook 热点。
- **Problems encountered**:
  - Problem: 第一轮拆分后 `useScriptViewAssetPanelState.ts` 触发 `file-line-count` hook 预算超限。
  - Resolution: 把草稿初始化、编辑器关闭监听、label change 判断和 confirm 提交分拆到两个 support 模块。
  - Retry count: 1
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/script-view/script-view-assets-panel.test.ts` -> exit 0
  - `npx vitest run tests/unit/api-config/provider-card-protocol-probe.test.ts tests/unit/api-config/provider-card-pricing-form.test.ts tests/unit/api-config/provider-card-assistant-saved-label.test.ts tests/unit/api-config/provider-card-shell.test.ts tests/unit/api-config/provider-card-tutorial-modal.test.ts tests/unit/api-config/use-providers-order.test.ts tests/unit/api-config/api-config-state-helpers.test.ts tests/unit/script-view/script-view-assets-panel.test.ts` -> exit 0
  - `npm run check:file-line-count` -> exit 1, 但 `ScriptViewAssetsPanel.tsx` / `useScriptViewAssetPanelState.ts` 已从失败清单中移除
- **Files changed**:
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewAssetsPanel.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewCharactersSection.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewLocationsSection.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/scriptViewAssetPanelTypes.ts`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/scriptViewAssetPanelUtils.ts`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/useScriptViewAssetPanelState.ts`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/scriptViewAssetPanelDrafts.ts`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/scriptViewAssetPanelSelection.ts`
- **Next step**: Milestone 6 — Reduce remaining profile/workspace container hotspots under budget

## Milestone 6: Reduce remaining profile/workspace container hotspots under budget

- **Status**: DONE
- **Started**: 15:40
- **Completed**: 15:46
- **What was done**:
  - 将 `useProviderCardState.ts` 的 provider 元信息、模型分组与默认模型判断、probe 失败文案回迁到 `providerCardStateHelpers.ts`，主 hook 从 `442` 行压到 `397` 行。
  - 新增 `AddCustomProviderModal.tsx`，把 `ApiConfigTabContainer.tsx` 中的自定义 provider 弹窗完整迁出，主文件从 `513` 行压到 `289` 行。
  - 新增 `useAssetsStageFiltering.ts`，把 `AssetsStage.tsx` 中的分集筛选与计数派生逻辑迁出，主文件从 `538` 行压到 `487` 行。
- **Key decisions**:
  - Decision: 优先清理 `file-line-count` 里仍然命中的 profile/workspace 文件，而不是立刻切换到 persistence。
  - Reasoning: 这些文件已经明确被守卫点名，继续收缩能直接证明本子任务的结构收益。
  - Alternatives considered: 跳过 `ApiConfigTabContainer` / `AssetsStage` 直接进入持久化边界；结论是会让前端热点子任务半途而废。
- **Problems encountered**:
  - Problem: repo 级 `file-line-count` 仍然失败，无法作为子任务“全绿”信号。
  - Resolution: 继续以守卫输出是否仍点名当前子任务文件作为判据，确认 `useProviderCardState`、`ApiConfigTabContainer`、`AssetsStage` 已全部从失败清单消失。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/api-config/provider-card-protocol-probe.test.ts tests/unit/api-config/provider-card-pricing-form.test.ts tests/unit/api-config/provider-card-assistant-saved-label.test.ts tests/unit/api-config/provider-card-shell.test.ts tests/unit/api-config/provider-card-tutorial-modal.test.ts tests/unit/api-config/use-providers-order.test.ts tests/unit/api-config/api-config-state-helpers.test.ts tests/unit/script-view/script-view-assets-panel.test.ts` -> exit 0
  - `npm run check:file-line-count` -> exit 1, 但 `useProviderCardState.ts`、`ApiConfigTabContainer.tsx`、`AssetsStage.tsx` 已从失败清单移除
- **Files changed**:
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts`
  - `src/app/[locale]/profile/components/api-config/provider-card/hooks/providerCardStateHelpers.ts`
  - `src/app/[locale]/profile/components/api-config-tab/ApiConfigTabContainer.tsx`
  - `src/app/[locale]/profile/components/api-config-tab/AddCustomProviderModal.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/AssetsStage.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/hooks/useAssetsStageFiltering.ts`
- **Next step**: Sync parent Epic notes and re-evaluate whether to broaden frontend scope or switch to persistence

## Milestone 7: Trim adjacent shared UI hotspots surfaced by file-line-count

- **Status**: DONE
- **Started**: 15:58
- **Completed**: 16:07
- **What was done**:
  - 新增 `ConfigEditModalShell.tsx`，把 [ConfigEditModal.tsx](/home/zl/code/waoowaoo/src/components/ui/config-modals/ConfigEditModal.tsx) 的 overlay/header/save badge 外壳迁出，主文件从 `514` 行压到 `474` 行。
  - 新增 `CharacterCardDeleteControls.tsx`，把 [workspace asset-hub CharacterCard](/home/zl/code/waoowaoo/src/app/[locale]/workspace/asset-hub/components/CharacterCard.tsx) 的删除菜单/确认层迁出，并清理冗余注释，主文件从 `521` 行压到 `491` 行。
  - 新增 `LLMStageStreamCardHeader.tsx`，把 [LLMStageStreamCard.tsx](/home/zl/code/waoowaoo/src/components/llm-console/LLMStageStreamCard.tsx) 的顶部统计/标题/错误块迁出，主文件从 `512` 行压到 `480` 行。
  - 修正 `useAssetsStageFiltering.ts` 的类型边界，确保它消费的是 asset summary 而不是 project 实体，避免这轮 shared UI 优化被旧改动的类型问题掩盖。
- **Key decisions**:
  - Decision: 优先处理超限最小、拆分边界最清晰的 shared UI 组件，而不是立刻跳到更重的 query hooks / worker handlers。
  - Reasoning: 这类组件只差十几二十行，适合低风险推进 `file-line-count` 清单，并验证热点治理正在持续收敛。
  - Alternatives considered: 直接切到 `AssistantChatModal` 或 query hooks；结论是当前文件更容易快速收口并减少清单噪音。
- **Problems encountered**:
  - Problem: `typecheck` 暴露了 `useAssetsStageFiltering.ts` 使用 project 类型而非 asset summary 的旧问题。
  - Resolution: 改为消费 `CharacterAssetSummary` / `LocationAssetSummary` / `PropAssetSummary`，再重跑验证。
  - Retry count: 1
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/components/asset-hub-card-aspect-ratio.test.ts` -> exit 0
  - `npx vitest run tests/unit/components/llm-stage-stream-card-error.test.ts tests/unit/helpers/llm-stage-stream-card-output.test.ts` -> exit 0
  - `npm run check:file-line-count` -> exit 1, 但 `ConfigEditModal.tsx`、`workspace/asset-hub/CharacterCard.tsx`、`LLMStageStreamCard.tsx` 已从失败清单移除
- **Files changed**:
  - `src/components/ui/config-modals/ConfigEditModal.tsx`
  - `src/components/ui/config-modals/ConfigEditModalShell.tsx`
  - `src/app/[locale]/workspace/asset-hub/components/CharacterCard.tsx`
  - `src/app/[locale]/workspace/asset-hub/components/CharacterCardDeleteControls.tsx`
  - `src/components/llm-console/LLMStageStreamCard.tsx`
  - `src/components/llm-console/LLMStageStreamCardHeader.tsx`
  - `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/hooks/useAssetsStageFiltering.ts`
- **Next step**: Continue reducing remaining shared UI hotspots or switch to persistence/query-boundary work

## Milestone 8: Continue shrinking shared UI guard hits around assistant, dropdown, and picker

- **Status**: DONE
- **Started**: 16:07
- **Completed**: 16:22
- **What was done**:
  - 新增 `AssistantChatModalChrome.tsx`，把 [AssistantChatModal.tsx](/home/zl/code/waoowaoo/src/components/assistant/AssistantChatModal.tsx) 的 header/completed/footer chrome 迁出，主文件从 `528` 行压到 `491` 行。
  - 新增 `model-dropdown-shared.ts`，把 [model-dropdown-variants.tsx](/home/zl/code/waoowaoo/src/components/ui/model-dropdown-variants.tsx) 和 [model-dropdown-innovative.tsx](/home/zl/code/waoowaoo/src/components/ui/model-dropdown-innovative.tsx) 共用的 props、定位 hook 和参数摘要逻辑抽成 shared 模块；两个主文件分别收敛到 `466` / `495` 行。
  - 新增 `GlobalAssetPickerChrome.tsx`，把 [GlobalAssetPicker.tsx](/home/zl/code/waoowaoo/src/components/shared/assets/GlobalAssetPicker.tsx) 的 header/search/empty/footer 层迁出，并删除薄封装 icon helper，主文件从 `559` 行压到 `496` 行。
- **Key decisions**:
  - Decision: 先继续消化剩余 shared UI component 清单，而不是立刻转向 query hooks。
  - Reasoning: 这批文件边界清楚、测试面集中，能持续快速减少 `file-line-count` 噪音，并给后续 hook/worker 拆分留出更干净的守卫输出。
  - Alternatives considered: 直接转向 `useAssets.ts` / `state-machine.ts`；结论是 shared UI 的收口成本更低。
- **Problems encountered**:
  - Problem: `GlobalAssetPickerChrome.tsx` 初版把 `copyingState` 写成了 `unknown`，导致 `typecheck` 失败。
  - Resolution: 改为显式的 `TaskPresentationState | null`。
  - Retry count: 1
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/api-config/assistant-chat-modal-content.test.ts tests/unit/components/llm-stage-stream-card-error.test.ts tests/unit/helpers/llm-stage-stream-card-output.test.ts` -> exit 0
  - `npx vitest run tests/unit/components/global-asset-picker-preview.test.ts` -> exit 0
  - `npm run check:file-line-count` -> exit 1, 但 component 清单现在只剩 `src/components/ui/icons/custom.tsx`
- **Files changed**:
  - `src/components/assistant/AssistantChatModal.tsx`
  - `src/components/assistant/AssistantChatModalChrome.tsx`
  - `src/components/ui/model-dropdown-shared.ts`
  - `src/components/ui/model-dropdown-variants.tsx`
  - `src/components/ui/model-dropdown-innovative.tsx`
  - `src/components/shared/assets/GlobalAssetPicker.tsx`
  - `src/components/shared/assets/GlobalAssetPickerChrome.tsx`
- **Next step**: Decide whether to keep shrinking the remaining declarative icon file or switch to query/persistence hotspots

## Milestone 9: Clear remaining component and hook guard hits

- **Status**: DONE
- **Started**: 16:22
- **Completed**: 16:43
- **What was done**:
  - 新增 `custom-shared.tsx` 与 `custom-basic.tsx`，把 [icons/custom.tsx](/home/zl/code/waoowaoo/src/components/ui/icons/custom.tsx) 从单文件 733 行拆成聚合器 + 声明型分片，根文件降到 `438` 行。
  - 新增 `useTaskTargetStateMap.shared.ts`，把 [useTaskTargetStateMap.ts](/home/zl/code/waoowaoo/src/lib/query/hooks/useTaskTargetStateMap.ts) 的 batching/merge/materialize helper 迁出，主 hook 降到 `87` 行。
  - 新增 `useAssets.actions.ts`，把 [useAssets.ts](/home/zl/code/waoowaoo/src/lib/query/hooks/useAssets.ts) 中的 refresh/actions 职责迁出，主文件降到 `170` 行。
  - 新增 `state-machine.shared.ts`，把 [run-stream/state-machine.ts](/home/zl/code/waoowaoo/src/lib/query/hooks/run-stream/state-machine.ts) 的 normalize/sort/finalize helper 迁出，主状态机文件降到 `263` 行。
- **Key decisions**:
  - Decision: 在 shared UI 清空后，不停在“component 层已够好”，继续顺着守卫把 hooks 清单一并收掉。
  - Reasoning: 这样可以把 `file-line-count` 的剩余噪音直接压缩到 worker/mutation，两类问题边界会清楚很多。
  - Alternatives considered: 直接切到 persistence 子任务；结论是当前守卫输出已经明确指向 hook 清单，继续收掉收益更直接。
- **Problems encountered**:
  - Problem: `custom.tsx` 这种声明型 support file 不适合做复杂抽象，只适合按 icon 集拆片。
  - Resolution: 采用“shared factory + basic icon 集 + root aggregator”方案，只改文件边界，不改 registry/index 协议。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/components/global-asset-picker-preview.test.ts` -> exit 0
  - `npx vitest run tests/unit/helpers/run-stream-state-machine.test.ts` -> exit 0
  - `npm run check:file-line-count` -> exit 1, 但 component/hook 清单已全部清空
- **Files changed**:
  - `src/components/ui/icons/custom.tsx`
  - `src/components/ui/icons/custom-basic.tsx`
  - `src/components/ui/icons/custom-shared.tsx`
  - `src/lib/query/hooks/useTaskTargetStateMap.ts`
  - `src/lib/query/hooks/useTaskTargetStateMap.shared.ts`
  - `src/lib/query/hooks/useAssets.ts`
  - `src/lib/query/hooks/useAssets.actions.ts`
  - `src/lib/query/hooks/run-stream/state-machine.ts`
  - `src/lib/query/hooks/run-stream/state-machine.shared.ts`
- **Next step**: Decide whether to keep shrinking worker/mutation guard hits or switch to persistence

## Milestone 10: Start shrinking worker-handler guard hits

- **Status**: DONE
- **Started**: 16:43
- **Completed**: 16:45
- **What was done**:
  - 新增 `reference-to-character-generate.ts`，将 [reference-to-character.ts](/home/zl/code/waoowaoo/src/lib/workers/handlers/reference-to-character.ts) 中的参考图生成、异步轮询、打标与上传 helper 迁出。
  - 主 handler 从 `304` 行降到 `202` 行，文件职责收敛为 payload 解析、模型选择、任务分支和持久化编排。
- **Key decisions**:
  - Decision: 先拿只超线几行的 worker-handler 热点做切口。
  - Reasoning: 这样能快速验证进入 worker 阶段后，守卫仍能稳定一项项收敛，而不用马上进入最重的 storyboard/story-to-script 文件。
  - Alternatives considered: 直接处理 `story-to-script.ts`；结论是回归面太大，不适合作为进入 worker 阶段的第一刀。
- **Problems encountered**:
  - Problem: 无。
  - Resolution: 无。
  - Retry count: 0
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npx vitest run tests/unit/helpers/reference-to-character-helpers.test.ts` -> exit 0
  - `npm run check:file-line-count` -> exit 1, 但 `reference-to-character.ts` 已从 worker-handler 清单移除
- **Files changed**:
  - `src/lib/workers/handlers/reference-to-character.ts`
  - `src/lib/workers/handlers/reference-to-character-generate.ts`
- **Next step**: Continue shrinking the next worker-handler or mutation hotspot

## Milestone 11: Clear mutation guard hits and continue worker-handler reduction

- **Status**: DONE
- **Started**: 16:45
- **Completed**: 17:05
- **What was done**:
  - 把 `asset-hub-character/location`、`location-management`、`location-image`、`character-base`、`storyboard-panel` 等 mutation 热点拆成 `base/shared` 组合结构，`file-line-count` 的 mutation 清单全部清空。
  - 扩展 `voice-analyze-helpers.ts` 并新增 `analyze-novel-helpers.ts`，把 `voice-analyze.ts` 从 `345` 行降到 `274` 行、`analyze-novel.ts` 从 `392` 行降到 `266` 行。
  - 新增 `image-task-handlers-storyboard-modify.ts`，把 `image-task-handlers-core.ts` 的 storyboard 分支独立成单文件，主文件从 `370` 行降到 `283` 行。
  - 新增 `script-to-storyboard-persistence.ts`，把 `script-to-storyboard-helpers.ts` 的 DB 持久化层迁出，原文件从 `441` 行降到 `119` 行，新文件控制在 `287` 行。
- **Key decisions**:
  - Decision: 先把 mutation 清单彻底清零，再集中火力压剩余 worker 主干。
  - Reasoning: 这样守卫输出能明确只剩 storyboard/script 链路，不会把上下文再次打散到多个子域。
  - Alternatives considered: 直接跳到 `story-to-script.ts`；结论是先清空 mutation 和独立 worker 热点收益更高、风险更低。
- **Problems encountered**:
  - Problem: `location-image-mutations.ts` 首次拆分后，主文件仍本地调用 `buildProjectLocationGenerateImageBody`，但只有 re-export 没有本地绑定，导致 `typecheck` 失败。
  - Resolution: 补显式 import 后重跑 `typecheck`，恢复通过。
  - Retry count: 1
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npm run check:file-line-count` -> exit 1, 但失败清单已缩到 `script-to-storyboard-atomic-retry.ts`、`script-to-storyboard.ts`、`story-to-script.ts`
  - `npx vitest run tests/unit/worker/image-task-handlers-core.test.ts` -> exit 0
- **Files changed**:
  - `src/lib/query/mutations/location-management-mutations.ts`
  - `src/lib/query/mutations/location-management-mutations.base.ts`
  - `src/lib/query/mutations/location-management-mutations.shared.ts`
  - `src/lib/query/mutations/location-image-mutations.ts`
  - `src/lib/query/mutations/location-image-mutations.base.ts`
  - `src/lib/query/mutations/location-image-mutations.shared.ts`
  - `src/lib/query/mutations/character-base-mutations.ts`
  - `src/lib/query/mutations/character-base-mutations.base.ts`
  - `src/lib/query/mutations/character-base-mutations.shared.ts`
  - `src/lib/query/mutations/asset-hub-character-mutations.ts`
  - `src/lib/query/mutations/asset-hub-character-mutations.base.ts`
  - `src/lib/query/mutations/asset-hub-character-mutations.shared.ts`
  - `src/lib/query/mutations/asset-hub-location-mutations.ts`
  - `src/lib/query/mutations/asset-hub-location-mutations.shared.ts`
  - `src/lib/query/mutations/storyboard-panel-mutations.ts`
  - `src/lib/workers/handlers/voice-analyze.ts`
  - `src/lib/workers/handlers/voice-analyze-helpers.ts`
  - `src/lib/workers/handlers/analyze-novel.ts`
  - `src/lib/workers/handlers/analyze-novel-helpers.ts`
  - `src/lib/workers/handlers/image-task-handlers-core.ts`
  - `src/lib/workers/handlers/image-task-handlers-storyboard-modify.ts`
  - `src/lib/workers/handlers/script-to-storyboard-helpers.ts`
  - `src/lib/workers/handlers/script-to-storyboard-persistence.ts`
- **Next step**: Continue shrinking the remaining storyboard/script worker-handler hotspots

## Milestone 12: Finish storyboard/script worker hotspot cleanup

- **Status**: DONE
- **Started**: 17:05
- **Completed**: 17:22
- **What was done**:
  - 新增 `script-to-storyboard-atomic-retry.shared.ts`，把 `script-to-storyboard-atomic-retry.ts` 的解析、artifact 读取、退避与 step meta 逻辑迁出，主文件从 `538` 行降到 `251` 行。
  - 新增 `script-to-storyboard-task-helpers.ts` 与 `script-to-storyboard-pipeline.ts`，把 `script-to-storyboard.ts` 收敛为 230 行入口编排文件。
  - 新增 `story-to-script-task-helpers.ts`、`story-to-script-retry.ts`、`story-to-script-pipeline.ts`，把 `story-to-script.ts` 从 `609` 行降到 `223` 行。
  - 结构治理完成后重跑守卫，`npm run check:file-line-count` 首次全绿。
- **Key decisions**:
  - Decision: 对最后 3 个热点统一采用“入口 + task helper + pipeline/retry helper”的模式，而不是继续在单文件里做局部抽 helper。
  - Reasoning: 这三处本质上都是工作流入口文件，最稳定的收敛方式就是把入口、step runner、重试/持久化流程分层。
  - Alternatives considered: 仅在原文件内压缩排版或提取少量纯函数；结论是不足以把 500-600 行级主干稳定降到预算内。
- **Problems encountered**:
  - Problem: `script-to-storyboard` 首轮拆分时，把 orchestrator 并发误写成固定 `1`，以及后续出现 `retryTarget` 类型与 locale 可选值不匹配。
  - Resolution: 立即恢复原有 `workflowConcurrency.analysis`，并补齐 `StoryboardRetryTarget`/locale 的严格类型；`typecheck` 随后恢复通过。
  - Retry count: 1
- **Validation**:
  - `npm run typecheck` -> exit 0
  - `npm run check:file-line-count` -> exit 0
  - `npx vitest run tests/unit/worker/script-to-storyboard-atomic-retry.test.ts tests/unit/worker/script-to-storyboard.test.ts tests/unit/worker/script-to-storyboard-orchestrator.retry.test.ts tests/unit/worker/story-to-script.test.ts tests/unit/worker/story-to-script-orchestrator.retry.test.ts` -> exit 0
- **Files changed**:
  - `src/lib/workers/handlers/script-to-storyboard-atomic-retry.ts`
  - `src/lib/workers/handlers/script-to-storyboard-atomic-retry.shared.ts`
  - `src/lib/workers/handlers/script-to-storyboard.ts`
  - `src/lib/workers/handlers/script-to-storyboard-task-helpers.ts`
  - `src/lib/workers/handlers/script-to-storyboard-pipeline.ts`
  - `src/lib/workers/handlers/story-to-script.ts`
  - `src/lib/workers/handlers/story-to-script-task-helpers.ts`
  - `src/lib/workers/handlers/story-to-script-retry.ts`
  - `src/lib/workers/handlers/story-to-script-pipeline.ts`
- **Next step**: If continuing the Epic, move to persistence boundary cleanup or final regression
