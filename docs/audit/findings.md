# 审计问题台账

> 等级说明：P0 阻断真实使用闭环；P1 影响团队规模化使用或演示可靠性；P2 影响一致性、维护性或体验。

## 当前高优先级问题

### P0：身份可信来源已补，权限闭环仍未完成

**现象**

- REST 和 MCP 写入已经会记录 `audit_logs`，包含 `actor_type`、`actor_id`、`source`、`action`、`entity`、`entity_id`、`payload_hash`、`created_at`。
- 服务端已新增 `team_members` 与 `actor_tokens`，API token 和 agent token 只保存 SHA-256 hash。
- REST 请求可通过 `Authorization: Bearer` 或 `X-Crazor-Token` 派生 `human / api-token` 来源。
- MCP 工具调用可通过 token 派生 `agent / agent-token` 来源。
- 但当前还没有身份管理 UI、登录态、RBAC 权限拦截、token 权限范围和关键操作审批。

**影响**

现在可以回答“这次写入由哪个已登记成员或 agent token 发起”，但还不能回答“这个成员或 agent 是否有权限执行该动作”。多 agent、多成员协作时，仍需要补权限边界，避免任意 token 调用所有写入接口。

**建议**

下一步补权限闭环：身份管理页面、token 创建/撤销入口、角色权限矩阵、接口级 RBAC 中间件、关键写入操作的审计查看页。

### P1：客户 Case 仍缺文档打开编辑与双向关联动作

**现象**

- 客户基础资料、跟进记录、需求文档、成交登记已经可以在客户详情完成最小闭环。
- 客户详情可以列出关联渠道，但还不能直接建立渠道转介绍关系。
- 客户详情可以创建并读回需求文档，但还不能从详情直接打开/编辑该文档。
- 客户与项目机会之间还没有双向关联入口。

**影响**

最小 Case 闭环已可演示，但客户维护的深度操作仍需要跳到其他页面或依赖 Agent/MCP，团队日常使用会有上下文切换成本。

**建议**

下一步补客户文档打开/编辑入口、渠道转介绍创建入口、从客户生成项目机会入口。

### P1：Agent Gateway 解耦仍停留在部分实现

**现象**

已有 `docs/architecture/agent-gateway.md`，服务端也有 `AGENT_*` 配置，但前端和 API 中仍有大量 Hermes Dashboard、Hermes Skills、Hermes Memory、Hermes Channels 的私有概念。

**影响**

后续替换 Dify、自研 Gateway 或其他 Agent Provider 时，业务功能可能被 Hermes 私有接口牵制。

**建议**

按能力拆 Provider：对话、模型、技能、记忆、任务、文件、终端、渠道。前端展示“当前 Provider 支持/不支持”状态，不再默认所有 provider 都有 Hermes Dashboard。

### P1：内容正文与追踪记录的跳转链路需继续核验

**现象**

数据架构要求 `content_pieces.doc_id` 关联知识库正文，但当前审计只确认字段存在和列表可读，还未确认前端详情中是否可直接打开对应知识库文档。

**影响**

内容生产场景可能变成“数据库记录”和“正文文档”两张皮。

**建议**

补一个从内容详情打开 `doc_id` 的入口，并用一个真实内容记录做端到端验证。

### P2：存在旧配置和潜在误导代码

**现象**

- `web/src/api/mock-data.js` 仍存在，但当前未发现业务入口直接导入。
- `web/src/api/browser-utils.js` 仍保留直接拉取 Hermes skills index 的函数，当前市场页面使用服务端代理，但这个函数未来可能绕过轻量化修复。

**影响**

后续开发者容易误判“功能已经配置好了”，但入口实际没有使用。

**建议**

未使用配置要么接入，要么归档；市场索引统一走服务端 `/api/skills/market`。任何演示路径不允许展示 mock 数据。

### P2：中文化仍需收口

**现象**

部分 locale 和 UI 文案仍保留英文表达，例如工作区空态、Provider 说明、若干技术描述。

**影响**

不影响功能，但会影响内部培训和客户演示的一致性。

**建议**

把中文演示路径涉及的页面优先做中文文案审计，不要求代码名和协议名翻译。

## 修复优先级建议

1. 补身份管理 UI、角色权限矩阵、接口级 RBAC 和关键写入审计查看页。
2. 补客户文档打开/编辑、渠道转介绍创建、客户生成项目机会入口。
3. 收敛 Agent Provider 能力抽象，减少 UI 对 Hermes 私有概念的硬依赖。
4. 补内容作品详情到知识库正文 `doc_id` 的打开链路。
5. 梳理旧 mock 模块和直接外部 fetch 工具。

## 已修复问题

| 问题 | 状态 |
|------|------|
| 文档旧路径请求 `knowledge/关于我/...` 返回 404 | 已修复，自动映射数字前缀路径 |
| 文档不存在时页面报错 | 已修复，读取时创建空白文档 |
| `/api/skills/market` 返回约 24MB 导致 502 风险 | 已修复，服务端裁剪为轻量响应 |
| `DataView` 不消费新增/编辑配置 | 已修复，统一弹窗表单接入基础创建与编辑 |
| 客户入口使用只读 `SchemaDataView` | 已修复，改为接入 `contactsConfig` |
| 内容作品缺少新增/编辑表单 | 已修复，补内容作品表单字段与数据归一化 |
| 项目看板无项目时无法创建任务链路 | 已修复，补项目创建入口并联动当前看板 |
| 客户详情不渲染 `detailExtra` 扩展区 | 已修复，`DataView` 已桥接根级 `detailExtra` 到 `DataDetail` |
| 客户文档创建后列表读不回 | 已修复，客户文档列表已合并知识库树与旧目录 |
| 客户 Case 缺少跟进/文档/成交最小入口 | 已修复，客户详情已接入跟进、需求文档和成交登记 |
| REST/MCP 写入缺少最小审计日志 | 已修复，写入会记录到 `audit_logs` 并可通过 `/api/crazor/audit-logs` 查询 |
| REST/MCP 审计 actor 只能信任请求头或 MCP 参数 | 已修复，服务端可从 API token / agent token 派生 actor |

## 本轮验证记录

| 验证项 | 结果 |
|--------|------|
| Docker 服务健康度 | `crazor-web`、`crazor-server`、`hermes` 均 healthy |
| 前端/服务端 Docker 构建 | 通过 |
| 基础业务 API 写入烟测 | 客户、渠道、流水、内容作品、项目、任务均通过创建、更新、删除 |
| 客户 Case API 烟测 | 临时客户、跟进、需求文档、成交流水创建验证后已清理 |
| 页面级轻量核验 | 客户新增、项目新增、内容作品新增、客户详情 Case 操作入口均可见 |
| REST/MCP 审计烟测 | 人类来源和 agent 来源写入均生成审计日志，`payload_hash` 为 64 位 SHA-256 |
| 身份 token 烟测 | API token 创建客户记录 `human / api-token`，agent token 调 MCP 记录 `agent / agent-token`，无效 token 不回落到伪造 header |
