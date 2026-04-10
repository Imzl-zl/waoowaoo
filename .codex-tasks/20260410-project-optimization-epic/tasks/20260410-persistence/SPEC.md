# Task Spec

## Goal

收敛 `UserPreference` 相关的配置持久化边界，优先把 `api-config` 路径上的 Prisma 读取/写入、字段映射、加解密与 JSON 存储样板从业务编排层剥离出来，建立清晰的 persistence 入口。

## Scope

- `src/lib/user-api/api-config/service.ts`
- `src/lib/user-api/api-config/*`
- 视情况少量触达 `src/app/api/user-preference/route.ts`、`src/lib/config-service.ts`

## Non-Goals

- 不做数据库 schema 迁移
- 不改外部 API 协议
- 不引入新的 fallback 或兼容分支

## Validation

- `npm run typecheck`
- `npm run check:file-line-count`
- 与本轮改动直接相关的 unit/behavior tests（按实际影响选择）
