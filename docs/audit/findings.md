# 审计问题台账

> 等级说明：P0 阻断真实使用闭环；P1 影响团队规模化使用或演示可靠性；P2 影响一致性、维护性或体验。

## 当前高优先级问题

### P0：强制写入认证、角色级写入上限、敏感只读和业务只读保护已补，完整登录态和审批仍未完成

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
- 服务端新增敏感只读保护：开启强制认证且已有 active token 后，`audit-logs`、团队成员列表、token 列表必须携带有权限的 token。
- 敏感只读保护同样受 token scope 与角色上限约束；无 token、无效 token、非 admin 读取敏感接口都会被拒绝并记录 `deny_read` 审计。
- 服务端新增可选业务只读保护：开启 `CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=true` 或 `CRAZOR_REQUIRE_READ_TOKEN=true` 且已有 active token 后，客户、项目、任务、内容、文档、渠道、财务和分析等业务读取必须携带有权限的 token。
- 业务只读保护同样受 token scope 与角色读取上限约束；无 token 会返回 401 并记录 `deny_read`，有 `read:*` 或对应业务读取 scope 的 token 可正常读取。
- 统一入口已新增“协作审计”页面，可以创建团队成员或 Agent 身份、按权限范围签发/撤销 token、设置当前访问 token、查看审计日志。
- Docker MVP 交付烟测已脚本化：`./scripts/hermes smoke` 会通过统一入口验证后端健康、Hermes 状态代理、MCP StreamableHTTP、身份 token、客户 Case、文档附件、渠道流水、项目任务、内容发布、分析概览和审计日志，并清理临时数据。
- 但当前还没有完整登录态、关键操作审批，以及可配置到页面策略层的细粒度 RBAC 矩阵。

**影响**

现在可以回答“这次写入、敏感读取或业务读取是否有可信身份、足够 token scope，并且未突破角色上限”，也能审计无 token 与越权尝试；但页面级登录态、关键审批和完整权限策略管理尚未形成。

**建议**

下一步补完整登录态、可配置的接口级 RBAC 策略、关键写入操作审批和高风险操作二次确认。

### P1：客户 Case 已补深链路、项目任务联动、跨模块提醒、文档搜索、附件策略和附件预览

**现象**

- 客户基础资料、跟进记录、待跟进提醒完成/顺延、需求文档、文档打开编辑、客户文档正文搜索、附件策略校验、附件上传/下载/删除、文本/图片附件预览、成交登记、渠道转介绍、项目机会、项目任务拆解已经可以在客户详情完成第一层深链路。
- 后端已支持 `/api/crazor/task-reminders` 读取今日到期/逾期的未完成项目任务，并在 `/api/crazor/analytics/overview` 聚合 `taskReminders` 和 `projects.tasksDue`。
- 前端数据分析页已把客户待跟进提醒和项目任务到期提醒放在统一运营视图里，任务可直接完成或顺延。
- MCP 已新增 `get_task_reminders`，Agent 可读取待处理任务提醒。
- 客户文档、待跟进提醒处理、附件归档、渠道转介绍、项目机会、任务拆解写入均已通过统一入口 API 验证，并进入 `audit_logs`。
- 后端已支持 `/api/crazor/tasks?contact_id=:id` 按客户读取关联项目下任务，前端客户详情会在项目机会下展示任务，并可直接从项目拆任务。
- 后端已支持 `/api/crazor/follow-up-reminders` 读取今日到期/逾期提醒，前端客户详情和数据分析页均可直接完成或顺延提醒。
- 后端已支持 `/api/crazor/contacts/:id/docs/search` 按客户搜索需求文档标题和正文，前端客户详情可直接打开搜索结果。
- 后端已支持 `/api/crazor/contacts/:id/attachments` 附件归档接口，附件存储在 `CRAZOR_HOME/attachments/contacts/:id`，并纳入 `contact_attachment` 审计。
- 后端已支持 `/api/crazor/attachments/policy`、附件扩展名白名单、单文件大小限制和附件预览接口；前端客户详情会读取策略并做上传前校验。

**影响**

客户维护到项目任务、跟进提醒、需求文档和附件归档的核心链路已经可以演示；数据分析页也能统一处理客户跟进提醒和项目任务到期提醒。

