# M2 多运行时网关：Provider 适配层 + 能力门禁 + Responses 降级

> 分支：`feature/m2-runtime-gateway` · 2026-06-11
> 目标：落实 `docs/architecture/agent-gateway.md` 的解耦要求——业务路由不再绑定 Hermes。
> 网关层（chat/responses/models/jobs/sessions）全部经由新的 `agent-runtime.ts` 适配层访问，
> openai-compatible / custom 运行时在能力缺失时获得**真实降级**（协议翻译或真实空状态），而非 501 假错误或假数据。
> 无数据库表变更、无部署配置变更。

## 改动总览

| 文件 | 内容 |
|------|------|
| `server/src/services/agent-runtime.ts` | 新建。Provider 适配层：`gatewayFetch`（自 index.ts 迁入）、`runtimeChatCompletions` / `runtimeResponses`（含降级）/ `runtimeListModels` / `runtimeJobs.*` / `runtimeSessions.*` / `extractRuntimeSessionId`；Responses ⇄ Chat Completions 协议翻译（流式增量翻译器 + 非流式 payload 转换，纯函数可测） |
| `server/src/services/agent-runtime.test.ts` | 新建。11 项协议翻译不变量测试（`bun test`） |
| `server/src/index.ts` | 网关层路由（`/api/chat/completions`、`/api/responses`、`/api/models`、`/api/cron*`、`/api/sessions*`）收口到适配器并在路由内做能力门禁；`AGENT_PROVIDER_CAPABILITY_ROUTES` 前缀中间件移除 gateway.* 条目（dashboard.* 保持不变）；会话 id 头改用 `extractRuntimeSessionId`，新增 `X-Agent-Session-Id` 响应头（保留 `X-Hermes-Session-Id` 兼容）；错误文案去 Hermes 硬编码（改用 `AGENT_PROVIDER_DISPLAY_NAME`）；删除闲置的 `proxyGatewayJsonResponse` |

## 能力门禁语义（与架构文档对齐）

| 路由 | 能力 | 缺失时行为 |
|------|------|-----------|
| `POST /api/chat/completions` | `gateway.chat_completions` | 501 + `status:'unsupported'`（与原中间件契约一致） |
| `POST /api/responses` | `gateway.responses` **或** `gateway.chat_completions` | 有 chat 能力 → **降级翻译**；两者皆无 → 501 |
| `GET /api/models` | `gateway.models` | `{object:'list', data:[]}` 真实空列表 |
| `GET /api/cron` | `gateway.jobs` | `[]` 真实空数组（架构文档明确要求） |
| `POST/DELETE /api/cron*` | `gateway.jobs` | 501 + `status:'unsupported'` |
| `GET /api/sessions`、`/api/sessions/search`、`/:id/messages` | `gateway.sessions` | `[]` 真实空状态 |
| `GET/DELETE /api/sessions/:id` | `gateway.sessions` | 501 + `status:'unsupported'` |

**为什么把 gateway.\* 移出前缀中间件**：原中间件对 `/api/responses` 直接 501，降级路径永远不可达；对 `GET /api/cron` 返回 501 也违反"没有定时任务 API 时返回空数组"的架构要求。dashboard.\* 前缀（config/skills/memory/channels 等 Hermes 私有管理面）继续由中间件统一拦截，行为不变。

## Responses 降级协议翻译

触发条件（二选一）：
- provider 未声明 `gateway.responses`（如 `AGENT_PROVIDER=custom` 默认 openai-compatible 能力集）；
- 声明了但上游 `/v1/responses` 返回 404/405/501（端点缺失信号；5xx 运行错误不降级，照常透传）。

translation 契约与 `web/src/api/chat.js` 的 SSE 解析对齐：

```
Chat Completions SSE                          → Responses SSE
data: {choices:[{delta:{content:"x"}}]}       → event: response.output_text.delta + {delta:"x", response:{id}}
data: {choices:[{finish_reason:"stop"}]}      → event: response.completed（只发一次）
data: [DONE]                                  → event: response.completed（兜底，去重）
流意外中断                                     → event: response.failed
```

- 非流式：chat JSON → Responses 形状（`output[0].content[0].output_text` + `output_text`），并带 `degraded_from: 'chat.completions'` 标记；
- Responses `input` 字符串 → 单条 user 消息；消息数组 → 逐条映射（content parts 拼接 text 段）；
- `previous_response_id` 在降级模式下被忽略（无状态），前端默认 `replayHistory=true` 全量重放历史，会话连续性不受影响。

## API 契约变化

- 新增响应头 `X-Agent-Session-Id`（值与 `X-Hermes-Session-Id` 相同；旧头保留，前端无需改动）；
- 适配器按 `x-hermes-session-id` → `x-agent-session-id` → `x-session-id` 优先级提取上游会话 id；
- 其余路由的成功路径响应体不变；`/api/cron*` 写操作新增上游连接失败时的 502 结构化错误（原先未捕获会抛 500）。

## 验证清单

```bash
cd server && bun install

# 1. 协议翻译不变量（11 pass）
bun test src/services/agent-runtime.test.ts

# 2. 类型基线：与 master 相同的 34 条存量错误，零新增
bunx tsc --noEmit

# 3. openai-compatible 模式端到端（mock 上游只有 /v1/chat/completions，无 /v1/responses）
#    已验证：GET /api/cron → []；POST /api/cron → 501+unsupported；GET /api/sessions → []；
#    GET /api/models → 透传 mock 模型列表；
#    POST /api/responses stream:false → Responses 形状 + degraded_from 标记；
#    POST /api/responses stream:true  → response.output_text.delta×2 + response.completed
AGENT_PROVIDER=custom AGENT_PROVIDER_KIND=openai-compatible PORT=3199 bun run dev

# 4. hermes 模式（默认）：上游 /v1/responses 404 时自动降级，流式输出同上；
#    上游正常时走原生 /v1/responses 透传（行为与 M2 前一致）
PORT=3199 bun run dev

# 5. 回归：web 前端聊天视图（流式打字、完成回调）、定时任务页、会话列表页行为不变
./scripts/hermes smoke && ./scripts/hermes smoke-strict
```

## 已知边界与后续（M2.1+）

- **降级模式不翻译 tool_calls**：chat SSE 中的 `delta.tool_calls` 不会转成 `response.output_item.added`（function_call）事件，降级模式下前端工具调用气泡不显示；Hermes 原生 Responses 路径不受影响。
- 降级模式无服务端会话状态：`previous_response_id` 被忽略，依赖前端全量重放（当前默认行为）。
- Dashboard 层（`/api/config`、`/api/skills`、`/api/hermes-config/*`、飞书渠道同步、`dashboardFetch` 的 token 抓取）仍为 Hermes 私有实现，由前缀中间件按 dashboard.* 能力拦截——拆到 provider 适配器属 M2.1。
- `seed-skills.ts` 技能同步仍写 Hermes 目录格式；`scripts/hermes` 与 docker-compose 的 provider 初始化未动（部署配置归 Codex）。
- `getHermesSessionStats`（直读 state.db）未迁移；openai-compatible 模式下仪表盘会话统计为空值，不报错。
- 能力集仍由 `AGENT_PROVIDER_CAPABILITIES` / `AGENT_PROVIDER_DISABLED_CAPABILITIES` 环境变量静态声明，未做运行时探测（探测式能力发现可在 M2.1 评估）。
