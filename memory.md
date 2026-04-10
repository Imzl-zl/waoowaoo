# waoowaoo 项目状态

> 本文件是当前状态快照 + 最近活跃窗口，允许覆盖更新。
> 完整历史归档见 `memory/archive/`，稳定规律见 `tools.md`。

## 当前基线
- 运行栈：Node.js `>=18.18.0` / npm `>=9.0.0` / Next.js 15 / React 19 / Prisma + MySQL / BullMQ + Redis / MinIO / NextAuth / Vitest。
- 常用启动链路：`cp .env.example .env` -> `docker compose up mysql redis minio -d` -> `npx prisma db push` -> `npm run dev`。
- 验证基线：`npm run verify:commit`、`npm run verify:push`、`npm run test:guards`、`npm run check:file-line-count`。
- 最后更新：2026-04-10

## 已完成能力
- 小说 / 剧本 / 分镜 / 配音 / 视频相关工作流已经落地，包含角色、场景、道具分析与多阶段 storyboard 流程。
- 多 provider 模型配置中心已经具备 capability catalog、pricing catalog、capability validation、用户配置持久化和价格展示链路。
- BullMQ image / video / voice / text workers、watchdog、bull-board 与 graph run runtime 已接通，可追踪任务生命周期、step / event / checkpoint 和 retry invalidation。
- 媒体存储链路已统一到 storage key / signed URL 归一化，MinIO / S3 兼容路径与 `/m/*` 媒体路由均有服务端处理入口。
- `next-intl` 中英双语界面、App Router 页面和 API 路由契约已经形成，并配套 guard / test matrix。
- 2026-04-10 的 `20260410-project-optimization-epic` 已完成，`api-config`、LLM / provider adapter、worker runtime、前端热点和 persistence 边界已完成第一轮职责拆分并通过最终验收。

## 进行中 / 未完成
- `README.md` 明确项目仍处测试初期，功能和稳定性持续快速迭代中，版本升级时数据库兼容策略尚未稳定。
- 仓库尚无独立 `docs/specs` 文档体系；当前真值仍集中在代码、README、standards、guards 和 `tests/contracts/`。
- 当前 `.codex-tasks/20260410-project-optimization-epic/` 已收尾，仓库里未发现处于打开状态的已跟踪开发子任务。

## 关键决策（仍有效）
- API 路由默认采用 `apiHandler` + 显式鉴权，保持 HTTP 壳与业务实现分层。
- 模型 capability / pricing 的唯一真值来自 `standards/*` 和 `src/lib/model-config-contract.ts`，禁止在业务代码里硬编码替代。
- 任务目标状态通过 query / SSE / run-runtime 统一管理，不通过 polling 或局部镜像状态兜底。
- 多步骤协作默认记录在 `.codex-tasks/`；`AGENTS.md` 是唯一 canonical 规则文件。

## 仍需注意的坑点
- 首次本地启动前跳过 `npx prisma db push` 会直接触发缺表错误。
- `tsx --env-file=.env` 链路广泛存在；没有 `.env` 或环境变量不全会阻断本地验证。
- 本地基础设施使用非标准端口映射；需要以 `.env.example` / `docker-compose.yml` 为准，不要手工猜端口。
- `.dockerignore` 不会把 Markdown / tests / docs 打进镜像；容器内不应作为协作文档真值来源。

## 最近活跃窗口
- 2026-04-10：完成 `20260410-project-optimization-epic` 收尾，`npm run test:guards` 与 `npm run check:file-line-count` 通过。
- 2026-04-10：`src/app/api/user/api-config/route.ts` 拆成 route / service / domain / persistence 边界，`check:model-config-contract` 与 `test:behavior:api` 通过。
- 2026-04-10：LLM / provider adapter 拆分完成，`chat-stream` 收敛为入口编排，`test:integration:provider` 通过。
- 2026-04-10：worker runtime 和 storyboard pipeline 改为注册表 / 分层结构，`test:integration:task` 通过。
- 2026-04-10：profile / workspace / shared UI 热点与 config persistence 收敛完成，`check:config-center-guards` 与 repo 级 file-line-count 守卫恢复全绿。
