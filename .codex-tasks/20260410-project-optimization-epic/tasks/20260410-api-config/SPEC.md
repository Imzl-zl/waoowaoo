# Task Specification

## Task Shape

- **Shape**: `single-full`

## Goals

- 拆分 `src/app/api/user/api-config/route.ts`，把 HTTP handler 与纯领域逻辑边界拉开。
- 优先抽离低风险纯函数块，先减少路由文件的非 IO 负担。
- 为后续继续拆 provider/model 存储、归一化、校验链路创造模块边界。

## Non-Goals

- 不改 GET/PUT 的对外协议。
- 不在本轮重写整个配置中心的数据模型。
- 不顺带处理前端 profile/api-config hooks 的大体积问题。

## Constraints

- 第一轮只做低风险纯函数与类型抽离，避免同时变更业务行为。
- 每次落地后至少运行 `npm run check:api-handler`。
- 在依赖未安装前，不以 `typecheck` 作为收尾标准。
- 保持 Debug-First，不加 silent fallback。

## Environment

- **Project root**: `/home/zl/code/waoowaoo`
- **Language/runtime**: TypeScript / Next.js Route Handler
- **Package manager**: npm
- **Test framework**: Vitest
- **Build command**: `npm run build`
- **Existing test count**: `271`

## Risk Assessment

- [x] Breaking changes to existing code — 先从纯函数抽离开始，降低风险。
- [x] External dependencies — 本轮主要改静态逻辑，不依赖外部 API。
- [x] Large file generation — 仅新增少量 TS 模块与任务文档。
- [x] Long-running tests — 本轮以守卫命令为主。

## Deliverables

- 子任务执行记录：`TODO.csv`、`PROGRESS.md`
- 第一轮拆分代码：至少完成 `route.ts` 的一块低风险纯逻辑抽离
- 原子验证结果：`check:api-handler`

## Done-When

- [ ] 子任务骨架已建立并回填父级状态。
- [ ] `route.ts` 已完成第一轮低风险拆分。
- [ ] 相关守卫命令通过。

## Final Validation Command

```bash
npm run check:api-handler
```

