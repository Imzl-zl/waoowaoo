---
name: 工作流编排层长期最优架构方案
description: waoowaoo 二开架构蓝图 — Temporal 可持久工作流内核 + Next.js 控制面 + 可选 LangGraph Agent 子图
type: project
updated: 2026-05-01
---

# waoowaoo 二开最优架构方案

## 核心决策

**全栈 TypeScript，Temporal 做工作流内核，LangGraph 做可选的 Agent 子引擎，PostgreSQL 替换 MySQL，BullMQ 退役。**

---

## 终局架构

```
                      ┌──────────────────────────────┐
                      │       Next.js (控制面)         │
                      │  · App Router (页面/布局)       │
                      │  · NextAuth.js 认证            │
                      │  · Prisma Client (CQRS 读)     │
                      │  · SSE 消费 (Redis pub/sub)    │
                      │  · 薄 API → Temporal Client    │
                      └─────────────┬────────────────┘
                                    │ Temporal Client
                      ┌─────────────▼────────────────┐
                      │      Temporal Server          │
                      │  · Workflow 定义               │
                      │  · Event History (唯一真源)     │
                      │  · 调度 / 重试 / 超时 / 取消     │
                      │  · Signal (人机交互唤醒)         │
                      │  · Saga 补偿事务               │
                      │  · Task Queue (分发 Activity)   │
                      └─────────────┬────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
┌────────▼───────┐  ┌──────────────▼──┐  ┌────────────────────▼──┐
│ LLM Activity   │  │ Image Activity   │  │ Video/Voice Activity  │
│ · LangChain.js │  │ · FAL SDK        │  │ · FAL / Vidu / Ark    │
│ · LangGraph.js │  │ · Ark API        │  │ · 火山引擎 / 百炼      │
│  (可选 Agent)  │  │ · Seedream       │  │ · Lip-sync            │
└────────┬───────┘  └────────┬─────────┘  └───────────┬───────────┘
         │                    │                        │
┌────────▼────────────────────────────────────────────▼───────────┐
│                        Billing Activity                         │
│               freeze → settle / rollback (Saga)                 │
└────────┬───────────────────────────────────────────┬────────────┘
         │                                           │
┌────────▼───────────────────────────────────────────▼────────────┐
│                         Data Layer                              │
│  · PostgreSQL — Temporal 持久化 + 业务数据 + Run Read Model      │
│  · Redis — Pub/Sub 进度推送 + 限流 + 会话缓存                     │
│  · MinIO — 对象存储                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键技术决策

### 1. Temporal 是唯一正确的工作流内核选择

| 能力 | 自研 runtime | BullMQ | LangGraph | Temporal |
|------|:---:|:---:|:---:|:---:|
| 事件溯源持久化 | 手工 | 无 | Checkpoint | Event History |
| 暂停/恢复 (不占资源) | 无 | 无 | interrupt (占线程) | Sleep/Signal |
| Saga 补偿事务 | 手工 | 无 | 手工 | 原生 |
| Activity 幂等守卫 | 无 | 无 | 文档建议 | 原生 |
| 工作流版本化 | 手工 field | 无 | 无 | Versioning API |
| 取消/超时传播 | 手工 | 部分 | 无 | 原生级联 |
| 长时间运行 (小时/天) | 不稳定 | 不支持 | 不推荐 | 原生 |
| 运维可观测性 | 无 | 基础 | LangSmith | Temporal UI |

Temporal 是唯一为"可持久执行"设计的内核。这个项目天然需要它——计费 Saga、长时间生成任务、多步管线恢复、人机审阅等待。BullMQ 是 job queue，LangGraph 是 agent graph，它们都不是 durable workflow engine。

### 2. 为什么全栈 TypeScript

| 因素 | TypeScript (Temporal + Next.js) | Python (FastAPI + LangGraph) |
|------|:---:|:---:|
| Temporal SDK 成熟度 | 官方一等公民 | 官方一等公民 |
| 与 Prisma/Next.js 共享类型 | 直接 import | 手工维护映射 |
| 计费/provider/media 逻辑复用 | 直接 import | 重写或 RPC |
| 部署复杂度 | 同一 Node 运行时 | 两套运行时 |
| 团队心智负担 | 一种语言 | 两种语言 |

当前 Agent 需求不复杂（结构化 JSON 抽取、条件分支），LangGraph.js 完全够用。为"可能的复杂 Agent 需求"提前引入 Python 不值得。

### 3. 为什么 PostgreSQL

- Temporal 的 PG 支持最深、测试最充分
- JSONB 对灵活 Artifact 存储远优于 MySQL JSON
- 更好的全文搜索（剧本内容检索）
- MVCC 并发模型更优
- **不需要两套数据库** — Temporal 持久化和业务数据共用一个 PG 实例

### 4. CQRS：Temporal History ≠ 前端查询状态

```
写路径 (真源):
  用户操作 → Temporal Client → Workflow → Activity → Event History
                                                  ↓
                                          Activity 投影到 PG Read Model

