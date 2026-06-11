# M1 服务端事件总线 + WebSocket 实时推送

> 分支：`feature/m1-event-bus` · 2026-06-11
> 目标：为团队协同界面与 3D 数字员工办公室提供实时数据底座。进程内 pub/sub（单进程 Bun 服务，无外部 MQ），所有事件发射均不影响主业务（emit 永不抛错）。

## 改动总览

| 文件 | 内容 |
|------|------|
| `server/src/services/event-bus.ts` | 新建。进程内 pub/sub + 最近 500 条事件环形缓冲（`since` 游标回放）；`emitEvent` 永不抛错，订阅者回调异常互不影响 |
| `server/src/index.ts` | REST 审计咽喉点（`/api/crazor/*` 中间件）`createAuditLog` 成功后 emit `entity.*`；邀请兑换成功 emit `member.joined`；新增 `/api/events/ws`（createBunWebSocket）与 `GET /api/events/recent`；Presence 在线表 + 心跳；`export default` 增加 `websocket` |
| `server/src/services/crazor-mcp.ts` | `recordMcpAudit` 处 emit `mcp.tool_called`（含 tool name） |
| `server/src/middleware/auth.ts` | `PUBLIC_PATHS` 加入 `/api/events/ws`（升级前由路由 guard 用同一套 JWT 鉴权） |
| `web/src/hooks/useCrazorEvents.js` | 新建。WS 客户端 hook：自动重连（指数退避 1s→30s）、心跳应答，暴露 `{events, online, connected}` |
| `web/src/components/data-view/DataView.jsx` | 唯一前端落地点：订阅本视图实体的 `entity.*` / `mcp.tool_called` 事件，防抖 1s 触发 `reloadAll()`（覆盖任务看板/CRM/项目/交付等所有 DataView 视图） |
| `web/vite.config.js` | dev 代理 `/api` 增加 `ws: true`（仅开发环境，非部署配置） |

## 事件协议

### 事件结构

```jsonc
{
  "id": 1781234567890,          // 单调递增数字（以进程启动时间为种子，重启后不倒退），作为 since 游标
  "ts": "2026-06-11T08:00:00.000Z",
  "type": "entity.created",
  "actor_id": "m-xxxx",          // 成员 id / agent token 对应成员 / "anonymous"
  "actor_name": "张三",          // 登录会话可得；agent/匿名为空
  "actor_type": "human",        // human | agent
  "entity": "task",             // 与审计日志 entity 一致（contact/task/project/...）
  "entity_id": "abc123",
  "summary": "POST /api/crazor/tasks",
  "data": { "action": "create", "source": "login-jwt" }   // 可选附加信息
}
```

### 事件类型

| type | 触发点 | data 附加字段 |
|------|--------|---------------|
| `entity.created` | REST 审计咽喉点，action=create | `action`, `source` |
| `entity.updated` | 同上，action=update/move/publish/update_metrics 等写动作 | `action`, `source` |
| `entity.deleted` | 同上，action=delete | `action`, `source` |
| `mcp.tool_called` | `crazor-mcp.ts` `recordMcpAudit`（仅写类工具，与审计一致） | `tool`, `action`, `source` |
| `member.joined` | `POST /api/auth/invite/redeem` 成功 | `role`, `department` |
| `presence.online` | 某成员首条 WS 连接建立 | `online`（当前在线全量快照） |
| `presence.offline` | 某成员最后一条 WS 连接断开 | `online`（同上） |

`deny_*`（权限拒绝）与读审计不产生事件。

### WS 消息帧

服务端 → 客户端：

```jsonc
{ "type": "hello", "ts": "...", "self": {member_id, name, role},
  "online": [{member_id, name, connected_at, connections}], "recent": [/* 最近 50 条事件 */] }
{ "type": "event", "event": { /* 上述事件结构 */ } }
{ "type": "ping", "ts": "..." }    // 30s 心跳；客户端应回 {"type":"pong"}
{ "type": "pong", "ts": "..." }    // 对客户端主动 ping 的应答
```

客户端 → 服务端：`{"type":"ping"}` / `{"type":"pong"}`（任何消息都会刷新连接活性；连续两轮心跳无消息判定僵尸并断开，code 4000）。

连接 URL 支持 `?since=<id>`：hello 的 `recent` 只回放 id 大于 since 的事件。

## 鉴权方式

- **`/api/events/ws`**：在 `authMiddleware` 的 `PUBLIC_PATHS` 中跳过（浏览器 WebSocket 无法携带 Authorization 头），升级前由路由 guard 调 `resolveEventsWsIdentity` 完成同等鉴权：
  - 凭据来源（优先级）：query `?token=<JWT>` → `Authorization: Bearer <JWT>` → cookie `crazor_token`；
  - JWT 用现有 `verifyJWT` 验证；带 `member_id` 的载荷查 `team_members`，禁用/删除的成员拒绝；旧单人版会话（无 member_id）按 openid/nickname 放行；客户门户会话（portal_mode）拒绝；
  - dev 模式（未配置 `JWT_SECRET`/`WECHAT_APP_ID`/访问码，即 `loginRequiredByEnv()` 为 false）放行为匿名身份；
  - 鉴权失败返回 HTTP 401（不发生升级）。
- **`GET /api/events/recent?since=<id>&limit=<n>`**：正常走 `authMiddleware`，与业务读一致（dev 模式放行；登录后 cookie/Bearer 均可）。返回 `{events, online, latest_id}`，limit 默认 50、上限 500。

## 前端接入

