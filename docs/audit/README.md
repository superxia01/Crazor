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

当前默认部署不会写入前端 mock 数据、手动 mock 灌库数据或内容作品示例记录；内容作品演示记录与知识库 mock-data 均受 `CRAZOR_SEED_DEMO_DATA=true` 控制。

本轮已补齐第一层业务写入能力：客户、渠道、流水、内容作品、项目、任务都通过统一入口或统一表单组件进入可创建、可更新、可删除的最小闭环，并通过 API 写入烟测确认。

客户 Case 的最小工作台也已接入并完成深链路验证：客户详情可以新增跟进记录、处理待跟进提醒、新建需求文档、搜索并打开客户文档、按策略上传/下载/删除客户附件，且可预览文本/图片附件、登记成交、建立渠道转介绍，从客户生成项目机会，并从客户项目直接拆解任务。

跨模块提醒已补第一层闭环：数据分析页会同时聚合客户待跟进提醒和项目任务到期提醒，任务到期/逾期后可在统一视图里完成或顺延，Agent 侧也可通过 MCP `get_task_reminders` 读取待处理任务。

内容作品到知识库正文、发布和指标回收的闭环已接入：内容详情可以创建正文、搜索并关联已有正文、打开并编辑知识库正文，且可直接标记发布、回收阅读/点赞/评论/转发指标，并向正文写入发布复盘模板。

操作审计的最小底座已接入：REST 和 MCP 写入会记录到 `audit_logs`，包含操作者类型、操作者 ID、来源、动作、实体、实体 ID、payload hash 和创建时间。

可信 actor 来源与最小权限边界已接入：服务端新增团队成员与 actor token 表，REST 请求可以通过 `Authorization: Bearer` 或 `X-Crazor-Token` 派生 `human / api-token` 来源，MCP 工具调用可以派生 `agent / agent-token` 来源；token 已支持 `scopes`，REST/MCP 写入都会校验 scope，并被成员角色写入上限二次裁剪。开启 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 后，无 token 写入会被拒绝；已有 active token 后，审计日志、成员列表、token 列表等敏感只读接口也会要求有权限的 token。开启 `CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=true` 或 `CRAZOR_REQUIRE_READ_TOKEN=true` 后，客户、项目、任务、内容、文档、渠道、财务和分析等业务读取也会要求有权限的 token。越权写入、敏感只读拒绝和业务只读拒绝会记录 `deny_*` 审计日志。

协作审计的最小工作台已接入：统一 Web 入口新增“协作审计”页面，可以创建团队成员或 Agent 身份、按权限范围签发/撤销 API token 和 agent token，设置当前访问 token，并查看真实 `audit_logs` 写入记录。

交付烟测已沉淀为可重复执行脚本：`./scripts/hermes smoke` 会通过 Web 统一入口创建并清理临时客户、文档、附件、渠道、流水、项目、任务、内容、API token 和 agent token，验证后端健康、Hermes 状态代理、MCP StreamableHTTP、身份 token、业务只读边界、客户 Case、跨模块提醒、内容发布、分析概览和审计日志。

但从“团队内部真实使用”的标准看，产品仍不是完整闭环。核心差距在于：

- 客户 Case 已打通第一层业务深链路、项目任务联动、客户文档搜索跳转、附件归档、附件类型/大小策略、文本/图片预览、待跟进提醒处理和项目任务到期提醒；下一步要继续补客户级权限边界和更细的提醒规则配置。
- 内容作品已打通追踪记录到知识库正文、正文搜索关联、发布动作、指标回收和复盘模板写入链路；下一步要补外部平台真实发布回执、自动采集指标和内容级权限边界。
- 后端业务 API 与 MCP Tool 已经比较完整，前端已承接基础写入和客户 Case 深链路，下一步要补更细的协作权限和跨模块上下文。
- 多人协作所需的身份管理、当前访问 token、token scope、强制写入认证、角色级写入上限、敏感只读保护、业务只读保护和审计查看已经有最小 UI 与服务端拦截，但仍缺完整登录态、细粒度 RBAC 策略和关键操作审批。
- 连接器页面目前是外部服务凭证配置面板，本轮已把状态文案从“已连接”收敛为“凭证完整/部分填写”，并修复 Dashboard 端口保存、技能市场代理入口、`/api/env` 对象型返回读回和留空保存误删凭证风险；下一步要补真实外部平台连通性、Webhook 和同步任务审计。
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
| `/api/crazor/task-reminders` | 200 |
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

## 自动交付烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证：

