# 产品持续审计入口

> 更新日期：2026-05-29
> 审计范围：Crazor Web、Crazor Server、MCP Server、Docker 交付、Hermes 默认 Provider、业务数据与文档知识库链路。

## 审计目标

持续确认 Crazor 是否具备“团队协作 + Agent 驱动业务管理”的真实闭环能力：

- 功能是否真实存在，不以说明文案或 mock 数据代替可操作功能。
- 页面、API、数据库、文档、MCP Tool、Agent Provider 之间的关系是否闭合。
- Docker 内网交付是否可复现、可验证、可持续维护。
- Hermes 当前作为默认 Provider 是否保持可解耦，不污染 Crazor 业务层。
- 缺失能力是否被明确记录为待办，而不是被 UI 或文档掩盖。

## 文档结构

- [产品功能地图](product-function-map.md)：模块、页面、API、数据层、MCP 能力的对应关系。
- [审计问题台账](findings.md)：当前发现的问题、风险等级、影响范围和建议修复顺序。

## 当前结论

当前代码已经具备 Docker 化交付、统一 Web 入口、业务数据 API、文档知识库、Hermes 对话/技能/记忆/任务管理等基础能力。

本轮已补齐第一层业务写入能力：客户、渠道、流水、内容作品、项目、任务都通过统一入口或统一表单组件进入可创建、可更新、可删除的最小闭环，并通过 API 写入烟测确认。

客户 Case 的最小工作台也已接入并完成深链路验证：客户详情可以新增跟进记录、新建需求文档、打开/编辑客户文档、登记成交、建立渠道转介绍，并从客户生成项目机会。

操作审计的最小底座已接入：REST 和 MCP 写入会记录到 `audit_logs`，包含操作者类型、操作者 ID、来源、动作、实体、实体 ID、payload hash 和创建时间。

可信 actor 来源与最小权限边界已接入：服务端新增团队成员与 actor token 表，REST 请求可以通过 `Authorization: Bearer` 或 `X-Crazor-Token` 派生 `human / api-token` 来源，MCP 工具调用可以派生 `agent / agent-token` 来源；token 已支持 `scopes`，REST/MCP 写入都会校验 scope，越权写入会被拒绝并记录 `deny_*` 审计日志。

协作审计的最小工作台已接入：统一 Web 入口新增“协作审计”页面，可以创建团队成员或 Agent 身份、按权限范围签发/撤销 API token 和 agent token，并查看真实 `audit_logs` 写入记录。

但从“团队内部真实使用”的标准看，产品仍不是完整闭环。核心差距在于：

- 客户 Case 已打通第一层业务深链路，但附件归档、项目任务联动、客户文档搜索跳转仍需继续补齐。
- 后端业务 API 与 MCP Tool 已经比较完整，前端已承接基础写入和客户 Case 深链路，下一步要补更细的协作权限和跨模块上下文。
- 多人协作所需的身份管理、token scope 和审计查看已经有最小 UI 与服务端拦截，但仍缺强制登录边界、角色级 RBAC 矩阵和关键操作审批。
- Agent Gateway 的解耦原则已有文档，但代码和 UI 里仍有较多 Hermes 私有概念。

## 本轮烟测

通过局域网入口 `http://192.168.103.4:5173` 验证：

| 链路 | 结果 |
|------|------|
| Docker 服务状态 | `crazor-server`、`crazor-web`、`hermes` 均 healthy |
| `/api/health` | 200 |
| `/api/status` | 200 |
| `/api/model/info` | 200 |
| `/api/skills` | 200 |
| `/api/skills/market` | 200，约 193KB |
| `/api/crazor/contacts` | 200，当前为空数组 |
| `/api/crazor/content-pieces` | 200，有正式模板/内容记录 |
| `/api/crazor/transactions` | 200，当前为空数组 |
| `/api/crazor/projects` | 200，当前为空数组 |
| `/api/crazor/tasks` | 200，当前为空数组 |
| `/api/crazor/channels` | 200，当前为空数组 |
| `/api/crazor/analytics/overview` | 200 |
| `/api/crazor/docs/knowledge/tree` | 200 |
| `/api/crazor/identity/me` | 200 |
| `/api/crazor/identity/members` | 200 |
| `/api/crazor/identity/tokens` | 200 |
| `POST /mcp` | 200，返回 `Mcp-Session-Id` |
| `/api/workspaces` | 200 |
| `/api/sessions` | 200 |

空数组不视为错误。当前部署默认 `CRAZOR_SEED_DEMO_DATA=false`，符合“不用 mock 数据误导真实链路”的要求。

## 本轮写入烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时数据创建后已全部删除：

| 对象 | 操作 | 结果 |
|------|------|------|
| 客户 | 创建、更新、删除 | 通过 |
| 渠道 | 创建、更新、删除 | 通过 |
| 财务流水 | 创建、更新、删除 | 通过 |
| 内容作品 | 创建、更新、删除 | 通过 |
| 项目 | 创建、更新、删除 | 通过 |
| 任务 | 创建、更新、删除 | 通过 |

