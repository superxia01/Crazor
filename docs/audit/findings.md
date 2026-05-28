# 审计问题台账

> 等级说明：P0 阻断真实使用闭环；P1 影响团队规模化使用或演示可靠性；P2 影响一致性、维护性或体验。

## 当前高优先级问题

### P0：强制写入认证与角色级写入上限已补，完整登录态、只读保护和审批仍未完成

**现象**

- REST 和 MCP 写入已经会记录 `audit_logs`，包含 `actor_type`、`actor_id`、`source`、`action`、`entity`、`entity_id`、`payload_hash`、`created_at`。
- 服务端已新增 `team_members` 与 `actor_tokens`，API token 和 agent token 只保存 SHA-256 hash。
- REST 请求可通过 `Authorization: Bearer` 或 `X-Crazor-Token` 派生 `human / api-token` 来源。
- MCP 工具调用可通过 token 派生 `agent / agent-token` 来源。
- `actor_tokens` 已新增 `scopes`，REST 和 MCP 写入会对 token scope 做服务端校验。
- 越权 REST 写入会返回 403，越权 MCP 工具调用会返回 `isError=true`，两者都会记录 `deny_*` 审计日志。
- 服务端新增 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 强制写入认证边界：开启后无 token 的 REST/MCP 写入会被拒绝，并记录 `missing-token deny_*` 审计。
- 首次部署没有 active token 时，仍允许创建第一个身份和 token，避免初始化锁死。
- 服务端新增角色级写入上限：`admin` 可写全部，`member` 只可写 CRM、文档、项目、内容域，`viewer` 不允许写入。
- token scope 与角色上限同时生效：即使 member 或 viewer token 持有 `*`，也不能突破角色上限。
- agent token 会实时读取成员角色；成员被降级后，已签发 token 的后续写入会立即被拒绝。
- 统一入口已新增“协作审计”页面，可以创建团队成员或 Agent 身份、按权限范围签发/撤销 token、设置当前访问 token、查看审计日志。
- 但当前还没有完整登录态、只读接口保护、关键操作审批，以及可配置到页面策略层的细粒度 RBAC 矩阵。

**影响**

现在可以回答“这次写入是否有可信身份、足够 token scope，并且未突破角色上限”，也能审计无 token 与越权尝试；但页面级登录态、只读接口保护、关键审批和完整权限策略管理尚未形成。

**建议**

下一步补完整登录态、只读接口保护、可配置的接口级 RBAC 策略、关键写入操作审批和高风险操作二次确认。

### P1：客户 Case 已补深链路，附件归档和项目任务联动仍待补

**现象**

- 客户基础资料、跟进记录、需求文档、文档打开编辑、成交登记、渠道转介绍、项目机会已经可以在客户详情完成第一层深链路。
- 客户文档、渠道转介绍、项目机会写入均已通过统一入口 API 验证，并进入 `audit_logs`。
- 当前还没有把客户附件归档、项目任务联动、客户文档搜索跳转全部纳入客户详情。

**影响**

客户维护的核心链路已经可以演示，但客户交付进入项目执行后，附件、任务、文档搜索仍可能产生上下文切换。

**建议**

下一步补客户附件归档入口、从客户项目直接拆任务、客户文档搜索结果跳转，并继续验证这些动作的审计记录。

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

1. 补完整登录态、只读接口保护、角色权限矩阵细化、关键写入审批和高风险操作二次确认。
2. 补客户附件归档、项目任务联动、客户文档搜索跳转。
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
| 客户详情缺少文档打开编辑、渠道转介绍、项目机会入口 | 已修复，客户详情已接入文档编辑、渠道转介绍和生成项目机会 |
| REST/MCP 写入缺少最小审计日志 | 已修复，写入会记录到 `audit_logs` 并可通过 `/api/crazor/audit-logs` 查询 |
| REST/MCP 审计 actor 只能信任请求头或 MCP 参数 | 已修复，服务端可从 API token / agent token 派生 actor |
| API token / agent token 没有写入权限范围 | 已修复，`actor_tokens.scopes` 已接入 REST/MCP 写入校验和越权拒绝审计 |
| 无 token 仍可匿名写入业务 API/MCP | 已修复，可通过 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 强制写入认证；无 token 写入会被拒绝并审计 |
| token 有 scope 但缺少角色级写入上限 | 已修复，`admin/member/viewer` 写入上限已接入 REST/MCP 权限判定，角色降级会即时影响已签发 token |
| 统一 Web 入口 `POST /mcp` 被 Nginx 301 到丢失端口的 `/mcp/` | 已修复，新增精确代理规则，StreamableHTTP 可直接返回 `Mcp-Session-Id` |
| 团队身份、token 与审计日志没有统一页面 | 已修复，新增“协作审计”页面 |

## 本轮验证记录

| 验证项 | 结果 |
|--------|------|
| Docker 服务健康度 | `crazor-web`、`crazor-server`、`hermes` 均 healthy |
| 前端/服务端 Docker 构建 | 通过 |
| 基础业务 API 写入烟测 | 客户、渠道、流水、内容作品、项目、任务均通过创建、更新、删除 |
| 客户 Case API 烟测 | 临时客户、跟进、需求文档、成交流水创建验证后已清理 |
| 客户 Case 深链路烟测 | 临时客户、文档打开编辑、渠道转介绍、项目机会、审计日志验证后已清理 |
| 页面级轻量核验 | 客户新增、项目新增、内容作品新增、客户详情 Case 操作入口均可见 |
| REST/MCP 审计烟测 | 人类来源和 agent 来源写入均生成审计日志，`payload_hash` 为 64 位 SHA-256 |
| 身份 token 烟测 | API token 创建客户记录 `human / api-token`，agent token 调 MCP SSE 与 StreamableHTTP 均记录 `agent / agent-token`，无效 token 不回落到伪造 header |
| Token scope 权限烟测 | `contact:create` API token 和 agent token 可创建客户；越权创建项目分别被 REST 403 和 MCP `isError=true` 拒绝，并记录 `deny_create` 审计 |
| 强制写入认证烟测 | 开启 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 后，无 token REST/MCP 写入被拒绝；有效 token 放行；烟测结束后恢复默认运行状态 |
| 角色级 RBAC 烟测 | admin 可管理身份；member 可写业务域但不能写 identity；viewer 不可写；agent 角色降级后已发 token 的 MCP 写入被拒绝并记录审计 |
| 协作审计页面烟测 | Web Docker 构建通过；身份 API、token API、审计 API 均通过统一入口验证 |