| 链路 | 结果 |
|------|------|
| `node --check scripts/crazor-smoke.mjs` | 通过 |
| `bash -n scripts/hermes` | 通过 |
| `./scripts/hermes smoke` | 通过 |
| `./scripts/hermes smoke-strict` | 通过，临时开启严格认证后完成烟测并恢复默认后端配置 |
| `node --test web/src/api/browser-utils.test.js web/src/integrations-status.test.js` | 通过，覆盖连接器凭证状态、`/api/env` metadata 读回、留空保留配置和技能市场代理 |
| `node --test web/src/no-mock-data.test.js` | 通过，覆盖前端 mock 模块删除、手动 mock 灌库脚本删除和内容作品种子开关 |
| `docker compose build crazor-server crazor-web` | 通过，运行中 Server/Web 容器已替换为最新镜像 |
| 后端健康检查 | 通过 |
| Hermes Provider 状态代理 | 通过 |
| 准备可审计烟测身份 | 通过 |
| MCP StreamableHTTP Agent 工具链路 | 通过，`initialize` 返回 `Mcp-Session-Id`，`tools/list` 返回 `create_contact` 与 `get_task_reminders`，`create_contact` 审计来源为 `agent-token` |
| 业务只读边界探测 | 通过 |
| 严格认证匿名写入边界 | 通过，匿名 REST 写入返回 401，匿名 MCP 写入返回 `isError=true` 且拒绝信息包含 `contact:create` |
| 只读 token 可访问业务数据 | 通过 |
| 客户 Case 基础链路 | 通过 |
| 跟进提醒处理链路 | 通过 |
| 客户文档搜索与附件链路 | 通过 |
| 渠道、成交和客户关联链路 | 通过 |
| 项目任务与任务提醒链路 | 通过，REST 与 MCP `get_task_reminders` 均可读到今日到期任务 |
| 内容发布、指标回收和知识正文链路 | 通过 |
| 分析概览与审计日志 | 通过 |
| 临时数据清理 | 通过，客户、MCP 客户、文档、附件、渠道、流水、项目、任务、内容、临时成员和 Agent 身份均已清理 |

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
| 客户详情页面显示“跟进 / 需求文档 / 文档编辑 / 成交 / 渠道转介绍 / 生成项目 / 拆任务”入口 | 通过 |

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

## 客户项目任务联动烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时客户、项目、任务创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| 客户详情加载 `/api/crazor/tasks?contact_id=:id` | 已接入，按客户读回关联项目下任务 |
| `POST /api/crazor/projects` 创建客户项目机会 | 通过 |
| `POST /api/crazor/tasks` 从客户项目拆解任务 | 通过 |
| `GET /api/crazor/tasks?project=:id` 按项目读回任务 | 通过 |
| `GET /api/crazor/tasks?contact_id=:id` 按客户读回任务 | 通过，返回 `project_name` 和 `contact_id` |
| 另一客户查询任务 | 通过，不会读到该客户任务 |
| `/api/crazor/audit-logs` 记录 `task` 创建 | 通过 |
| 临时客户、项目、任务、客户目录清理 | 通过 |

## 客户文档搜索与附件归档烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时客户、文档、附件创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `POST /api/crazor/contacts` 创建临时客户 | 通过 |
| `POST /api/crazor/contacts/:id/docs` 创建含关键词的需求文档 | 通过 |
| `GET /api/crazor/contacts/:id/docs/search?q=...` 搜索客户文档正文 | 通过，返回新建文档和摘要片段 |
| `POST /api/crazor/contacts/:id/attachments` 上传客户附件 | 通过，附件进入 `CRAZOR_HOME/attachments/contacts/:id` |
| `GET /api/crazor/contacts/:id/attachments` 读回附件列表 | 通过 |
| `GET /api/crazor/contacts/:id/attachments/:filename` 下载附件 | 通过，内容一致 |
| `DELETE /api/crazor/contacts/:id/attachments/:filename` 删除附件 | 通过 |
| `/api/crazor/audit-logs` 记录 `contact_attachment` 创建/删除 | 通过 |
| 临时客户、文档、附件、客户目录清理 | 通过 |

## 客户附件策略与预览烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时客户和附件创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `GET /api/crazor/attachments/policy` 读取附件策略 | 通过，默认 20MB，预览 512KB，返回允许扩展名和前端 `accept` |
| 文本附件上传并预览 | 通过，`preview_url` 返回 `kind=text` 和正文 |
| 图片附件上传并预览 | 通过，`preview_url` 返回 `kind=image` 和 base64 内容 |
| 非允许扩展名上传 | 通过，返回 415 |
| 超过大小限制上传 | 通过，返回 413 |
| `GET /api/crazor/contacts/:id/attachments` 元数据 | 通过，返回 `preview_url`、`download_url`、`mime_type`、`can_preview` |
| `/api/crazor/audit-logs` 记录附件创建/删除 | 通过 |
| 临时客户和附件清理 | 通过 |

