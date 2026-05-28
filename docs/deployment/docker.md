# Docker 部署说明

本文档记录 Crazor 的 Docker Compose 部署方式。当前部署目标是把 Crazor 前端、后端、默认 Agent Provider 和相对数据目录封装成统一的本地协作环境。

## 服务结构

- `crazor-web`：nginx 托管前端静态文件，对外暴露 Web 入口。
- `crazor-server`：Bun + Hono 后端，提供 `/api/*`、`/api/crazor/*` 和 `/mcp/sse`。
- `hermes`：默认 Agent Provider，通过 Compose profile 启动，提供 Agent、模型、技能、记忆和 Dashboard 能力。
- `./data/crazor`：宿主机相对数据目录，挂载到容器内 `/data/crazor`。
- `./data/hermes`：Hermes 运行状态、工作区和备份目录。

Compose 项目名默认是：

```env
COMPOSE_PROJECT_NAME=crazor
COMPOSE_PROFILES=hermes
```

多人在同一台机器或同一开发机上并行启动不同分支时，可以改成自己的名字，避免容器和网络冲突。

浏览器只需要访问 `crazor-web`：

```text
http://localhost:5173
http://局域网IP:5173
```

`crazor-web` 会把以下路径反代到后端：

```text
/api/*   -> crazor-server:3001
/mcp/*   -> crazor-server:3001
```

## 启动

复制环境变量文件：

```bash
cp .env.example .env
```

构建并启动：

```bash
docker compose up -d --build
```

检查容器状态：

```bash
docker compose ps
```

检查健康状态：

```bash
curl -sS http://localhost:5173/api/health
```

运行交付烟测：

```bash
./scripts/hermes smoke
```

烟测会通过 Web 统一入口验证后端健康、Hermes 状态代理、身份 token、客户 Case、文档、附件、渠道、财务流水、项目任务、内容发布、分析概览和审计日志，并在结束后清理临时业务数据。

验证局域网入口：

```bash
CRAZOR_SMOKE_BASE_URL=http://局域网IP:5173 ./scripts/hermes smoke
```

如果临时切换到非 Hermes provider，可跳过 Hermes 状态代理检查：

```bash
CRAZOR_SMOKE_SKIP_HERMES=1 ./scripts/hermes smoke
```

## 写入认证边界

内部演示或单机调试可以保持默认：

```env
CRAZOR_REQUIRE_WRITE_TOKEN=false
```

团队协作环境建议开启：

```env
CRAZOR_REQUIRE_WRITE_TOKEN=true
```

开启后，`/api/crazor/*` 的写入请求和 MCP 写入工具都必须携带有效 API/Agent token。token 的 `scopes` 会决定可执行的动作，例如 `contact:create`、`project:*`、`docs:*`。越权写入会被拒绝，并进入 `audit_logs`。

敏感只读接口默认跟随写入认证边界：当 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 且系统已有 active token 时，`/api/crazor/audit-logs`、`/api/crazor/identity/members`、`/api/crazor/identity/tokens` 也必须携带有权限的 token。需要单独控制时可以设置：

```env
CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN=true
```

业务只读接口默认不强制 token，方便本机初始化和内部演示。团队协作环境如果需要把客户、项目、任务、内容、文档、渠道、财务和分析等业务读取也纳入权限控制，可以开启：

```env
CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=true
```

也可以使用 `CRAZOR_REQUIRE_READ_TOKEN=true` 同时保护敏感只读和业务只读接口。开启后，已有 active token 时，无 token 或无权限 token 的业务读取会被拒绝，并记录 `deny_read` 审计。

首次部署如果还没有 active token，系统仍允许创建第一个团队身份和 token，避免初始化锁死。拿到 token 后，在 Web 的“协作审计 / 当前访问 Token”里启用，后续业务写入会自动带上 `Authorization: Bearer`。

## Docker 代理

在 macOS + OrbStack 环境，如果 Docker Hub 拉取大镜像不稳定，可以同时配置 OrbStack 网络代理和 Docker engine 代理。

当前本机已按下面策略验证并写入：

```text
HTTP Proxy:  http://192.168.103.252:7892
HTTPS Proxy: http://192.168.103.252:7892
并发下载数: 1
```

OrbStack Docker engine 配置文件位置：

```text
~/.orbstack/config/docker.json
```

参考配置：

```json
{
  "max-concurrent-downloads": 1,
  "proxies": {
    "http-proxy": "http://192.168.103.252:7892",
    "https-proxy": "http://192.168.103.252:7892",
    "no-proxy": "localhost,127.0.0.1,::1,host.docker.internal,.local,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"
  }
}
```

修改后需要重启 Docker 环境：

```bash
orb restart docker
```

校验 Docker 是否读取代理：

```bash
docker info
```

如果 `docker pull nousresearch/hermes-agent:main` 仍报 `tls: bad record MAC`，说明代理到镜像大 blob 的链路仍不稳定；这时优先换一个稳定代理出口或使用企业内网镜像仓库缓存 Hermes 镜像。

## 数据目录

Docker 环境固定使用：

```text
./data/crazor/
```

容器内对应：

```text
/data/crazor/
```

该目录会保存：

- `crazor.db`
- `vault/`
- `skills/`

`./data/crazor` 不应提交到 Git。

## Agent Gateway 接入

Hermes 是当前默认 provider，但 Crazor Server 通过通用 `AGENT_*` 配置访问 Agent Gateway：

```env
AGENT_PROVIDER=hermes
AGENT_GATEWAY_URL=http://hermes:8642
AGENT_DASHBOARD_URL=http://hermes:9119
```

首次使用先运行：

```bash
./scripts/hermes init
```

该命令会生成 `AGENT_GATEWAY_API_KEY`，同步兼容变量 `HERMES_API_SERVER_KEY`，创建 `data/hermes` 目录，并写入当前宿主机用户的 UID/GID，避免容器生成 root 权限文件。

Agent Gateway 解耦规范见 [Agent Gateway 解耦规范](../architecture/agent-gateway.md)，Hermes provider 详细说明见 [Hermes Agent 集成说明](hermes-agent.md)。

注意：Hermes Gateway 健康不等于已经能对话。对话还需要在 `.env` 中配置至少一个模型 provider 密钥，例如：

```env
OPENROUTER_API_KEY=请替换为真实密钥
```

未配置时，`/api/chat/completions` 会返回 `No inference provider configured`。

如果要接外部 Agent Gateway，不启动内置 Hermes：

```env
COMPOSE_PROFILES=
AGENT_PROVIDER=custom
AGENT_GATEWAY_URL=http://host.docker.internal:8642
AGENT_DASHBOARD_URL=http://host.docker.internal:9119
AGENT_GATEWAY_API_KEY=请替换为真实密钥
```

MCP 注册地址建议使用 Web 统一入口：

```bash
hermes mcp add crazor --url http://localhost:5173/mcp/sse --transport sse
```

局域网内其他机器使用：

```bash
hermes mcp add crazor --url http://局域网IP:5173/mcp/sse --transport sse
```

## 演示数据策略

默认：

```env
CRAZOR_SEED_DEMO_DATA=false
```

这表示首启只初始化目录和正式模板，不把 `server/data/vault/mock-data` 写入运行数据目录。

只有明确需要演示数据时才改为：

```env
CRAZOR_SEED_DEMO_DATA=true
```

正式团队协作环境必须保持 `false`。
