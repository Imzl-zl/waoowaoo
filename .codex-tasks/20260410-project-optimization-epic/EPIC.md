# Epic Specification

## Goal

- 在不做大爆炸重写的前提下，分阶段降低核心模块耦合度，收敛超大文件，提升可维护性、可测试性和后续迭代速度。
- 优先治理已经成为系统瓶颈的配置中心、LLM/provider 入口、worker 编排层和超大前端 hooks/components。

## Non-Goals

- 不在本 Epic 内引入新的模型供应商或新产品能力。
- 不做一次性数据库大迁移或前后端协议重写。
- 不以“先跑起来”为目标加入新的 silent fallback、mock 路径或兼容黑洞。

## Constraints

- 必须保持现有技术栈与主运行方式不变：Next.js 15、React 19、Prisma、BullMQ、NextAuth。
- 必须遵守 Debug-First，不得用隐藏降级替代根因修复。
- 优先做“搬运和解耦”，避免在同一子任务里叠加行为变更。
- 关键链路改动必须有显式验证命令，至少覆盖 API 契约、任务流、计费或路由守卫中的相关项。
- 除非收益明确，否则不新增外部依赖。

## Risk Assessment

- 配置中心拆分会同时触达路由、表单状态、能力映射、计费约束和持久化格式，回归面大。
- worker / billing / run-runtime 属于关键路径，拆分失误可能造成任务状态错乱、重复扣费或队列卡死。
- provider 路由拆分需要保持各供应商行为一致，尤其是 openai-compatible、google、ark、bailian、siliconflow。
- 前端大 hooks/components 的拆分如果没有先固化数据边界，容易把复杂度从单文件转移到跨文件耦合。

## Child Deliverables

- 基线与验证矩阵固化
- API 配置中心拆分
- LLM 与 provider 运行时解耦
- Worker 生命周期与故事板流水线拆分
- 前端超大 hooks/components 治理
- 配置持久化与迁移边界收敛
- 总体验证与关账

## Dependency Notes

- 先做基线与验证矩阵，再进入核心链路拆分。
- API 配置中心拆分先于前端 profile/api-config 区域治理。
- LLM/provider 运行时解耦先于 text worker 深度治理，避免两边同时改同一供应商路径。
- 最终回归验证依赖全部子任务完成。
- `depends_on` uses `;` as delimiter for multiple IDs.

## Child Task Types

- `single-full`

## Done-When

- [ ] `SUBTASKS.csv` 中所有行均为 `DONE`
- [ ] 配置中心、LLM/provider 入口、worker 编排和前端超大文件完成第一轮责任拆分
- [ ] 核心守卫命令通过，且关键回归测试通过
- [ ] 文件规模预算相对当前基线有可见改善，尤其是当前已超预算热点文件