## 客户待跟进提醒处理烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时客户和提醒创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `POST /api/crazor/contacts` 创建临时客户 | 通过 |
| `POST /api/crazor/follow-ups` 创建今日待跟进提醒 | 通过 |
| `GET /api/crazor/follow-up-reminders` 读回待处理提醒 | 通过 |
| `PATCH /api/crazor/follow-ups/:id` 标记完成 | 通过，完成后不再出现在待跟进提醒 |
| `PATCH /api/crazor/follow-ups/:id` 顺延到未来日期 | 通过，顺延后不再出现在今日待跟进提醒 |
| `GET /api/crazor/follow-ups?contact_id=:id` 校验状态和日期 | 通过 |
| `/api/crazor/audit-logs` 记录 `follow_up` 更新 | 通过 |
| 临时客户和提醒清理 | 通过 |

## 项目任务到期提醒烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时项目和任务创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `POST /api/crazor/projects` 创建临时项目 | 通过 |
| `POST /api/crazor/tasks` 创建今日到期任务 | 通过 |
| `GET /api/crazor/task-reminders` 读回到期任务 | 通过，返回项目名和任务信息 |
| `/api/crazor/analytics/overview` 聚合 `taskReminders` 和 `projects.tasksDue` | 通过 |
| `PATCH /api/crazor/tasks/:id` 标记完成 | 通过，完成后不再出现在任务提醒 |
| `PATCH /api/crazor/tasks/:id` 顺延到未来日期 | 通过，顺延后不再出现在今日任务提醒 |
| `POST /mcp` 调用 `tools/list` 和 `get_task_reminders` | 通过，Agent 可读取到期任务提醒 |
| `/api/crazor/audit-logs` 记录 `task` 更新 | 通过 |
| 数据分析页显示“任务到期提醒”和“明天 / 下周 / 完成”入口 | 通过 |
| 临时项目和任务清理 | 通过 |

## 内容发布与指标回收烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时内容作品和正文文档创建后已全部删除：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `POST /api/crazor/content-pieces` 创建内容作品 | 通过，初始无 `doc_id` |
| `POST /api/crazor/content-pieces/:id/publish` 标记发布 | 通过，回写 `已发布` 和发布日期 |
| `PATCH /api/crazor/content-pieces/:id/metrics` 回收指标 | 通过，阅读/点赞/评论/转发可读回 |
| `POST /api/crazor/docs/knowledge/notes` 创建内容正文 | 通过，接口已保留初始 `content` |
| `GET /api/crazor/docs/knowledge/search?q=...` 搜索正文 | 通过，可命中新建正文 |
| `PATCH /api/crazor/content-pieces/:id` 回填 `doc_id` | 通过 |
| `GET /api/crazor/docs/knowledge/notes-ops` 打开正文 | 通过，可读回初始正文 |
| `PATCH /api/crazor/docs/knowledge/notes-ops` 写入发布复盘模板 | 通过，保存后可读回 `### 指标回收` |
| `/api/crazor/audit-logs` 记录 `content_piece` 发布、指标回收、正文关联和 `doc_note` 创建/更新 | 通过 |
| 平台流量详情页显示发布、指标、正文搜索、复盘模板入口 | 通过 |
| 临时内容作品和正文文档清理 | 通过 |

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

## 强制写入认证烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时成员、token、客户目录创建后已全部删除；烟测结束后已恢复默认 Docker 配置：

| 链路 | 结果 |
|------|------|
| `CRAZOR_REQUIRE_WRITE_TOKEN=true docker compose up -d --no-deps crazor-server crazor-web` | 通过，server healthy |
| 无 token 调 REST 创建客户 | 被拒绝，返回 401，`required_scope=contact:create` |
| 全权限 API token 调 `/api/crazor/identity/me` | 通过，可读回 actor 与 `scopes=["*"]` |
| `contact:create` API token 调 REST 创建客户 | 通过 |
| 同一 API token 调 REST 创建项目 | 被拒绝，返回 403 |
| 无 token 调 MCP `create_contact` | 被拒绝，返回 MCP `isError=true` |
| `contact:create` agent token 调 MCP `create_contact` | 通过 |
| 同一 agent token 调 MCP `create_project` | 被拒绝，返回 MCP `isError=true` |
| 无 token / 越权写入审计 | 通过，记录 `missing-token deny_create` 和窄 scope `deny_create` |
| 临时客户、成员、token、客户目录清理 | 通过，`cleanup_errors` 为空 |
| 恢复默认 `docker compose up -d --no-deps crazor-server crazor-web` | 通过，server/web/hermes 均 healthy |

