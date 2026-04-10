# Task Spec

## Goal

对 `worker-runtime` 做第一轮低风险拆分，优先收敛 `src/lib/workers/text.worker.ts` 的职责，把入口文件压回到“worker 壳 + 分发”。

## Scope

- 创建 `worker-runtime` 子任务跟踪文件。
- 把 `REGENERATE_STORYBOARD_TEXT` / `INSERT_PANEL` 从 `text.worker.ts` 迁到独立 handler。
- 把 `processTextTask` 的大 `switch` 替换为 registry/router。
- 移除 `text.worker.ts` 内与 `handlers/llm-stream.ts` 重复的本地 LLM stream helper。

## Non-Goals

- 本轮不重写 `withTaskLifecycle` 的计费/事件主链。
- 本轮不系统重构 `src/lib/storyboard-phases.ts` 四个 phase 的 prompt/重试模板。
- 本轮不更改 task payload 协议或数据库写入结构。

## Validation

- `npm run typecheck`
- `npm run check:test-tasktype-coverage`
- `vitest run tests/unit/worker/text-task-router.test.ts`

## Notes

- 保持行为等价，优先抽离职责，不引入 silent fallback。
- 如果验证通过，父级 Epic 子任务 #4 维持 `IN_PROGRESS`，下一轮再下钻 `shared.ts` / `storyboard-phases.ts`。