```jsx
import { useCrazorEvents } from "@/hooks/useCrazorEvents"

function MyView() {
  const { events, online, connected } = useCrazorEvents({
    onEvent: (event) => {
      if (event.entity === "task") {
        // 防抖后刷新本地数据
      }
    },
  })
  // online: [{member_id, name, connected_at, connections}]
}
```

- token 自动从 `localStorage.crazor_token` 取出拼到 `?token=`（HttpOnly cookie 场景下同源连接 cookie 也会随升级请求带上）。
- 断线自动重连：指数退避 1s → 2s → … → 30s 封顶，成功后归零。
- `DataView` 已内置订阅：所有基于 `DataView` 的视图（任务看板、CRM、项目、交付、渠道、内容、收支）在其他成员或 Agent 写入对应实体时 1s 防抖自动刷新，无需各视图单独接线。

## 3D 数字员工办公室消费方式（事件 → 动画状态机映射）

办公室场景持有一条 `useCrazorEvents` 连接（或独立 WS 客户端），按下表把事件流翻译成角色动画状态：

| 事件 | 动画状态机输入 | 建议表现 |
|------|----------------|----------|
| `presence.online` | `avatar(actor_id).enter()` | 对应成员角色走进办公室、落座工位 |
| `presence.offline` | `avatar(actor_id).leave()` | 角色起身离开，工位灯熄灭 |
| `member.joined` | `office.spawnAvatar(entity_id)` + 欢迎横幅 | 新角色入场动画 + 公告气泡 |
| `mcp.tool_called` | `agentAvatar(actor_id).work(data.tool)` | 数字员工角色敲键盘/操作终端，头顶气泡显示工具名（如 `create_task`） |
| `entity.created` (entity=task) | `board.addCard(entity_id)` + `avatar(actor_id).work()` | 看板新增卡片飞入，操作者角色做书写动作 |
| `entity.updated` (entity=task, data.action=move) | `board.moveCard(entity_id)` | 卡片在泳道间移动 |
| `entity.created` (entity=transaction) | `office.celebrate()` | 收款彩带/金币动画 |
| `entity.created` (entity=contact/follow_up) | `avatar(actor_id).call()` | 角色拿起电话/会客动作 |
| `entity.deleted` | `board.removeCard(entity_id)` | 卡片碎裂消失 |
| 连接断开（`connected=false`） | `office.pause()` | 场景置灰 + "重连中"提示，重连后用 `?since=` 或 `/api/events/recent` 补帧 |

`actor_type` 区分人类成员与 Agent 角色；`summary` 可直接用于头顶气泡文案。

## 验证清单

```bash
cd server && bun install && bun run dev    # dev 模式（不配 JWT_SECRET 即匿名放行）

# 1. REST 回放接口
curl -s 'http://localhost:3001/api/events/recent' | jq        # {events:[], online:[], latest_id}

# 2. WS 连接（dev 模式无需 token）
npx wscat -c 'ws://localhost:3001/api/events/ws'
#   → 收到 {"type":"hello","self":...,"online":[...],"recent":[...]}
#   → 30s 后收到 {"type":"ping"}，手动发 {"type":"pong"} 保活；不回则约 60s 被断开(4000)

# 3. 触发实体事件（另开终端）
PROJECT_ID=$(curl -s -X POST http://localhost:3001/api/crazor/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"事件总线联调项目"}' | jq -r .id)
curl -s -X POST http://localhost:3001/api/crazor/tasks \
  -H 'Content-Type: application/json' \
  -d "{\"project_id\":\"$PROJECT_ID\",\"title\":\"事件总线联调\"}" | jq .id
#   → wscat 收到 {"type":"event","event":{"type":"entity.created","entity":"task",...}}
#   → curl /api/events/recent?since=<上次latest_id> 能取到同一条

# 4. 鉴权（配置 JWT_SECRET 后重启）
npx wscat -c 'ws://localhost:3001/api/events/ws'               # → 401 拒绝
npx wscat -c "ws://localhost:3001/api/events/ws?token=<登录JWT>" # → hello，且 online 出现该成员
#   再开第二条连接 → 无重复 presence.online；全部断开 → 其他连接收到 presence.offline

# 5. MCP 事件：带 agent token 调 create_contact → 收到 mcp.tool_called（data.tool=create_contact）
# 6. 邀请兑换：POST /api/auth/invite/redeem → 收到 member.joined
# 7. 前端：两个浏览器开同一任务看板，A 创建任务，B 约 1s 后自动刷新出现新卡片
./scripts/hermes smoke && ./scripts/hermes smoke-strict
```

## 已知边界与后续（M1.1+）

- 环形缓冲只在内存（500 条），进程重启丢失；`id` 以启动时间为种子保证不倒退，但重启间隙的事件不可回放——客户端重连后应整页刷新或用 REST 全量拉取兜底。
- 事件不含 payload 明细（与审计日志同口径，只有 entity/entity_id/summary），消费方需要详情时按 `entity_id` 回查业务 API——避免向低权限连接泄露字段级数据。
- WS 推送目前不做按角色/可见性的行级过滤（与 M0 读侧未启用行级过滤保持一致）；启用 `visibility` 行级过滤时需同步在广播处按连接身份过滤。
- 生产部署若经 nginx 反代，需为 `/api/events/ws` 配置 `Upgrade`/`Connection` 头透传（本次未改部署配置）。
- 每个挂载的 `DataView` 各持有一条 WS 连接（同屏通常仅一个视图）；如后续多组件并发消费，可将 hook 升级为模块级共享连接 + 引用计数。
- `mcp.tool_called` 仅覆盖写类工具（与 `deriveMcpAudit` 同口径），读类工具调用不上事件流。