## 角色级 RBAC 烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时成员、token 和客户数据创建后已全部删除；烟测结束后已恢复默认 Docker 配置：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `CRAZOR_REQUIRE_WRITE_TOKEN=true docker compose up -d --no-deps crazor-server` | 通过，server healthy |
| admin token 解析 `/api/crazor/identity/me` | 通过，返回 `role=admin` |
| member + `*` scope 创建客户 | 通过 |
| member + `*` scope 创建团队身份 | 被拒绝，返回 403，`error=role denied`，`required_scope=team_member:create` |
| viewer + `*` scope 创建客户 | 被拒绝，返回 403，`error=role denied`，`required_scope=contact:create` |
| agent member token 调 MCP `create_contact` | 通过 |
| 同一 agent token 在成员角色降为 viewer 后再次调 MCP `create_contact` | 被拒绝，返回 MCP `isError=true`，错误包含 `role denied` |
| REST/MCP 角色越权审计 | 通过，记录 `deny_create team_member` 和 `deny_create contact` |
| 临时客户、成员、token、客户目录清理 | 通过 |
| 恢复默认 `docker compose up -d --no-deps crazor-server crazor-web` | 通过，`CRAZOR_REQUIRE_WRITE_TOKEN=false`，server/web/hermes 均 healthy |

## 敏感只读保护烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时成员和 token 创建后已全部删除；烟测结束后已恢复默认 Docker 配置：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| `CRAZOR_REQUIRE_WRITE_TOKEN=true docker compose up -d --no-deps crazor-server` | 通过，server healthy |
| 无 token 读取 `/api/crazor/audit-logs` | 被拒绝，返回 401，`required_scope=audit_log:read` |
| 无效 token 读取 `/api/crazor/identity/members` | 被拒绝，返回 401 |
| admin token 读取 `/api/crazor/audit-logs`、`/api/crazor/identity/members`、`/api/crazor/identity/tokens` | 通过，token 列表不返回明文 token |
| member + `*` scope 读取成员列表 | 被拒绝，返回 403，`error=role denied`，`required_scope=team_member:read` |
| viewer + `read:*` scope 读取审计日志 | 被拒绝，返回 403，`error=role denied`，`required_scope=audit_log:read` |
| 普通业务只读 `/api/crazor/contacts` | 保持 200，避免默认演示入口被整体锁死 |
| 敏感只读拒绝审计 | 通过，记录 `deny_read audit_log` 和 `deny_read team_member` |
| 恢复默认 `docker compose up -d --no-deps crazor-server crazor-web` | 通过，`CRAZOR_REQUIRE_WRITE_TOKEN=false`，`CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN` 为空，server/web/hermes 均 healthy |

## 业务只读保护烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证，临时只读成员和 token 创建后已删除；烟测结束后已恢复默认 Docker 配置：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-server crazor-web` | 通过 |
| 默认模式创建 viewer + `read:*` API token | 通过 |
| `CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=true docker compose up -d --no-deps --force-recreate crazor-server` | 通过，server healthy |
| 无 token 读取 `/api/crazor/contacts` | 被拒绝，返回 401，`required_scope=contact:read` |
| viewer + `read:*` token 读取 `/api/crazor/contacts` | 通过 |
| viewer + `read:*` token 读取 `/api/crazor/analytics/overview` | 通过，`analytics:read` 已纳入角色读取上限 |
| 无 token 读取 `/api/crazor/identity/me` | 保持 200，避免初始化探测被锁死 |
| 业务只读拒绝审计 | 通过，记录 `deny_read contact` |
| 恢复默认 `docker compose up -d --no-deps --force-recreate crazor-server` | 通过，`CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=false`，server/web/hermes 均 healthy |
| 临时只读成员和 token 清理 | 通过 |

## 协作审计页面烟测

通过本机 Docker 暴露入口 `http://127.0.0.1:5173` 验证：

| 链路 | 结果 |
|------|------|
| `docker compose build crazor-web` | 通过，生成 `TeamOpsView` 前端 chunk |
| 侧边栏“协作审计”入口 | 已接入 `teamops` 视图 |
| 页面依赖身份 API | 通过，成员创建、按权限范围签发 token、设置当前访问 token、token 列表不返回 `token_hash` |
| 页面依赖审计 API | 通过，可读取 `actor_token` 审计记录 |
| 临时成员和 token 清理 | 通过 |

## 持续审计规则

- 每次新增功能必须更新功能地图或问题台账。
- 每次发现“UI 展示了但链路未打通”的功能，必须进入问题台账。
- 每次影响 Docker 交付、核心 API、MCP 入口、身份权限、客户 Case、文档、附件、项目任务、内容发布或审计日志时，必须运行 `./scripts/hermes smoke`。
- 临时验证数据用完即删，不能混入正式运行数据。
- 文档使用中文记录，英文仅保留代码名、协议名、API 名称和必要产品名。
- 审计文档保持小文件拆分，不把所有内容堆进单个巨型文档。
