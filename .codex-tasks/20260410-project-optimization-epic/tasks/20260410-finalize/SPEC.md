# Task Spec

## Goal

完成 Epic 的最终验收与收尾，把此前受环境阻塞的合同/行为/集成验证全部在真实本地依赖环境下跑通，并同步更新父子任务账本。

## Scope

- `.codex-tasks/20260410-project-optimization-epic/*`
- 项目根目录 `.env`
- Docker 本地依赖环境
- 最终验收命令涉及的脚本与测试

## Non-Goals

- 不再新增业务重构范围
- 不引入 mock/fallback 规避真实环境验证
- 不做额外 schema 迁移

## Validation

- `set -a && source .env && set +a && npm run check:model-config-contract`
- `set -a && source .env && set +a && npm run test:behavior:api`
- `timeout 180s npm run test:integration:task`
- `timeout 180s npm run test:guards`
- `npm run check:file-line-count`