读路径 (查询):
  UI 列表/详情 → Prisma → PG Read Model (Run/Step/Artifact 表)
  UI 实时进度 → Redis Pub/Sub → SSE → 前端
```

- Temporal Event History 是真相源，**不直接给前端查询**
- PG Read Model 是 UI 查询投影，由 Activity 在状态变更时写入
- 高频 token 走 Redis Pub/Sub，不写 Temporal history
- 轮询、reconcile、前端 recovery 逻辑全部删除

### 5. 进度推送分层

| 事件类型 | 频率 | 通道 |
|----------|------|------|
| Run started/completed/failed | 低频 | Temporal History + PG Read Model |
| Step started/completed/failed | 中频 | Temporal History + PG Read Model |
| LLM token streaming | 高频 (10-50/s) | **Redis Pub/Sub → SSE** |
| Step progress 百分比 | 中频 | Redis Pub/Sub → SSE |
| 计费 freeze/settle/rollback | 低频 | Temporal History + PG Ledger |

### 6. LangGraph 的角色：可选的 Agent 子引擎

```
Temporal Workflow
  ├── Activity: analyzeCharacters (直接 LLM 调用)
  ├── Activity: analyzeLocations  (直接 LLM 调用)
  ├── Activity: splitClips        (直接 LLM 调用)
  │
  ├── Activity: reviewLoop  ← 这里用 LangGraph
  │     └── LangGraph (Agent 子图)
  │           ├── planner → reviewer → editor → loop until approved
  │
  └── Activity: persistResults
```

- 简单 LLM 调用 → LangChain.js 或裸调 SDK，不需要 LangGraph
- 复杂 Agent 图（多步推理、人工审阅循环、多 Agent 协作）→ LangGraph 在 Activity 内运行
- LangGraph **不持有**全局工作流状态、不管理计费

---

## 项目结构

```
waoowaoo/
├── src/                          # Next.js 控制面
│   ├── app/                      # App Router
│   │   ├── [locale]/             # 页面路由
│   │   │   └── workspace/        # 工作区
│   │   └── api/                  # API (薄代理 → Temporal Client)
│   │       ├── runs/             # Run CRUD (读 PG Read Model)
│   │       ├── projects/         # 项目 CRUD
│   │       └── ...
│   ├── components/               # UI 组件
│   └── lib/                      # 共享业务逻辑 (Temporal Worker 也引用)
│       ├── billing/              # 计费逻辑
│       ├── media/                # 媒体处理
│       ├── model-config/         # 模型能力/定价
│       ├── temporal/             # Temporal Client 封装
│       └── prisma/               # Prisma Client
│
├── temporal/                     # Temporal Workers (独立进程)
│   ├── workflows/                # Workflow 定义
│   │   ├── story-to-script.workflow.ts
│   │   ├── script-to-storyboard.workflow.ts
│   │   └── generate-asset.workflow.ts
│   ├── activities/               # Activity 实现
│   │   ├── llm/                  # LLM 调用
│   │   ├── image/                # 图片生成
│   │   ├── video/                # 视频生成
│   │   ├── voice/                # 语音生成
│   │   ├── billing/              # 计费 (freeze/settle/rollback)
│   │   └── media/                # MinIO / 合成
│   ├── worker.ts                 # Worker 启动入口
│   └── client.ts                 # Temporal Client (Next.js 也引用)
│
├── prisma/
│   └── schema.prisma             # 业务表 + Run Read Model
├── docs/                         # 设计文档
├── docker/
│   ├── temporal/                 # Temporal Server 配置
│   └── Dockerfile.worker         # Worker 镜像
└── docker-compose.yml
```

**代码共享关键**：`src/lib/` 被 Next.js 和 Temporal Worker 两个进程共同引用，无需 RPC 或重复实现。

---

## Prisma Schema 变更

### 删除
```
GraphRun, GraphStep, GraphEvent, GraphArtifact  → Temporal Event History 替代
Task, TaskEvent                                  → Temporal 替代
```

### 新增 (CQRS Read Model)

```prisma
model Run {
  id            String    @id
  userId        String
  projectId     String
  episodeId      String?
  workflowType   String
  status         String    // QUEUED | RUNNING | COMPLETED | FAILED | CANCELED
  input          Json?
  output         Json?
  errorCode      String?
  errorMessage   String?
  startedAt      DateTime?
  finishedAt     DateTime?
  temporalWorkflowId String?  // 关联 Temporal
  user           User      @relation(fields: [userId])
  project        Project   @relation(fields: [projectId])
  steps          RunStep[]
}

