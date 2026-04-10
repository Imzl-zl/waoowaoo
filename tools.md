# waoowaoo Tools

## Concepts
- 本文件记录可复用的协作知识，不替代代码、README、catalog、guard 或 contract。
- 真值优先级：`src/` + `prisma/` + `package.json` + `.env.example` / `docker-compose*.yml` -> `README.md` -> `standards/*` + `scripts/guards/*` + `tests/contracts/*` -> `AGENTS.md`。
- 主链路：UI / App Router -> API routes -> `src/lib/**` services / query / run-runtime / workers -> Prisma + MySQL / Redis + BullMQ / MinIO。

## Read First
- `README.md`
- `package.json`
- `prisma/schema.prisma`
- `scripts/guards/api-route-contract-guard.mjs`
- `scripts/guards/file-line-count-guard.mjs`
- `tests/contracts/route-catalog.ts`
- `standards/capabilities/image-video.catalog.json`
- `standards/pricing/image-video.pricing.json`

## Tools
- 环境初始化：`cp .env.example .env`
- 基础设施：`docker compose up mysql redis minio -d`
- 整站容器启动：`docker compose up -d`
- 数据库初始化：`npx prisma db push`
- 本地开发：`npm run dev`
- 生产运行：`npm run start`
- Canonical 验证：`npm run verify:commit`、`npm run verify:push`
- 守卫矩阵：`npm run test:guards`、`npm run check:file-line-count`、`npm run check:model-config-contract`、`npm run check:config-center-guards`、`npm run check:test-coverage-guards`
- 定向验证：`npm run test:behavior:api`、`npm run test:integration:provider`、`npm run test:integration:task`、`npm run test:billing:integration`
- 关键入口路径：`src/lib/storage/init.ts`、`src/lib/workers/index.ts`、`scripts/watchdog.ts`、`scripts/bull-board.ts`、`src/lib/run-runtime/service.ts`、`src/lib/workflow-engine/registry.ts`
- 数据 / 配置 / 约束根目录：`prisma/`、`standards/`、`messages/`、`scripts/guards/`、`tests/contracts/`、`.codex-tasks/`

## Patterns
- API route = `apiHandler` + 鉴权 + 薄协议壳；领域逻辑、归一化和持久化放进 `src/lib/**`。
- 模型配置改动通常需要同时触达 `src/lib/user-api/api-config/*`、`standards/*`、`src/lib/model-config-contract.ts` 与对应 guards / tests，而不是只改其中一处。
- workflow / task 改动通常横跨 `src/lib/task/*`、`src/lib/workers/*`、`src/lib/run-runtime/*`、`src/lib/workflow-engine/*` 与相应测试目录。
- UI 任务状态应经过 query + SSE + target-state map 统一流转，不要用组件局部 polling 或镜像状态兜底。
- 多步骤任务默认在 `.codex-tasks/` 建档；恢复工作时先看 `TODO.csv` / `SUBTASKS.csv` 和 `PROGRESS.md`，不要依赖聊天上下文。

## Pitfalls
- `README.md` 明确要求在 `npm install` 之前先复制并编辑 `.env`；仓库里大量 `tsx --env-file=.env` 脚本假定该文件存在。
- 本地开发使用非标准端口映射，`mysql:13306`、`redis:16379`、`minio:19000` 已由 `.env.example` 和 `docker-compose.yml` 预设。
- 首次本地启动前跳过 `npx prisma db push` 会导致缺表错误，例如 `The table 'tasks' does not exist`。
- 浏览器走纯 HTTP 时可能受并发连接限制导致卡顿；README 给出的 `caddy run --config Caddyfile` 是本地 HTTPS 方案。
- 版本升级时 README 明确要求必要时执行 `docker compose down -v`、重新拉取 compose 文件并清浏览器缓存。
- `.dockerignore` 会排除 `*.md`、`tests`、`docs`、`AGENTS.md` 等内容；容器运行时不能作为协作文档真值来源。
