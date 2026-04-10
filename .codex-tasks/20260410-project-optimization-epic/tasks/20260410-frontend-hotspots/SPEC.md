# Task Spec

## Goal

先处理 `profile/api-config` 前端热点，把 `src/app/[locale]/profile/components/api-config/hooks.ts` 拆回组合 hook。

## Scope

- 创建 `frontend-hotspots` 子任务跟踪文件。
- 拆分 `hooks.ts` 中的纯 helper、fetch/save 持久化层、provider/model/default model mutation 回调。
- 保持 `useProviders` 对外返回结构不变。

## Non-Goals

- 本轮不改 `ApiConfigProviderList` / `ProviderCard` 的 UI 结构。
- 本轮不处理 `workspace/script-view/ScriptViewAssetsPanel.tsx`。
- 不改 profile/api-config 的后端协议。

## Validation

- `npm run typecheck`
- `npx vitest run tests/unit/api-config/use-providers-order.test.ts tests/unit/api-config/api-config-state-helpers.test.ts`

## Notes

- 优先抽离纯函数和组合 hook，不做视觉改动。
- 保持 Debug-First，不加 silent fallback。