model RunStep {
  id            String    @id
  runId         String
  stepKey       String
  status         String    // PENDING | RUNNING | COMPLETED | FAILED
  attempt        Int       @default(1)
  startedAt      DateTime?
  finishedAt     DateTime?
  errorCode      String?
  errorMessage   String?
  run           Run       @relation(fields: [runId])
}

model RunArtifact {
  id            String  @id
  runId         String
  stepKey       String
  artifactType   String
  data          Json
  createdAt     DateTime @default(now())
  run           Run     @relation(fields: [runId])
}
```

### 保留 (业务数据不变)
User, Account, Session, Project, NovelPromotion*, GlobalCharacter/Location/Voice, UserPreference, UserBalance, UsageCost

---

## 删除代码清单 (~20K 行基础设施退役)

| 模块 | 行数 | 替代 |
|------|------|------|
| `run-runtime/` | 1,987 | Temporal Workflow + Event History |
| `task/` | 3,080 | Temporal Activity + Task Queue |
| `workflow-engine/` | 223 | Temporal Workflow 定义 |
| `workers/` + `handlers/` 中编排逻辑 | ~8,000 | Temporal Workflow/Activity |
| `query/hooks/run-stream/` recovery 逻辑 | ~1,200 | Temporal + Redis 原生保证 |
| `reconcile.ts` / `watchdog.ts` | ~500 | 不再需要 |
| `scripts/watchdog.ts` / `bull-board.ts` | ~200 | 不再需要 |

---

## 部署拓扑

```yaml
# docker-compose.yml
services:
  postgres:              # PostgreSQL (Temporal + 业务数据)
  redis:                 # Pub/Sub + 限流 + 缓存
  minio:                 # 对象存储
  nextjs:                # Next.js 控制面 (可水平扩展)
  temporal-server:       # Temporal Server
  temporal-worker:       # Temporal Worker (可水平扩展)
```

- 开发环境：`docker compose up`，全单实例
- 生产环境：Temporal Server + Worker 独立扩缩，PG 加只读副本

---

## 全方位审查

### 稳定性

**Temporal Server 单点故障**是唯一需要直面的风险。Temporal Server 挂了，所有正在执行的 Workflow 全部暂停。

缓解措施：
- 开发/个人部署：`temporalite`（单二进制，内嵌 SQLite），零运维
- 生产：Temporal Server 多实例高可用（Frontend/History/Matching/Worker 服务分离）+ PG 主备
- Workflow 状态持久化在 PG Event History 中，Temporal 重启后精确恢复，**不会丢状态**
- 对比：当前 BullMQ job 状态在 Redis 中，Redis 宕机会丢队列，依赖 MySQL reconcile 恢复

**结论**：Temporal 单点风险存在但可缓释，数据安全性（Event History 持久化到 PG）显著优于 Redis-based 队列。

### 性能

Temporal 调度延迟是毫秒级，对秒~分钟级的 AI 生成任务**可忽略**。

真正的性能瓶颈与编排层无关：

| 瓶颈 | 位置 | 解决方案 |
|------|------|----------|
| LLM 流式输出 | Provider API | 编排框架无关 |
| 图片/视频生成 | Provider API | 编排框架无关 |
| 大量并发 Workflow | Temporal Matching | Worker 水平扩展 |
| 高频事件推送前端 | Redis Pub/Sub | 不经过 Temporal History |

**关于 Temporal History 膨胀**：LLM token streaming 走 Redis Pub/Sub，不写 Temporal Event History。否则一个 2000 token 的 LLM 调用会产生 2000 个 History Event。分层策略（低频事件走 Temporal，高频 token 走 Redis）已内置。

**长时间等待不占资源**：Temporal Workflow 在 `sleep`、`await signal` 时**不占用 Worker 线程**，这是 BullMQ sandboxed processors 做不到的。

### 数据一致性

CQRS 的双写问题（Activity 同时写 Temporal History 和 PG Read Model）：

```
Activity 写 PG Read Model ───→ Activity 完成 ───→ Temporal History 记录
        │                          │
        │ (可能失败，Temporal 重试)  │
        └──────────────────────────┘
