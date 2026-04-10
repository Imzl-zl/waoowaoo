# Task Specification

## Task Shape

- **Shape**: `single-full`

## Goals

- 拆分 `src/lib/llm/chat-stream.ts`，降低 provider 分支集中度。
- 第一轮先抽低风险 provider adapter，减少 `chatCompletionStream` 的分支体积。
- 为后续进一步拆 Google / Ark / AI SDK fallback 链路建立稳定模块边界。

## Non-Goals

- 不重写全部 LLM 流式实现。
- 不修改 provider 行为协议或回调契约。
- 不在本轮引入新的模型/provider。

## Constraints

- 先拆 `openai-compat` 与 `bailian/siliconflow` 这类边界清晰的分支。
- 必须保持 `ChatCompletionStreamCallbacks` 行为不变。
- 每轮至少通过 `npm run check:api-handler`、`npm run check:no-api-direct-llm-call`、`npm run typecheck` 中可用者。

## Environment

- **Project root**: `/home/zl/code/waoowaoo`
- **Language/runtime**: TypeScript / Node.js
- **Package manager**: npm
- **Test framework**: Vitest
- **Build command**: `npm run build`
- **Existing test count**: `271`

## Risk Assessment

- provider 分支拆分可能破坏流式 chunk 顺序或 stage 发射顺序。
- `chat-stream.ts` 与 `chat-completion.ts` 之间存在概念重叠，改动时需要避免二次分叉。
- Google / Ark / AI SDK fallback 链路较复杂，第一轮不应一次性全部迁动。

## Deliverables

- `TODO.csv` / `PROGRESS.md`
- 第一轮 provider adapter 拆分代码
- 对应最小验证结果

## Done-When

- [ ] 子任务骨架建立
- [ ] `chat-stream.ts` 第一轮 provider adapter 拆分完成
- [ ] 最小验证通过

## Final Validation Command

```bash
npm run check:no-api-direct-llm-call && npm run typecheck
```

