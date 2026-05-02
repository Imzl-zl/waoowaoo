# waoowaoo AGENTS

## 0. 实施基线
- 环境：本地开发依赖 `.env`、MySQL、Redis、MinIO；仓库同时提供 `docker compose up -d` 的整站启动方式。
- 语言 / 运行时：TypeScript、Node.js `>=18.18.0`、npm `>=9.0.0`、Next.js 15、React 19。
- 主要技术栈：App Router、`next-intl`、Prisma + MySQL、BullMQ + Redis、MinIO / S3 兼容存储、NextAuth、Tailwind CSS v4、Vitest。
- 配置根目录：项目根 `package.json`、`.env.example`、`docker-compose.yml`、`docker-compose.test.yml`、`prisma/`、`standards/`。
- 标准验证命令：`npm run verify:commit`、`npm run verify:push`、`npm run test:guards`、`npm run check:file-line-count`。

## 1. 作用
- 本文件是项目级硬规则，只保留长期稳定的协作、结构、验证和实现约束。
- 详细启动步骤、部署说明、产品功能说明回到 `README.md`、`package.json`、`prisma/`、`standards/` 与可执行 guard / test contract。

## 2. Source of Truth
- 第一优先级：当前代码与运行配置，尤其是 `src/`、`prisma/schema.prisma`、`package.json`、`.env.example`、`docker-compose.yml`、`docker-compose.test.yml`。
- 第二优先级：仓库内显式操作文档 `README.md` 与 `README_en.md`。
- 第三优先级：结构化 contract / catalog / guard，尤其是 `standards/capabilities/*.json`、`standards/pricing/*.json`、`standards/prompt-canary/*.json`、`scripts/guards/*.mjs`、`tests/contracts/*.ts`。
- 第四优先级：本文件中的长期协作和架构规则。
- `tools.md`、`memory.md`、`memory/archive/` 只做协作辅助，不覆盖上述真值源。

## 3. 架构与项目结构
- `src/app` 是 Next.js App Router UI 与 API 入口；`middleware.ts` 负责 locale 路由，显式排除 `api`、`/m`、`_next` 与静态资源。
- `src/app/api/**/route.ts` 是 HTTP 边界层；多数路由应只保留协议编排、鉴权和输入输出封装，业务逻辑下沉到 `src/lib/**`。
- `src/lib/user-api/api-config` 负责用户模型配置、capability selections、定价展示、归一化和持久化。
- `src/lib/llm`、`src/lib/providers`、`src/lib/model-*` 负责 provider adapter、模型能力 / 定价 contract 和流式调用。
- `src/lib/task`、`src/lib/workers`、`src/lib/run-runtime`、`src/lib/workflow-engine` 负责任务入队、worker 执行、graph run 生命周期与 workflow 依赖。
- `src/lib/media`、`src/lib/storage`、`src/lib/assets` 负责媒体归一化、存储签名与资产读写。
- `prisma/` 是 MySQL schema 与 migrations 真值；`standards/` 保存 capability / pricing catalog 与 prompt canary；`tests/` 和 `scripts/guards/` 提供可执行约束。
- 主要依赖方向：UI / hooks -> `src/lib/query/**` -> API routes -> `src/lib/**` services -> Prisma / storage / providers / workers；workflow 定义 -> run-runtime -> workers / handlers。

## 4. Agent 协作文件规则
- 开始任务前，优先读取项目根 `tools.md` 与 `memory.md`。
- 只读取当前项目根的协作文件；`memory/archive/` 只按需读取当月或最近一个归档文件，不批量加载历史。
- `tools.md` 记录稳定可复用的命令、路径、模式、坑点；写入前先读。
- `memory.md` 是当前状态快照 + 最近活跃窗口；完成一个完整功能 / 修复闭环后整体覆盖更新，不做流水追加。
- `memory.md` 只保留当前基线、已完成能力、进行中 / 未完成、关键决策、坑点、最近活跃窗口；移除失效项，目标 `<=120` 行。
- `memory/archive/YYYY-MM.md` 是月度归档；只追加重要根因分析、调试洞察、关键决策和踩坑，写入前先读当月文件，不存在先创建。
- `memory/archive/YYYY-MM.md` 默认格式：`## [日期 | 标题]` + `- **Events**：` / `- **Changes**：` / `- **Insights**：`。
- 多步骤改动默认使用 taskmaster，在 `.codex-tasks/<task-name>/` 维护 `SPEC.md`、`TODO.csv`、`PROGRESS.md`；继续已有任务前先读对应 truth artifact。
- 协作文件不是产品真值，不得覆盖正式代码、配置、catalog 和 contract。