**建议**

下一步补客户级权限边界、更细的提醒规则配置、附件病毒扫描/敏感信息扫描和更多格式预览。

### P1：Agent Gateway 解耦仍停留在部分实现

**现象**

已有 `docs/architecture/agent-gateway.md`，服务端也有 `AGENT_*` 配置，但前端和 API 中仍有大量 Hermes Dashboard、Hermes Skills、Hermes Memory、Hermes Channels 的私有概念。

**影响**

后续替换 Dify、自研 Gateway 或其他 Agent Provider 时，业务功能可能被 Hermes 私有接口牵制。

**建议**

按能力拆 Provider：对话、模型、技能、记忆、任务、文件、终端、渠道。前端展示“当前 Provider 支持/不支持”状态，不再默认所有 provider 都有 Hermes Dashboard。

### P1：内容正文、发布动作和指标回收链路已补，外部平台自动回执仍待接入

**现象**

- 数据架构要求 `content_pieces.doc_id` 关联知识库正文。
- 内容详情已接入“创建正文 / 搜索正文 / 关联正文 / 打开正文 / 保存正文”：没有 `doc_id` 时会创建知识库正文并回填内容作品，也可以搜索已有知识库正文后关联。
- `POST /api/crazor/docs/:scope/notes` 已支持 `content`，创建正文不再只生成空笔记。
- REST 已新增 `POST /api/crazor/content-pieces/:id/publish` 和 `PATCH /api/crazor/content-pieces/:id/metrics`，统一入口可直接标记发布并回收阅读/点赞/评论/转发指标。
- 内容详情可向关联正文写入发布复盘模板，复盘模板包含指标回收、有效点、风险点和下一步动作。
- 临时内容作品和正文文档已通过统一入口端到端验证，并进入 `audit_logs`，其中发布记录为 `publish`，指标回收记录为 `update_metrics`。
- 当前还未接入外部平台真实发布回执、自动指标采集和内容级权限边界。

**影响**

内容生产从追踪记录、正文文档、发布状态、指标回收到复盘正文已经能形成手动闭环；外部平台自动化仍需要后续 Provider 或集成模块支撑。

**建议**

下一步补外部平台发布回执、指标自动采集、内容级权限边界和发布前审批。

### P2：存在旧配置和潜在误导代码

**现象**

- `web/src/api/mock-data.js` 仍存在，但当前未发现业务入口直接导入。
- 连接器页面当前只能管理 Provider 环境变量凭证，不能证明飞书、企业微信、小红书、GitHub 等外部平台已经完成真实 API 连通、回调接收或数据同步。
- 连接器卡片此前会把凭证填满显示为“已连接”，本轮已改为“凭证完整/部分填写”，避免把配置状态误判成真实业务链路。
- `web/src/api/browser-utils.js` 此前保留直接拉取 Hermes skills index 的函数，当前已改为统一走服务端 `/api/skills/market` 轻量代理。

**影响**

后续开发者容易误判“功能已经配置好了”，但入口实际只保存了凭证，还没有完成外部平台的端到端集成。

**建议**

未使用配置要么接入，要么归档；任何演示路径不允许展示 mock 数据。连接器下一步要补真实连通性测试、Webhook 回调入口、同步任务和失败审计。

### P2：中文化仍需收口

**现象**

部分 locale 和 UI 文案仍保留英文表达，例如工作区空态、Provider 说明、若干技术描述。

**影响**

不影响功能，但会影响内部培训和客户演示的一致性。

**建议**

把中文演示路径涉及的页面优先做中文文案审计，不要求代码名和协议名翻译。

## 修复优先级建议

