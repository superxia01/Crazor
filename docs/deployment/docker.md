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

烟测会通过 Web 统一入口验证后端健康、Hermes 状态代理、MCP StreamableHTTP、身份 token、客户 Case、文档、附件、渠道、财务流水、项目任务、内容发布、分析概览和审计日志，并在结束后清理临时业务数据。

验证局域网入口：

```bash
CRAZOR_SMOKE_BASE_URL=http://局域网IP:5173 ./scripts/hermes smoke
```

## 客户交付身份

客户安装包会内置客户名和后端地址。正式交付时，后端也要声明同一个客户名，客户端启动自检会核对两边是否一致，避免误连测试环境、旧环境或其他客户环境。

```env
CRAZOR_DELIVERY_CUSTOMER=客户名称
CRAZOR_DELIVERY_CHANNEL=customer
CRAZOR_PUBLIC_BASE_URL=http://局域网IP:5173
CRAZOR_DELIVERY_PROTOCOL_VERSION=1
```

`CRAZOR_PUBLIC_BASE_URL` 会优先用于微信登录回调地址。局域网部署时填客户实际访问的局域网入口；公网部署时填 HTTPS 域名。
`CRAZOR_DELIVERY_PROTOCOL_VERSION` 会同时写入客户安装包和后端自检；版本不一致时客户端会阻止进入系统，避免新客户端连接旧后端。
客户桌面端运行时也会比较安装包内置服务地址和后端声明的 `delivery.public_base_url`；缺失或不一致会停在交付检测页，避免客户包连到错误服务。

构建正式客户安装包前建议启用严格预检，脚本会访问 `${CRAZOR_PUBLIC_BASE_URL}/api/delivery/readiness`，确认客户名、公开地址和交付自检状态匹配后才继续打包：

```bash
./scripts/hermes customer-env "客户名称" "http://局域网IP:5173" .env.customer --force
node scripts/customer-backend-env.mjs --check .env.customer --customer "客户名称" --server-url "http://局域网IP:5173"
docker compose --env-file .env.customer up -d --build
CRAZOR_CUSTOMER_SERVER_PREFLIGHT=strict ./scripts/build-customer.sh "客户名称" "http://局域网IP:5173" current
```

远端 Docker 主机使用统一部署入口，避免手工复制代码和环境文件：

```bash
./scripts/hermes customer-deploy \
  --host wings@100.87.117.18 \
  --ssh-key /Users/hazeapple/codex/.secrets/crazor_backend_deploy_ed25519 \
  --remote-dir /home/wings/docker/crazor \
  --customer CRAZYAIGC \
  --server-url http://100.87.117.18:5173 \
  --skip-live-chat
```

脚本会在远端维护 `releases/`、`current` 和 `shared/data`：代码按 release 发布，`shared/data` 作为 Compose 相对数据目录长期保留，避免部署覆盖客户数据。模型 provider 密钥不会默认上传；需要真实对话验收时显式传入 `--secrets-env-file .env`，脚本只追加白名单内的模型相关变量。

`customer-env` 会生成客户后端专用环境文件，默认开启 `CRAZOR_REQUIRE_WRITE_TOKEN`、`CRAZOR_REQUIRE_BUSINESS_READ_TOKEN`、`CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN`、`CRAZOR_CUSTOMER_SERVER_PREFLIGHT=strict`，生成 `CRAZOR_CUSTOMER_ACCESS_CODE` 客户访问码，生成并同步 `AGENT_GATEWAY_API_KEY` / `HERMES_API_SERVER_KEY`，并写入 Tauri 客户端需要的 CORS 来源。若要在客户现场启用扫码登录，生成时同时传入 `--wechat-app-id` 和 `--wechat-app-secret`；未接微信时，客户可先用访问码登录 Tauri 客户端。

安装包 manifest、客户端设置页和后端交付自检都会展示同一组交付指纹；现场验收时先对照指纹，确认安装包绑定的客户、服务地址和交付协议与后端一致。安装包交付前再用统一验收命令，把安装包 manifest、checksum、客户后端环境、访问码登录、业务上下文和真实对话链路一次性跑通，并生成可归档报告：

