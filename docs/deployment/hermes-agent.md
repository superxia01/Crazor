# Hermes Agent Provider 说明

本文档记录从 `hermes-agent.zip` 整合到 Crazor Docker Compose 后的使用方式。Hermes 是当前默认 Agent Provider，不是 Crazor 的系统内核；后续可以按 [Agent Gateway 解耦规范](../architecture/agent-gateway.md) 替换为其他 provider。

原压缩包是一套独立 Hermes Docker 模板，包含 `compose.yml`、`.env.example`、`scripts/hermes`、`data/`、`workspaces/` 和运维文档。当前项目没有原样复制这套模板，而是把它吸收到 Crazor 的统一 Compose 中。

## 集成后的服务

Compose 中新增服务：

```text
hermes
```

该服务受 Compose profile 控制：

```env
COMPOSE_PROFILES=hermes
```

如果后续接入外部 Agent Gateway，可以清空 `COMPOSE_PROFILES`，只保留 `crazor-server` 和 `crazor-web`。

默认镜像：

```text
nousresearch/hermes-agent:latest
```

默认容器命令：

```text
gateway run
```

Crazor Server 优先通过通用 Agent Gateway 配置访问 Hermes：

```env
AGENT_PROVIDER=hermes
AGENT_GATEWAY_URL=http://hermes:8642
AGENT_DASHBOARD_URL=http://hermes:9119
```

`HERMES_GATEWAY_URL`、`HERMES_DASHBOARD_URL` 和 `HERMES_API_SERVER_KEY` 仍保留为兼容旧配置。

Hermes 新版要求非 loopback Dashboard 绑定必须显式 opt-in。Compose 默认设置 `HERMES_DASHBOARD_INSECURE=1`，但宿主机端口仍绑定 `127.0.0.1`；不要把 `HERMES_DASHBOARD_BIND` 改成 `0.0.0.0`，除非前面有可信认证层。

宿主机默认也可以本机访问：

```text
http://127.0.0.1:8642
http://127.0.0.1:9119
```

默认不把 Hermes 直接暴露到局域网。需要远程访问时，应放在反向代理、VPN、Tailscale 或其他可信访问层之后。

## 数据目录

Hermes 运行数据统一放在项目相对目录：

```text
data/hermes/
├── state/       # Hermes 运行状态、会话、记忆、技能、日志和配置
├── workspaces/  # Hermes 用户工作区
└── backups/     # 本地备份
```

容器内对应：

```text
/opt/data
/opt/workspaces
```

默认用户工作目录：

```text
/opt/workspaces/users/default
```

`data/` 已加入 `.gitignore`，不会提交到仓库。

## 初始化

首次使用先生成 `.env`、Hermes API key 和工作区目录：

```bash
./scripts/hermes init
```

该命令会：

- 如果 `.env` 不存在，从 `.env.example` 创建。
- 自动生成 `AGENT_GATEWAY_API_KEY` 并同步兼容变量 `HERMES_API_SERVER_KEY`。
- 写入当前宿主机用户的 `HERMES_UID` / `HERMES_GID`。
- 创建 `data/hermes/state`、`data/hermes/workspaces` 和 `data/hermes/backups`。

## 启动

启动完整 Crazor + Hermes：

```bash
./scripts/hermes up
```

或直接：

```bash
docker compose up -d --build
```

查看状态：

```bash
./scripts/hermes status
```

查看日志：

```bash
./scripts/hermes logs
```

检查 Hermes 健康状态：

```bash
./scripts/hermes health
```

## 模型 Provider 配置

Hermes Gateway 能启动不代表已经能对话。对话能力还需要至少配置一个真实模型 provider 的密钥。

如果没有配置 provider，`/api/chat/completions` 会返回类似错误：

```text
No inference provider configured. Run 'hermes model' to choose a provider and model, or set an API key (OPENROUTER_API_KEY, OPENAI_API_KEY, etc.) in ~/.hermes/.env.
```

Docker 部署中，模型密钥统一写在项目 `.env`，Compose 会转发给 `hermes` 容器。MVP 推荐先配置 OpenRouter：

```env
OPENROUTER_API_KEY=请替换为真实密钥
```

然后重启 Hermes：

```bash
docker compose up -d --force-recreate hermes
```

如果要使用 Gemini：

```env
GEMINI_API_KEY=请替换为真实密钥
```

如果要使用 OpenAI 兼容网关：

```env
OPENAI_API_KEY=请替换为真实密钥
OPENAI_BASE_URL=https://你的兼容网关/v1
```

密钥不要提交到 Git。`.env` 已被 `.gitignore` 忽略。

## Crazor 与 Hermes 的关系

- `crazor-web` 是团队统一入口。
- `crazor-server` 提供 Crazor API，并代理 Hermes Gateway 与 Dashboard。
- `hermes` 作为默认 Agent Provider，负责 Agent Gateway、模型调用、技能、记忆、定时任务和 MCP/工具执行。
- Crazor 会挂载 `data/hermes/state`，用于同步 Hermes Skills 并读取 `state.db` 会话统计。

## MCP 地址

Hermes 访问 Crazor MCP Server 时，推荐注册统一 Web 入口：

```bash
hermes mcp add crazor --url http://crazor-web/mcp/sse --transport sse
```

如果从宿主机 Hermes CLI 注册：

```bash
hermes mcp add crazor --url http://localhost:5173/mcp/sse --transport sse
```

如果从局域网其他机器注册：

```bash
hermes mcp add crazor --url http://局域网IP:5173/mcp/sse --transport sse
```

## 备份

备份 Hermes state：

```bash
./scripts/hermes backup
```

备份文件会写入：

```text
data/hermes/backups/
```

## 密钥轮换

重新生成 Hermes API key：

```bash
./scripts/hermes regen-api-key
docker compose up -d --force-recreate hermes crazor-server
```

不要把 `.env` 或生成的 API key 提交到仓库。