## 客户 Case 烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时数据创建后已全部删除：

| 链路 | 结果 |
|------|------|
| 临时客户创建 | 通过 |
| 跟进记录创建并回写客户下一步 | 通过 |
| 需求文档创建并能在客户文档列表读回 | 通过 |
| 需求文档从客户详情打开并编辑保存 | 通过 |
| 成交流水创建并回写客户成交阶段/金额 | 通过 |
| 渠道转介绍创建并能从客户侧读回 | 通过 |
| 从客户生成项目机会并保持 `contact_id` 关联 | 通过 |
| 客户详情页面显示“跟进 / 需求文档 / 文档编辑 / 成交 / 渠道转介绍 / 生成项目”入口 | 通过 |

## 客户 Case 深链路烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时客户、文档、渠道、项目创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `POST /api/crazor/contacts` 自动创建客户知识库目录 | 通过 |
| `POST /api/crazor/contacts/:id/docs` 创建客户需求文档 | 通过 |
| `GET /api/crazor/docs/knowledge/notes-ops` 读取客户文档正文 | 通过 |
| `PATCH /api/crazor/docs/knowledge/notes-ops` 保存客户文档正文 | 通过 |
| `POST /api/crazor/channels/:id/referrals` 建立渠道转介绍 | 通过 |
| `GET /api/crazor/contacts/:id/channels` 从客户侧读回渠道关系 | 通过 |
| `POST /api/crazor/projects` 从客户生成项目机会 | 通过 |
| `GET /api/crazor/projects` 读回项目与客户 `contact_id` 关系 | 通过 |
| `/api/crazor/audit-logs` 记录 `contact_doc`、`doc_note`、`channel_referral`、`project` | 通过 |
| 临时数据清理 | 通过，`cleanup_errors` 为空 |

## 审计日志烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证：

| 链路 | 结果 |
|------|------|
| REST 写入记录 `audit_logs` | 通过，基础 header 场景和 API token 场景均可记录 |
| MCP 工具写入记录 `audit_logs` | 通过，基础 MCP 场景和 agent token 场景均可记录 |
| `payload_hash` | 通过，生成 64 位 SHA-256 |
| `/api/crazor/audit-logs` 查询 | 通过 |

## 身份 Token 烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时成员、token 和客户数据创建后已全部删除：

| 链路 | 结果 |
|------|------|
| 创建团队成员与 API token | 通过 |
| `Authorization: Bearer` 解析 `/api/crazor/identity/me` | 通过，返回 `human` actor |
| 无效 token 防冒名 | 通过，不回落到伪造 actor/source header |
| 使用 API token 创建客户 | 通过，审计记录来源为 `api-token` |
| 创建 agent 成员与 agent token | 通过 |
| 使用 agent token 调用 MCP SSE `create_contact` | 通过，审计记录来源为 `agent-token` |
| 使用 agent token 调用 MCP StreamableHTTP `create_contact` | 通过，统一入口 `POST /mcp` 返回 `Mcp-Session-Id`，审计记录来源为 `agent-token` |
| 临时客户、成员、token 清理 | 通过 |

## Token Scope 权限烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时成员、token、客户目录创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `docker compose up -d --no-deps crazor-server crazor-web` | 通过，server/web 均 healthy |
| 创建 `contact:create` API token | 通过，`/api/crazor/identity/me` 可读回 scopes |
| 使用窄 scope API token 创建客户 | 通过 |
| 使用同一 API token 创建项目 | 被拒绝，返回 403，`required_scope=project:create` |
| 使用无效 token 写客户 | 被拒绝，返回 401 |
| 创建 `contact:create` agent token | 通过 |
| 使用窄 scope agent token 调 MCP `create_contact` | 通过 |
| 使用同一 agent token 调 MCP `create_project` | 被拒绝，返回 MCP `isError=true`，错误包含 `project:create` |
| REST/MCP 允许写入审计 | 通过，记录 `create contact` |
| REST/MCP 越权写入审计 | 通过，记录 `deny_create project` |
| 临时客户、成员、token、客户目录清理 | 通过，`cleanup_errors` 为空 |

## 协作审计页面烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-web` | 通过，生成 `TeamOpsView` 前端 chunk |
| 侧边栏“协作审计”入口 | 已接入 `teamops` 视图 |
| 页面依赖身份 API | 通过，成员创建、按权限范围签发 token、token 列表不返回 `token_hash` |
| 页面依赖审计 API | 通过，可读取 `actor_token` 审计记录 |
| 临时成员和 token 清理 | 通过 |

## 持续审计规则

- 每次新增功能必须更新功能地图或问题台账。
- 每次发现“UI 展示了但链路未打通”的功能，必须进入问题台账。
- 临时验证数据用完即删，不能混入正式运行数据。
- 文档使用中文记录，英文仅保留代码名、协议名、API 名称和必要产品名。
- 审计文档保持小文件拆分，不把所有内容堆进单个巨型文档。
