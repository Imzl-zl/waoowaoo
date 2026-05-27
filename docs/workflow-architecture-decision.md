---
name: 工作流架构决策复核
description: waoowaoo 工作流内核选型复核与当前迁移边界
type: architecture-decision
updated: 2026-05-26
---

# 工作流架构决策复核

## 结论

继续采用 **Temporal 作为 durable workflow kernel，Next.js 作为控制面，Redis Pub/Sub + SSE 作为高频前端事件通道，LangGraph 只作为复杂 Agent Activity 的可选子图**。

这个结论不是“Temporal 对所有项目最优”，而是针对当前项目的约束最稳：

- 小说、剧本、分镜、图片、视频、配音链路都是长任务、多阶段、可失败重试的业务流程。
- 计费 freeze / settle / rollback 必须跟任务生命周期一致，不能依赖散落的 worker 分支。
- 前端需要可查询的 run / step read model，也需要高频 token / progress 实时流。
- 当前代码已经有 Temporal TS SDK、launch bridge、run metadata、lifecycle projection、cancel API、failure projection、run-task wrapper，继续收敛比换平台成本更低。

## 复核过的方案

### 方案 A：继续 BullMQ + 自研 run-runtime

BullMQ 官方定位是 Redis 上的快速队列系统，适合分布式 job execution、priority、delayed job、repeatable job、retry、worker concurrency 和 crash recovery。

它适合保留为过渡期 queue 和简单后台任务，但不适合继续承担全局 workflow kernel：

- workflow history、长期暂停/恢复、跨 step 取消传播、补偿事务、版本化仍要自研；
- 每新增一个 workflow 都会复制 lease、watchdog、reconcile、retry invalidation 和 read-model 修复逻辑；
- 当前项目已经为这些能力积累了 `run-runtime/`、`task/`、`workers/`、watchdog、bull-board 等维护面。

### 方案 B：Temporal kernel + Redis/SSE + 可选 LangGraph

Temporal 官方模型把 Workflow Definition、Workflow Execution、Event History、Activity、Worker、Client 分开。Workflow replay 依赖 Event History 重建状态，外部 API、DB、LLM、文件 I/O 等副作用放到 Activity 中执行。

这正好匹配当前项目要修的结构问题：

- Workflow 只做 deterministic orchestration；
- LLM、provider、billing、media、DB 写入都在 Activity；
- 低频 run / step lifecycle 写 read model 并发布 SSE；
- 高频 token / chunk 继续走 Redis Pub/Sub，不写 Temporal History；
- LangGraph 的 durable execution/checkpointer 适合 Agent 子图、人机 review loop 或多 Agent 推理，但不持有全局任务、计费、媒体编排真相源。

这是当前继续推进的路线。

### 方案 C：Step Functions / Trigger.dev / Inngest / DBOS / Vercel Workflows

这些是合理替代方案，但不适合此刻替换当前路线：

- AWS Step Functions 适合 AWS 原生集成、可视化状态机和托管工作流，但会引入云平台绑定和状态机部署模型。
- Trigger.dev、Inngest、Vercel Workflows 都更偏托管或框架化 durable jobs，能降低平台运维，但会改变当前自托管部署、worker、SSE、Prisma 和 billing 边界。
- DBOS 很适合 Postgres-backed durable execution，但会把 durable runtime 和数据库迁移绑在一起；当前项目仍是 MySQL，贸然引入会放大迁移面。

## 当前执行边界

短期继续做 strangler migration：

1. 先把 Temporal contract/registry 收敛到单一真值，避免每个切流点复制支持任务类型、step descriptor、failure boundary。
2. 保持 `TASK_EXECUTION_RUNTIME` 默认 `bullmq`；只有显式 `temporal_run_task` 才走 Temporal。
3. 继续迁移 run-centric text workflow，再迁移图像/视频/语音等有明确幂等边界的 workflow。
4. 在 billing Saga、artifact idempotency、read model projection、SSE、cancel/retry 全部闭环前，不删除 BullMQ/run-runtime。
5. 暂不执行 MySQL -> PostgreSQL。PG 是长期可选方向，但应在 workflow 切流稳定后作为独立数据迁移项目处理。

## 已用资料

- Temporal Workflow docs: https://docs.temporal.io/workflows
- Temporal TypeScript SDK guide: https://docs.temporal.io/develop/typescript
- BullMQ docs: https://docs.bullmq.io/
- LangGraph durable execution docs: https://docs.langchain.com/oss/javascript/langgraph/durable-execution
- AWS Step Functions docs: https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html
- Inngest function docs: https://www.inngest.com/docs/learn/inngest-functions
- Trigger.dev docs: https://trigger.dev/docs
- DBOS docs: https://docs.dbos.dev/
- Vercel Workflows docs: https://vercel.com/docs/workflows
