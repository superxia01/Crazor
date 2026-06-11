# M0 团队协作改造（单人版 → 团队版）· 第一阶段

> 分支：`feature/m0-team-collaboration` · 2026-06-10
> 目标：同一套部署支持多名成员各自登录使用，所有业务写入可归属到具体成员，写权限按角色（admin/member/viewer）裁决。全部变更向前兼容，未配置成员时行为与单人版完全一致。

## 改动总览

| 文件 | 内容 |
|------|------|
| `services/crazor-db.ts` | 11 张业务表加 `created_by`/`visibility` 列（幂等迁移，默认值兼容）；`team_members` 加 `department`/`avatar_url`/`wechat_openid`；`users` 预留 `member_id`；新增 `invite_codes` 表及 CRUD；`stampEntityOwner()` 归属盖章；`findTeamMemberByOpenid`/`countActiveHumanMembers` |
| `services/crazor-auth.ts` | JWT 载荷扩展 `member_id`/`role`/`department`（可选字段，旧 token 不受影响） |
| `services/crazor-permissions.ts` | 新增 `SESSION_SOURCES`（login-jwt）：带角色的登录会话按 `ROLE_WRITE/READ_SCOPE_POLICIES` 裁决；无角色的旧会话保持全量放行（单人版兼容） |
| `index.ts` | `resolveLoginJwtActor` 解析成员身份（成员被禁用→会话失效）；`resolveRequestActor` 在无 actor token 时回退到登录会话身份；`/api/crazor/*` 中间件新增"会话角色写裁决"与"创建后归属盖章"；新增 `/api/auth/invite/redeem` 与 `/api/crazor/identity/invites` 路由；微信回调自动绑定/创建成员（首位→admin）；`/api/auth/me` 返回 member 信息 |
| `services/crazor-mcp.ts` | `executeTool` 创建类工具执行后按 actor 盖章 `created_by` |

## 新 API

```
POST /api/auth/invite/redeem        # 公开。{code, name} → 创建/复用成员 + 签发带成员身份的 JWT（Set-Cookie）
GET  /api/crazor/identity/invites   # 敏感读（同 members/tokens 门禁）
POST /api/crazor/identity/invites   # identity 写 → 仅 admin。{label?, role?, department?, max_uses?, expires_in_days?}
                                    # 返回的 code 仅此一次明文，库中只存 hash
DELETE /api/crazor/identity/invites/:id   # 撤销
```

`/api/auth/me` 新增 `member: {id, name, role, department} | null`。

## 行为约定

1. **归属**：所有经 REST 中间件或 MCP 工具创建的 contact/transaction/project/task/delivery/follow_up/channel/channel_referral/content_piece/doc_folder/doc_note，`created_by` 自动写入操作者（成员 id），匿名/旧模式写入留空——存量数据不动。
2. **角色**：登录会话写操作按角色裁决：viewer 全拒，member 可写 crm/docs/project/delivery/content，identity（成员/Token/邀请码）仅 admin。actor token 路径维持原 scope 机制不变。
3. **微信登录**：按 openid 绑定成员；无绑定时首位活跃人类成员为 admin，其余为 member。注意：若环境曾用内部演示码登录（会生成"内部演示"成员），首位微信用户会拿到 member——管理员可在协作审计成员页 PATCH 提升。
4. **邀请码登录**：`czr_invite_*` 兑换时按姓名复用同名活跃成员（防重复），次数/有效期/撤销受控。

## 验证清单（Codex/CI 执行）

```bash
cd server && bun install && bun run dev   # 或 docker compose up
# 1. 旧路径零回归：无 JWT_SECRET 时所有 API 行为不变；旧 JWT 会话可正常读写
# 2. 邀请流：POST /api/crazor/identity/invites (admin) → redeem → /api/auth/me 返回 member
# 3. 角色：viewer 兑换后 POST /api/crazor/contacts → 403 role denied + 审计 deny 记录
# 4. 归属：member 会话创建 contact → 表中 created_by = member.id
# 5. MCP：带 agent token 调 create_contact → created_by = token 对应 member id
./scripts/hermes smoke && ./scripts/hermes smoke-strict
```

## 已知边界与后续（M0.1+）

- `visibility` 列已就位但**读侧行级过滤未启用**（本阶段只做归属与写权限）；启用时在 list* 查询按 actor 过滤 private/dept。
- 前端基础入口已接入：登录对话框/登录页支持邀请码加入，协作审计页支持邀请码管理；列表侧 created_by 展示与筛选仍在后续增强。
- `users.member_id` 列已预留未使用（微信绑定走 `team_members.wechat_openid`）。
- 会话（conversations）按成员隔离、记忆分层、PostgreSQL 切换在 M0 后续批次。