```

**选择方案**：Activity 内双写 + 幂等 upsert（主键 = `runId + stepKey + attempt`）。

- Temporal Activity 是 At-Least-Once 语义 → 可能重复执行
- PG upsert (`INSERT ... ON CONFLICT DO UPDATE`) 保证幂等
- 两者结合 = **最终一致性，无数据丢失窗口**

不推荐的替代方案：
- Outbox 模式：Activity 写 PG outbox → CDC → Temporal。过于复杂。
- 只查 Temporal Visibility Store：无法支持复杂 UI 查询（按项目/用户/时间过滤）。

### 运维复杂度

这是最需要诚实的维度：

| 维度 | BullMQ + 自研 | Temporal 方案 |
|------|:---:|:---:|
| 额外依赖 | 无 (已有 Redis) | Temporal Server + PG (替换 MySQL) |
| 新增容器 | 0 | 1 (temporalite 开发) ~ 2 (生产) |
| 监控 | Redis 自带 | Temporal UI + Prometheus Metrics |
| 学习曲线 | 低 | 中 (确定性 Workflow 约束) |
| 调试 | 查 Redis + MySQL | Temporal UI 可视化解剖 Workflow |

**这是"先付 vs 后付"的区别**：
- BullMQ + 自研 = 起步简单，但每加一个新 Workflow，运维债涨一点（lease、watchdog、reconcile、retry logic）
- Temporal = 前期一次性学习成本，之后所有这类能力都是原生自带

开发环境用 `temporalite` 极其轻量：
```bash
temporalite start --namespace default
# 等价于: Temporal Server 全功能 + 内嵌 SQLite，一个二进制进程
```

### 确定性约束

Temporal 最大的编程模型约束：**Workflow 代码必须是确定性的**。

```typescript
// ❌ 不能在 Workflow 中直接调用 Math.random()
// ❌ 不能在 Workflow 中直接调用 Date.now()——用 Temporal.now()
// ❌ 不能在 Workflow 中直接发起 HTTP 请求——用 Activity
// ✅ 所有副作用必须在 Activity 中执行
```

**这个约束恰好打中当前项目的痛点**。当前 worker handler 可以随意调用 LLM、写 DB、发网络请求——没有任何确定性保证。worker 崩溃重试可能产生重复 LLM 调用和重复扣费。

Temporal 强制分离"编排"和"副作用"，这正好解决了 `workers/handlers/` 中编排逻辑和 LLM 调用混在一起的问题。

### LangGraph.js 能力边界

| 能力 | LangGraph.js | LangGraph Python |
|------|:---:|:---:|
| StateGraph + conditional edges | ✅ | ✅ |
| Checkpoint + persistence | ✅ | ✅ |
| Interrupt (human-in-the-loop) | ✅ | ✅ |
| Subgraphs | ✅ | ✅ |
| Send() API (parallel fan-out) | ✅ | ✅ |
| LangSmith integration | ✅ | ✅ |
| Multi-agent patterns | 部分 | 完整 |
| Tool calling integration | ✅ | ✅ |

当前项目 AI 需求：结构化 JSON 抽取 + 条件分支，**LangGraph.js 完全够用**。未来复杂 multi-agent 场景，可拆出 Python 微服务，LangGraph Activity 调用即可，架构不变。

### 安全性

- Temporal Server mTLS + Namespace 隔离（生产可选，开发不需要）
- NextAuth 认证层不变
- Temporal Client 调用带 userId，Workflow 入口做鉴权
- Activity 写 PG 时 defense-in-depth 再次校验权限

### 可扩展性

| 组件 | 扩展方式 |
|------|----------|
| Temporal Worker | 加实例 = 加并发 |
| Next.js | 无状态，加实例即可 |
| PostgreSQL | 加只读副本 |
| Redis | 小规模单实例足够，大规模切集群 |
| MinIO | 分布式模式内建 |

无架构级扩展瓶颈点。

### 过度设计检验

**一句话检验："如果今天从零开始写 waowaoo，你会选什么？"**

答案是 Temporal + Next.js，不是 BullMQ + 自研 engine。这不是过度设计，是"正确的起点"。当前 20K 行基础设施不是"已经投入的成本"，而是"技术债清单"。Temporal 帮你清掉这张清单。

---

## 方案对比

| 方案 | 工作流耐久 | Agent | 运维 | 长期维护 | 推荐 |
|------|:---:|:---:|:---:|:---:|:---:|
| 继续自研 + BullMQ | 靠补丁 | 无 | 高 | 恶化 | ❌ |
| Next.js + LangGraph/FastAPI | 中 | 强 | 中 (双语言) | 中 | ❌ |
| **Next.js + Temporal + 可选 LangGraph** | **强** | **强** | **中 (自托管)** | **最低** | ✅ |
| Next.js + Temporal Cloud | 强 | 强 | 低 (免运维) | 最低 | 未来可选 |

---

## 参考

- [Temporal](https://docs.temporal.io/temporal)
- [Temporal TypeScript SDK](https://docs.temporal.io/develop/typescript)
- [LangGraph Durable Execution](https://docs.langchain.com/oss/javascript/langgraph/durable-execution)
- [LangGraph Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