1. 补完整登录态、角色权限矩阵细化、关键写入审批和高风险操作二次确认。
2. 补客户级权限边界、更细的提醒规则配置、附件病毒扫描/敏感信息扫描和更多格式预览。
3. 收敛 Agent Provider 能力抽象，减少 UI 对 Hermes 私有概念的硬依赖。
4. 补外部平台发布回执、指标自动采集、内容级权限边界和发布前审批。
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
| 内容作品无法从详情打开或创建知识库正文 | 已修复，内容详情已接入正文创建、`doc_id` 回填、打开和保存 |
| 内容作品缺少发布、指标回收、正文搜索关联和复盘模板入口 | 已修复，内容详情可标记发布、回收指标、搜索/关联知识正文并写入复盘模板 |
| 客户文档正文不能在客户详情搜索跳转 | 已修复，客户详情已接入 `/api/crazor/contacts/:id/docs/search`，搜索结果可直接打开编辑 |
| 客户附件没有归档入口 | 已修复，客户详情已接入附件上传、列表、下载、删除，并记录 `contact_attachment` 审计 |
| 客户附件缺少上传策略和预览 | 已修复，附件策略接口、扩展名/大小限制、文本/图片预览和前端上传前校验已接入 |
| 待跟进提醒只能看不能处理 | 已修复，客户详情和数据分析页可完成或顺延提醒，更新进入 `follow_up` 审计 |
| 项目看板无项目时无法创建任务链路 | 已修复，补项目创建入口并联动当前看板 |
| 客户详情不渲染 `detailExtra` 扩展区 | 已修复，`DataView` 已桥接根级 `detailExtra` 到 `DataDetail` |
| 客户文档创建后列表读不回 | 已修复，客户文档列表已合并知识库树与旧目录 |
| 客户 Case 缺少跟进/文档/成交最小入口 | 已修复，客户详情已接入跟进、需求文档和成交登记 |
| 客户详情缺少文档打开编辑、渠道转介绍、项目机会入口 | 已修复，客户详情已接入文档编辑、渠道转介绍和生成项目机会 |
| 客户项目缺少直接拆任务和按客户读回任务链路 | 已修复，客户详情已接入拆任务，后端支持 `/api/crazor/tasks?contact_id=:id` |
| 项目任务到期/逾期没有统一提醒入口 | 已修复，新增 `/api/crazor/task-reminders`、数据分析页任务提醒处理和 MCP `get_task_reminders` |
| REST/MCP 写入缺少最小审计日志 | 已修复，写入会记录到 `audit_logs` 并可通过 `/api/crazor/audit-logs` 查询 |
| REST/MCP 审计 actor 只能信任请求头或 MCP 参数 | 已修复，服务端可从 API token / agent token 派生 actor |
| API token / agent token 没有写入权限范围 | 已修复，`actor_tokens.scopes` 已接入 REST/MCP 写入校验和越权拒绝审计 |
| 无 token 仍可匿名写入业务 API/MCP | 已修复，可通过 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 强制写入认证；无 token 写入会被拒绝并审计 |
| token 有 scope 但缺少角色级写入上限 | 已修复，`admin/member/viewer` 写入上限已接入 REST/MCP 权限判定，角色降级会即时影响已签发 token |
| 敏感只读接口在严格模式下仍可匿名读取 | 已修复，`audit-logs`、团队成员列表、token 列表已接入敏感只读权限校验和 `deny_read` 审计 |
| 业务只读接口缺少可选严格认证边界 | 已修复，`CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=true` 后客户、项目、任务、内容、文档、渠道、财务和分析等业务读取会校验 token scope 与角色读取上限 |
| 核心业务链路缺少可重复交付烟测 | 已修复，新增 `scripts/crazor-smoke.mjs` 与 `./scripts/hermes smoke`，覆盖核心 Docker MVP 链路、MCP StreamableHTTP Agent 工具链路并自动清理临时数据 |
| 统一 Web 入口 `POST /mcp` 被 Nginx 301 到丢失端口的 `/mcp/` | 已修复，新增精确代理规则，StreamableHTTP 可直接返回 `Mcp-Session-Id` |
| 团队身份、token 与审计日志没有统一页面 | 已修复，新增“协作审计”页面 |
| 设置页 Dashboard 保存按钮导入不存在的浏览器工具 | 已修复，补 `loadBrowserEnvVars` / `saveBrowserEnvVars`，端口保存可重复验证 |
| 浏览器端技能市场工具绕过服务端轻量代理 | 已修复，`fetchMarketIndex` 统一请求 `/api/skills/market` |
| 连接器凭证填满后显示“已连接”容易误导真实链路 | 已修复，页面改为“凭证完整/部分填写” |