```bash
./scripts/hermes handoff-check desktop/src-tauri/target/release/customer-delivery --env-file .env.customer --output handoff.md
```

如果只想模拟客户桌面端连接托管后端，检查健康、交付身份、登录门禁、业务上下文和对话能力入口，也可以单独运行：

```bash
./scripts/hermes desktop-smoke "客户名称" "http://局域网IP:5173"
```

默认会实际调用一次非流式对话并校验返回文本；如果后端启用了访问码登录，可设置 `CRAZOR_DESKTOP_SMOKE_ACCESS_CODE=<访问码>` 让烟测先换取 JWT 再继续验证。模型首响慢时可设置 `CRAZOR_DESKTOP_SMOKE_CHAT_TIMEOUT_MS=60000` 或更高，若只想快速检查入口可设置 `CRAZOR_DESKTOP_SMOKE_SKIP_LIVE_CHAT=1`。

如果通过 GitHub Actions 生成客户包，但后端只在客户局域网内可访问，手动触发工作流时把 `preflight_mode` 设为 `warn` 或 `skip`；如果 runner 能访问客户后端，再设为 `strict`。PR 默认会同时构建 `macos-current` 和 `windows-current` 两个平台；手动触发时可选择单个平台。工作流的 `platform` 会原样写入交付 manifest，用于区分客户实际安装包平台。CI 上传的是 `customer-delivery` 精简目录，只包含安装包、manifest 和 checksum。
CI 会额外执行安装器烟测：macOS runner 校验并挂载 DMG，Windows runner 使用 `msiexec /a` 解包 MSI 并确认可执行文件存在。默认未签名或未公证只作为警告；正式客户交付时手动触发工作流并选择 `installer_trust_mode=require-trusted`，让 macOS Gatekeeper 或 Windows Authenticode 未通过时直接失败。
正式 macOS 交付前，在仓库 Secrets 中配置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`，或配置 App Store Connect API 模式的 `APPLE_API_KEY`、`APPLE_API_ISSUER`、`APPLE_API_KEY_P8`。正式 Windows 交付前，配置 `WINDOWS_CERTIFICATE`、`WINDOWS_CERTIFICATE_PASSWORD`、`WINDOWS_CERTIFICATE_THUMBPRINT`，并按需配置 Variables：`WINDOWS_DIGEST_ALGORITHM`、`WINDOWS_TIMESTAMP_URL`、`TAURI_WINDOWS_SIGNTOOL_PATH`。
下载 artifact 后可再次运行 `node ./scripts/verify-customer-delivery.mjs <artifact目录>`，校验 manifest、checksum、安装包 SHA256 以及目录内是否混入构建辅助文件。
更推荐直接运行 `./scripts/hermes handoff-check <artifact目录> --env-file .env.customer --output handoff.md`，同时复验安装包、后端配置、访问码登录和对话链路。

如果临时切换到非 Hermes provider，可跳过 Hermes 状态代理检查：

```bash
CRAZOR_SMOKE_SKIP_HERMES=1 ./scripts/hermes smoke
```

验证严格认证边界：

```bash
./scripts/hermes smoke-strict
```

该命令会临时以 `CRAZOR_REQUIRE_WRITE_TOKEN=true` 和 `CRAZOR_REQUIRE_BUSINESS_READ_TOKEN=true` 重建后端，运行严格认证烟测，确认匿名业务读取、匿名 REST 写入和匿名 MCP 写入被拒绝；烟测结束后会恢复 Compose 默认后端配置。

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

这表示首启只初始化目录和正式模板，不把 `server/data/vault/mock-data` 或内容作品示例记录写入运行数据目录。

只有明确需要演示数据时才改为：

```env
CRAZOR_SEED_DEMO_DATA=true
```

正式团队协作环境必须保持 `false`。
