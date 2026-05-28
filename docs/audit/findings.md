# 审计问题台账

> 等级说明：P0 阻断真实使用闭环；P1 影响团队规模化使用或演示可靠性；P2 影响一致性、维护性或体验。

## 当前高优先级问题

### P0：业务页面写入闭环不完整

**现象**

- `DataView` 当前只实现列表、详情、删除和看板拖拽，没有实现新增和编辑弹窗。
- `transactionsConfig`、`tasksConfig`、`channelsConfig` 已声明 `createLabel`、`createDialogTitle`、`formFields`、`beforeCreate` 等配置，但通用组件未消费这些配置。
- `ContactsView` 使用 `SchemaDataView`，而 `SchemaDataView` 明确是只读数据浏览器；已有的 `contactsConfig` 没有接入当前入口。

**影响**

客户、渠道、财务、项目、内容等模块的后端 API 和 MCP Tool 较完整，但人类用户无法在统一入口完成同等写入操作。对团队内部使用和客户演示都属于阻断。

**建议**

优先补 `DataView` 的新增/编辑能力，并决定 `contacts` 是否回到配置化 `DataView`，或把 `SchemaDataView` 升级成可写 schema 表单。

### P0：团队协作缺少身份、权限和审计归因

**现象**

产品愿景文档已经定义 SSO、RBAC、审计日志、多用户 token，但当前服务端没有业务用户身份、角色权限、操作日志表。

**影响**

多 agent、多成员协作时，无法回答“谁通过哪个 agent 改了哪个客户/文档/交易”。这会影响真实业务可信度，也会影响后续客户演示。

**建议**

先做最小审计闭环：为 REST API 和 MCP Tool 写入操作记录 `actor_type`、`actor_id`、`source`、`action`、`entity`、`entity_id`、`payload_hash`、`created_at`。

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

### P1：客户关联文档链路需继续核验

**现象**

后端有 `/api/crazor/contacts/:id/docs` 和 `list_notes_by_contact`，文档层支持 `contact_id`，但前端客户详情目前主要展示关联渠道，没有显式展示客户文档。

**影响**

客户需求、访谈纪要、方案文档无法自然沉淀到客户档案，削弱“需求跟踪、客户维护、二次开发/课程机会识别”的主场景。

**建议**

客户详情增加“关联文档/需求记录”区块，支持新建需求文档、打开文档、从跟进记录生成文档。

### P2：存在未接入的旧配置和潜在误导代码

**现象**

- `web/src/configs/contactsConfig.jsx` 包含完整客户表单配置，但当前 `ContactsView` 没有使用它。
- `web/src/api/mock-data.js` 仍存在，但当前未发现业务入口直接导入。
- `web/src/api/browser-utils.js` 仍保留直接拉取 Hermes skills index 的函数，当前市场页面使用服务端代理，但这个函数未来可能绕过轻量化修复。

**影响**

后续开发者容易误判“功能已经配置好了”，但入口实际没有使用。

**建议**

未使用配置要么接入，要么归档；市场索引统一走服务端 `/api/skills/market`。

### P2：中文化仍需收口

**现象**

部分 locale 和 UI 文案仍保留英文表达，例如工作区空态、Provider 说明、若干技术描述。

**影响**

不影响功能，但会影响内部培训和客户演示的一致性。

**建议**

把中文演示路径涉及的页面优先做中文文案审计，不要求代码名和协议名翻译。

## 修复优先级建议

1. 补齐 `DataView` 新增/编辑弹窗，让客户、渠道、财务、任务、内容至少能在 UI 内创建。
2. 在客户详情补“跟进记录 + 关联文档 + 需求文档”区块。
3. 建最小审计日志表和 MCP/REST 写入日志。
4. 收敛 Agent Provider 能力抽象，减少 UI 对 Hermes 私有概念的硬依赖。
5. 梳理未使用配置、旧 mock 模块和直接外部 fetch 工具。

## 已修复问题

| 问题 | 状态 |
|------|------|
| 文档旧路径请求 `knowledge/关于我/...` 返回 404 | 已修复，自动映射数字前缀路径 |
| 文档不存在时页面报错 | 已修复，读取时创建空白文档 |
| `/api/skills/market` 返回约 24MB 导致 502 风险 | 已修复，服务端裁剪为轻量响应 |
