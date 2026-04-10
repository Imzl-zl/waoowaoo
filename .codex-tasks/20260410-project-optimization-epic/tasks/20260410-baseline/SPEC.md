# Task Specification

## Task Shape

- **Shape**: `single-full`

## Goals

- 固化当前项目优化前的结构基线，包括热点文件、关键守卫状态和第一轮拆分边界。
- 为后续子任务提供统一的验证口径，避免每轮重构临时决定“跑哪些命令”。
- 将“先拆哪里、为什么先拆”明确写成可恢复文档。

## Non-Goals

- 不修改业务行为或运行时逻辑。
- 不在本子任务中直接拆分 `api-config`、`chat-stream` 或 worker 核心文件。
- 不安装依赖或引入新的校验工具。

## Constraints

- 基线必须基于当前工作区真实状态，不美化失败项。
- 失败守卫必须如实记录，不能通过移除守卫或降低门槛来“得到干净基线”。
- 输出必须覆盖结构热点、验证矩阵、首轮拆分边界三个维度。
- 子任务收尾前需要回写父级 `SUBTASKS.csv` 与父级 `PROGRESS.md`。

## Environment

- **Project root**: `/home/zl/code/waoowaoo`
- **Language/runtime**: TypeScript / Node.js / Next.js 15 / React 19
- **Package manager**: npm
- **Test framework**: Vitest
- **Build command**: `npm run build`
- **Existing test count**: `271`

## Risk Assessment

- [x] External dependencies (APIs, services) — 本子任务不依赖外部 API。
- [x] Breaking changes to existing code — 本子任务只落文档和任务状态。
- [x] Large file generation — 仅新增轻量文本文件。
- [x] Long-running tests — 本子任务仅跑守卫命令，无长时间测试。

## Deliverables

- `BASELINE.md`：结构复杂度、验证矩阵、首轮拆分边界。
- `raw/baseline-commands.md`：首轮采集命令与关键输出摘录。
- `TODO.csv` / `PROGRESS.md`：子任务执行记录与恢复入口。

## Done-When

- [ ] 已记录当前结构热点与超预算文件清单。
- [ ] 已记录关键守卫命令的通过/失败状态。
- [ ] 已定义第一轮拆分边界和推荐执行顺序。
- [ ] 父级任务状态已回填。

## Final Validation Command

```bash
test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-baseline/BASELINE.md \
  && test -f .codex-tasks/20260410-project-optimization-epic/tasks/20260410-baseline/raw/baseline-commands.md \
  && npm run check:api-handler \
  && npm run check:test-coverage-guards
```

