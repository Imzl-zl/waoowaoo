# Task Specification

> Scope anchor for the task. Update only when goals or constraints change, and log the reason in PROGRESS.md.

## Task Shape

- **Shape**: `single-full`

## Goals

- 为仓库生成 canonical `AGENTS.md`，并把当前有效的项目级协作规则、仓库结构事实和验证链路归一到同一份规则文件。
- 初始化 `tools.md`、`memory.md` 和 `memory/archive/2026-04.md`，让后续协作有稳定的命令、状态快照和月度归档入口。
- 在不伪造信息的前提下，从 `README.md`、`package.json`、`prisma/`、`standards/`、`scripts/guards/`、`.codex-tasks/` 和最近 git 历史提炼高信号内容。

## Non-Goals

- 不创建新的 `CLAUDE.md`，除非仓库中本来就存在该文件。
- 不发明不存在的 `docs/specs` 文档体系、验证命令或模块边界。
- 不修改产品代码、依赖版本或运行配置。

## Constraints

- 必须遵守 Debug-First，不引入 silent fallback、mock success 或隐式降级规则。
- 只保留一个 substantive 规则文件，最终以 `AGENTS.md` 为唯一 canonical 入口。
- `tools.md` / `memory.md` / `memory/archive/` 只能做协作辅助，不得覆盖代码、配置、catalog 和 contract 真值。

## Environment

- **Project root**: `/home/zl/code/waoowaoo`
- **Language/runtime**: TypeScript / Node.js / Next.js 15 / React 19
- **Package manager**: npm
- **Test framework**: Vitest
- **Build command**: `npm run build`
- **Existing test count**: 仓库内存在大规模 `tests/` 与 `scripts/guards/` 验证矩阵

## Risk Assessment

- [x] External dependencies (APIs, services) — 本次只写协作文件，不依赖外部 API 成功返回。
- [x] Breaking changes to existing code — 不改产品代码，主要风险是规则迁移遗漏。
- [x] Large file generation — 目标文件均为中小型 Markdown。
- [x] Long-running tests — 本次只做文件存在性和内容质量校验。

## Deliverables

- `AGENTS.md`
- `tools.md`
- `memory.md`
- `memory/archive/2026-04.md`
- `.codex-tasks/20260410-init-project/{SPEC.md,TODO.csv,PROGRESS.md}`

## Done-When

- [x] `AGENTS.md` 覆盖实施基线、Source of Truth、项目结构、协作文件规则、验证入口和项目特定约束。
- [x] `tools.md` 至少包含真实命令、关键路径、稳定模式和可复用坑点。
- [x] `memory.md` 基于当前仓库状态与近期活动生成，而不是 commit 标题堆砌。
- [x] `memory/archive/2026-04.md` 已创建并记录本次初始化。

## Final Validation Command

```bash
test -f AGENTS.md && test -f tools.md && test -f memory.md && test -f memory/archive/2026-04.md
```