## 5. 验证、入口与关键路径
- 标准验证命令：`npm run verify:commit`、`npm run verify:push`、`npm run test:all`、`npm run build`。
- 结构 / 守卫验证：`npm run test:guards`、`npm run check:file-line-count`、`npm run check:model-config-contract`、`npm run check:config-center-guards`、`npm run check:test-coverage-guards`。
- 定向验证命令：`npm run test:behavior:api`、`npm run test:integration:provider`、`npm run test:integration:task`、`npm run test:billing:integration`。
- 本地开发入口：`cp .env.example .env` -> `docker compose up mysql redis minio -d` -> `npx prisma db push` -> `npm run dev`。
- 关键入口路径：`middleware.ts`、`src/app/api/**/route.ts`、`src/lib/storage/init.ts`、`src/lib/workers/index.ts`、`scripts/watchdog.ts`、`scripts/bull-board.ts`、`src/lib/run-runtime/service.ts`、`src/lib/workflow-engine/registry.ts`、`prisma/schema.prisma`。
- 关键配置 / 生成目录：`standards/`、`messages/`、`prisma/migrations/`、`scripts/guards/`、`tests/contracts/`、`.codex-tasks/`；项目根 `.codex/` 当前为空，不要假设存在项目共享 skills。

## 6. 项目特定规则

### Agent 执行基线
- 用户面默认使用中文；最终答复末尾不追加额外 follow-up 建议。
- Debug-First：不要为了“先跑起来”新增 silent fallback、mock success、隐式降级或额外边界规则；失败应显式暴露。
- 工程质量：遵守 SOLID、DRY、YAGNI、清晰命名、显式边界处理；变更行为时同步清理死代码和过时兼容路径。
- 规模约束：函数目标 `<=50` 行；常规文件目标 `<=200` 行；嵌套目标 `<=3`；位置参数目标 `<=3`；圈复杂度目标 `<=10`；不要保留 magic numbers。
- 依赖与状态：业务逻辑避免直接 `new` 具体实现或修改入参 / 全局状态；优先依赖注入与不可变返回值。
- 安全与验证：不要把 secret 写进源码；数据库访问必须参数化；边界输入要校验；后端 unit 测试手动执行时使用 `timeout 60s`。

### 架构基线
- `src/app/api/**` 默认必须使用 `apiHandler` 包裹，且除 allowlist 外必须显式调用 `requireUserAuth`、`requireProjectAuth` 或 `requireProjectAuthLight`。
- API routes 保持 HTTP shell；provider、model normalization、billing、persistence 等逻辑进入 `src/lib/**` services，而不是留在 route 文件里。
- 模型 capability / pricing 的唯一真值来自 `standards/capabilities/*`、`standards/pricing/*` 与 `src/lib/model-config-contract.ts`；不要在 `src/**` 硬编码 capability 常量替代 catalog。
- 媒体写路径统一经过 `src/lib/media/service.ts` 的 `resolveStorageKeyFromMediaValue`；对外图片归一化统一经过 `src/lib/media/outbound-image.ts`。

### 分层依赖规则
- workflow 依赖定义放在 `src/lib/workflow-engine/*`；run 状态、step / event / checkpoint 持久化放在 `src/lib/run-runtime/*`；worker 入口与 handler 放在 `src/lib/workers/*`。不要把 invalidation 或 runtime 状态机散回 route、component 或临时脚本。
- UI 的任务目标状态应复用 `src/lib/query/hooks/useTaskTargetStateMap.ts`、`useSSE.ts` 和既有 query hooks；不要重新引入 polling、server mirror state 或 novel-promotion / asset-hub / shared-assets 中的局部生成态副本。
- `src/lib/user-api/api-config/*` 是用户模型配置的聚合边界；provider guessing、model key downgrade、多真值和 capability hardcode 都由现有 guard 明确禁止。

### Workflow 特别规则
- 修改 `src/app/api/**` 时，同步更新 `tests/contracts/route-catalog.ts`，并补相应 contract / system / regression 测试。
- 修改 `src/lib/workers/**` 时，同步补 `tests/unit/worker/**`、`tests/system/**` 或 `tests/regression/**` 中的对应覆盖。
- 修改 `src/lib/task/**` 时，同步补 `tests/unit/task/**`、`tests/system/**` 或 `tests/regression/**` 中的对应覆盖。
- `check:file-line-count` 是硬约束：`src/**/components` `<=500` 行，hooks `<=400` 行，`src/lib/workers/handlers/**` `<=300` 行，`src/lib/query/mutations/**` `<=300` 行。

### 禁止事项
- 不要绕过 `no-api-direct-llm-call`、`no-internal-task-sync-fallback`、`no-media-provider-bypass`、`no-provider-guessing`、`no-model-key-downgrade`、`no-multiple-sources-of-truth`、`task-target-states-no-polling` 等现有 guard。
- 不要新增第二份 substantive 规则文件；`AGENTS.md` 是仓库唯一 canonical 规则文件。

## 7. 维护原则
- 本文件保持短、小、硬，只记录长期稳定的协作和结构约束。
- 阶段性状态放 `memory.md`，稳定命令 / 模式 / 坑点放 `tools.md`，重要历史放 `memory/archive/`。
- 如果代码、catalog、guard 或 README 已改变，优先同步本文件中的对应硬规则；解释性长文回到正式文档或 task artifact，不堆进本文件。
