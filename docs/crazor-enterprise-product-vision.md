# Crazor 企业版产品构想

> 记录时间：2026-05-25
> 状态：构想阶段

## 一句话

把 Crazor 现有的「数据库 + 文档 + MCP」体系独立成产品，让企业里每个员工都能通过各自的 AI Agent 读写统一的数据和文档，实现 AI 驱动的企业协作。

## 核心价值

- **AI-Native 的企业数据平台** — 不是人操作 SaaS，而是 AI Agent 操作数据，人只需要对话
- **统一 MCP 接口** — 不管员工用哪个 AI Agent（Hermes、ChatGPT、Claude、豆包...），都通过同一个 MCP 协议读写
- **动态 Schema** — 不需要开发人员改代码，AI 或管理员随时可以添加字段，前端自动适配
- **结构化 + 非结构化一体** — CRM 数据、交易流水、文档笔记、知识库都在一个体系里

## 现有基础

Crazor 目前已实现：

| 能力 | 实现 |
|------|------|
| 动态 Schema | `field_definitions` 表，AI 可通过 `add_field` 动态加字段 |
| 实体 CRUD | 联系人、渠道、交易、项目、任务、跟进、内容，共 52 个 MCP 工具 |
| 文档体系 | 文档树（notebook + knowledge）+ Markdown + 客户关联 |
| 只读 UI | Schema 驱动，自动生成表格/看板/详情，无需前端改代码 |
| MCP Server | SSE 传输，JSON-RPC 2.0，标准 MCP 协议 |

## 从单用户到企业版需要解决的问题

### 1. 认证与身份

**现状：** 无认证，单个 Agent 连接。

**企业版：**
- 企业 SSO 登录（钉钉/飞书/企业微信 OAuth2）
- 每个 Agent 连接携带 user token
- MCP Gateway 根据 token 识别身份

### 2. 权限控制（RBAC）

**现状：** 无权限，所有工具对所有人开放。

**企业版：**
- 角色定义：管理员、销售、财务、运营、只读...
- 数据级权限：销售只能看自己的客户，财务看全部金额
- 工具级权限：普通员工不能 `add_field`、`delete_contact`
- 权限在 MCP Gateway 层拦截，无权限的工具直接不返回

### 3. 多用户并发

**现状：** SQLite 单文件，单用户写入。

**企业版：**
- 迁移到 PostgreSQL（多连接、行锁、ACID）
- 或 TiDB（分布式，适合大规模）
- Schema 层保持不变，只换存储引擎

### 4. 审计日志

**现状：** 无操作记录。

**企业版：**
- 每次 MCP 调用记录：谁、什么时间、通过哪个 Agent、调了什么工具、改了什么数据
- 审计日志可通过 MCP 查询（管理员专用工具）
- 支持数据回滚

### 5. 多租户

**现状：** 单租户，一套数据。

**企业版：**
- 每个企业一个 workspace（数据隔离）
- workspace 级别的 Schema 自定义
- 超级管理员跨 workspace 管理

## 架构

```
企业员工各自的 AI Agent
（Hermes / ChatGPT / Claude / 豆包 / ...）
          │
          │  MCP 协议（携带 OAuth token）
          ▼
   ┌──────────────────────┐
   │  Crazor MCP Gateway   │  统一入口
   │  ├─ 认证（token 校验） │
   │  ├─ 权限（RBAC 过滤）  │
   │  ├─ 限流               │
   │  └─ 审计（操作日志）    │
   └──────────┬───────────┘
              │
   ┌──────────▼───────────┐
   │  Crazor Data Engine   │  核心引擎
   │  ├─ Dynamic Schema    │
   │  ├─ Entity CRUD       │
   │  ├─ Document Tree     │
   │  ├─ Relation Manager  │
   │  └─ Audit Logger      │
   └──────────┬───────────┘
              │
   ┌──────────▼───────────┐
   │   PostgreSQL          │  持久化
   │   ├─ tenants          │
   │   ├─ users / roles    │
   │   ├─ field_definitions│
   │   ├─ contacts / ...   │
   │   ├─ documents        │
   │   └─ audit_logs       │
   └──────────────────────┘
```

## MCP 接入方式

企业员工在各自的 AI Agent 里配置 MCP 连接：

```json
{
  "mcpServers": {
    "crazor": {
      "url": "https://api.crazor.ai/mcp/sse",
      "headers": {
        "Authorization": "Bearer <企业SSO token>"
      }
    }
  }
}
```

Agent 连接后：
1. Gateway 校验 token，识别用户身份和角色
2. `tools/list` 只返回该用户有权限使用的工具
3. `tools/call` 执行前检查数据权限（行级过滤）
4. 操作记录写入审计日志

## 产品形态

### 开发者/小团队（免费/低价）
- 单租户，SQLite
- 自部署（Docker）
- 不限 Agent 数量
- 当前 Crazor 的能力

### 企业版（SaaS 订阅）
- 多租户，PostgreSQL
- 托管服务
- SSO + RBAC + 审计
- 按席位或按 MCP 调用量计费

## 商业化思路

1. **Crazor Cloud** — SaaS 托管，企业注册即用，员工配置 MCP endpoint 即可
2. **Crazor Enterprise** — 私有部署，企业内网运行，对接内部 SSO
3. **Crazor Engine** — 开源核心，开发者自部署，贡献生态

核心卖点：**企业不需要买 CRM/文档/协作工具，只需要一个 Crazor + 员工各自的 AI Agent。**

## 下一步

- [ ] 产品架构详细设计文档
- [ ] 多用户 PoC（先在现有代码上加 token 认证）
- [ ] PostgreSQL 存储引擎适配
- [ ] RBAC 权限模型设计
- [ ] MCP 多 session 并发测试