## 本轮验证记录

| 验证项 | 结果 |
|--------|------|
| Docker 服务健康度 | `crazor-web`、`crazor-server`、`hermes` 均 healthy |
| 前端/服务端 Docker 构建 | 通过 |
| 基础业务 API 写入烟测 | 客户、渠道、流水、内容作品、项目、任务均通过创建、更新、删除 |
| 客户 Case API 烟测 | 临时客户、跟进、需求文档、成交流水创建验证后已清理 |
| 客户 Case 深链路烟测 | 临时客户、文档打开编辑、渠道转介绍、项目机会、审计日志验证后已清理 |
| 客户项目任务联动烟测 | 临时客户、项目、任务创建后，按 project 和 contact_id 均可读回任务，另一客户隔离正常，任务创建进入审计日志 |
| 客户文档搜索与附件归档烟测 | 临时客户、需求文档、附件创建后，文档正文搜索、附件上传/列表/下载/删除和 `contact_attachment` 审计均通过 |
| 客户附件策略与预览烟测 | 附件策略读取、文本预览、图片预览、非法类型 415、超大文件 413、附件审计均通过 |
| 客户待跟进提醒处理烟测 | 临时今日提醒可读回；完成后从提醒列表移除；顺延到未来日期后从今日提醒移除；`follow_up` 更新审计通过 |
| 项目任务到期提醒烟测 | 临时今日到期任务可读回；完成后从提醒列表移除；顺延到未来日期后从今日提醒移除；MCP `get_task_reminders` 和 `task` 更新审计通过 |
| 内容发布与指标回收烟测 | 临时内容作品可标记发布、回收指标、搜索并关联正文、写入复盘模板；`publish`、`update_metrics` 和正文关联审计均通过 |
| 页面级轻量核验 | 客户新增、项目新增、内容作品新增、客户详情 Case 操作入口、内容发布/指标/正文入口、任务到期提醒入口均可见 |
| REST/MCP 审计烟测 | 人类来源和 agent 来源写入均生成审计日志，`payload_hash` 为 64 位 SHA-256 |
| 身份 token 烟测 | API token 创建客户记录 `human / api-token`，agent token 调 MCP SSE 与 StreamableHTTP 均记录 `agent / agent-token`，无效 token 不回落到伪造 header |
| Token scope 权限烟测 | `contact:create` API token 和 agent token 可创建客户；越权创建项目分别被 REST 403 和 MCP `isError=true` 拒绝，并记录 `deny_create` 审计 |
| 强制写入认证烟测 | 开启 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 后，无 token REST/MCP 写入被拒绝；有效 token 放行；烟测结束后恢复默认运行状态 |
| 角色级 RBAC 烟测 | admin 可管理身份；member 可写业务域但不能写 identity；viewer 不可写；agent 角色降级后已发 token 的 MCP 写入被拒绝并记录审计 |
| 敏感只读保护烟测 | 严格模式下无 token/无效 token/非 admin 读取敏感接口被拒绝；admin 可读；普通业务只读保持可用；拒绝进入 `deny_read` 审计 |
| 业务只读保护烟测 | 开启 `CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=true` 后，无 token 读取客户列表返回 401；`read:*` token 可读客户和分析数据；拒绝进入 `deny_read contact` 审计 |
| 协作审计页面烟测 | Web Docker 构建通过；身份 API、token API、审计 API 均通过统一入口验证 |
| 自动交付烟测脚本 | `node --check scripts/crazor-smoke.mjs`、`bash -n scripts/hermes`、`./scripts/hermes smoke`、`./scripts/hermes smoke-strict` 均通过；严格模式匿名 REST/MCP 写入被拒绝；MCP initialize/tools/list/create_contact/get_task_reminders 通过；临时客户、MCP 客户、文档、附件、渠道、流水、项目、任务、内容和身份已清理 |
| 连接器与浏览器工具补充验证 | `node --test web/src/api/browser-utils.test.js web/src/integrations-status.test.js` 通过；`docker compose build crazor-web` 通过；运行中 Web 容器已替换为最新镜像，`127.0.0.1:5173` 与 `192.168.103.4:5173` 健康检查通过 |
