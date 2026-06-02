// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const buildCustomerScript = readFileSync(resolve(repoRoot, "scripts/build-customer.sh"), "utf8")
const hermesScript = readFileSync(resolve(repoRoot, "scripts/hermes"), "utf8")
const customerDesktopSmokeScript = readFileSync(resolve(repoRoot, "scripts/customer-desktop-smoke.mjs"), "utf8")
const customerHandoffCheckScript = readFileSync(resolve(repoRoot, "scripts/customer-handoff-check.mjs"), "utf8")
const customerBackendDeployScript = readFileSync(resolve(repoRoot, "scripts/deploy-customer-backend.sh"), "utf8")
const verifyCustomerServerScript = readFileSync(resolve(repoRoot, "scripts/verify-customer-server.mjs"), "utf8")
const verifyCustomerDeliveryScript = readFileSync(resolve(repoRoot, "scripts/verify-customer-delivery.mjs"), "utf8")
const verifyCustomerInstallerScript = readFileSync(resolve(repoRoot, "scripts/verify-customer-installer.mjs"), "utf8")
const customerBackendEnvScript = readFileSync(resolve(repoRoot, "scripts/customer-backend-env.mjs"), "utf8")
const webPackage = readFileSync(resolve(repoRoot, "web/package.json"), "utf8")
const desktopPackage = readFileSync(resolve(repoRoot, "desktop/package.json"), "utf8")
const appSource = readFileSync(resolve(repoRoot, "web/src/App.jsx"), "utf8")
const appInnerSource = readFileSync(resolve(repoRoot, "web/src/AppInner.jsx"), "utf8")
const authFetchSource = readFileSync(resolve(repoRoot, "web/src/api/crazor-auth.js"), "utf8")
const loginTokenRedirectSource = readFileSync(resolve(repoRoot, "web/src/api/login-token-redirect.js"), "utf8")
const customerDeliverySource = readFileSync(resolve(repoRoot, "web/src/api/customer-delivery.js"), "utf8")
const deliveryIdentitySource = readFileSync(resolve(repoRoot, "web/src/api/delivery-identity.js"), "utf8")
const customerDeliveryGateSource = readFileSync(resolve(repoRoot, "web/src/CustomerDeliveryGate.jsx"), "utf8")
const remoteApiSource = readFileSync(resolve(repoRoot, "web/src/api/remote-api-base.js"), "utf8")
const settingsModalSource = readFileSync(resolve(repoRoot, "web/src/SettingsModal.jsx"), "utf8")
const loginDialogSource = readFileSync(resolve(repoRoot, "web/src/components/LoginDialog.jsx"), "utf8")
const loginPageSource = readFileSync(resolve(repoRoot, "web/src/pages/LoginPage.jsx"), "utf8")
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const serverAuthSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-auth.ts"), "utf8")
const authMiddlewareSource = readFileSync(resolve(repoRoot, "server/src/middleware/auth.ts"), "utf8")
const composeSource = readFileSync(resolve(repoRoot, "docker-compose.yml"), "utf8")
const customerWorkflowSource = readFileSync(resolve(repoRoot, ".github/workflows/customer-desktop.yml"), "utf8")

test("customer desktop build embeds the configured backend API base", () => {
  assert.ok(
    webPackage.includes('"build:tauri": "vite build --mode tauri"') &&
      desktopPackage.includes("npm run build:tauri"),
    "Tauri packaging should build the frontend in tauri mode"
  )
  assert.ok(
    buildCustomerScript.includes('write_web_env "VITE_API_BASE" "$SERVER_URL"') &&
      buildCustomerScript.includes('write_web_env "VITE_CRAZOR_CUSTOMER_NAME" "$CUSTOMER"') &&
      buildCustomerScript.includes('write_web_env "VITE_CRAZOR_DELIVERY_CHANNEL" "customer"') &&
      buildCustomerScript.includes('write_web_env "VITE_CRAZOR_DELIVERY_PROTOCOL_VERSION" "$DELIVERY_PROTOCOL_VERSION"') &&
      buildCustomerScript.includes('write_web_env "VITE_CRAZOR_DELIVERY_FINGERPRINT" "$DELIVERY_IDENTITY_FINGERPRINT"') &&
      buildCustomerScript.includes('write_web_env "VITE_CRAZOR_BUILD_SHA" "$BUILD_SHA"') &&
      buildCustomerScript.includes('write_web_env "VITE_CRAZOR_BUILD_TIME" "$BUILD_TIME"') &&
      buildCustomerScript.includes("npm run build:tauri") &&
      buildCustomerScript.includes('grep -R -F "$SERVER_URL" "$PROJECT_ROOT/web/dist"') &&
      buildCustomerScript.includes('grep -R -F "$CUSTOMER" "$PROJECT_ROOT/web/dist"') &&
      buildCustomerScript.includes("verify-customer-server.mjs") &&
      buildCustomerScript.includes("CRAZOR_CUSTOMER_SERVER_PREFLIGHT") &&
      buildCustomerScript.includes("CRAZOR_DELIVERY_PROTOCOL_VERSION") &&
      buildCustomerScript.includes("--env-file") &&
      buildCustomerScript.includes("CRAZOR_PUBLIC_BASE_URL") &&
      buildCustomerScript.includes("customer-backend-env.mjs") &&
      buildCustomerScript.includes("--dry-run") &&
      buildCustomerScript.includes("NORMALIZED_SERVER_URL") &&
      buildCustomerScript.includes("new URL(text)") &&
      buildCustomerScript.includes("有效地址") &&
      buildCustomerScript.includes("macos-current") &&
      buildCustomerScript.includes("windows-current") &&
      buildCustomerScript.includes("require_current_platform_host") &&
      buildCustomerScript.includes("deliveryProtocolVersion") &&
      buildCustomerScript.includes("deliveryIdentityFingerprint") &&
      buildCustomerScript.includes("DELIVERY_IDENTITY_FINGERPRINT") &&
      buildCustomerScript.includes("CRAZOR_DELIVERY_IDENTITY_FINGERPRINT") &&
      buildCustomerScript.includes("SERVER_PREFLIGHT_RESULT") &&
      buildCustomerScript.includes("serverPreflight") &&
      buildCustomerScript.includes("DELIVERY_DIR") &&
      buildCustomerScript.includes("customer-delivery") &&
      buildCustomerScript.includes("crazor-start-here.md") &&
      buildCustomerScript.includes("verify-customer-delivery.mjs") &&
      !buildCustomerScript.includes("__CUSTOMER_SERVER_URL__"),
    "customer build should write package env before packaging, preflight the hosted backend, and verify backend/customer identity is embedded"
  )
  assert.ok(
    buildCustomerScript.includes("command -v cargo") &&
      buildCustomerScript.includes("未找到 cargo") &&
      buildCustomerScript.indexOf("command -v cargo") < buildCustomerScript.indexOf("npm run build:tauri"),
    "customer build should fail fast when the Tauri Rust toolchain is missing"
  )
})

test("customer package build can strictly preflight the hosted backend before handoff", () => {
  assert.ok(
    verifyCustomerServerScript.includes("verifyCustomerServer") &&
      verifyCustomerServerScript.includes("/api/delivery/readiness") &&
      verifyCustomerServerScript.includes("CRAZOR_DELIVERY_CUSTOMER") &&
      verifyCustomerServerScript.includes("CRAZOR_PUBLIC_BASE_URL") &&
      verifyCustomerServerScript.includes("delivery.protocol_version") &&
      verifyCustomerServerScript.includes("CRAZOR_DELIVERY_IDENTITY_FINGERPRINT") &&
      verifyCustomerServerScript.includes("delivery.identity_fingerprint") &&
      verifyCustomerServerScript.includes("托管后端交付自检状态为 blocked"),
    "customer server preflight should verify readiness, delivery identity, and public URL before packaging"
  )
  assert.ok(
    customerWorkflowSource.includes("CRAZOR_CUSTOMER_SERVER_PREFLIGHT") &&
      customerWorkflowSource.includes("workflow_dispatch") &&
      customerWorkflowSource.includes("preflight_mode") &&
      customerWorkflowSource.includes("inputs.preflight_mode") &&
      customerWorkflowSource.includes("delivery_protocol_version") &&
      customerWorkflowSource.includes("inputs.delivery_protocol_version") &&
      customerWorkflowSource.includes("handoff_mode") &&
      customerWorkflowSource.includes("inputs.handoff_mode") &&
      customerWorkflowSource.includes("CRAZOR_DELIVERY_PROTOCOL_VERSION") &&
      customerWorkflowSource.includes("CUSTOMER_HANDOFF_MODE") &&
      customerWorkflowSource.includes("PACKAGE_PLATFORM") &&
      customerWorkflowSource.includes('"$PACKAGE_PLATFORM"') &&
      customerWorkflowSource.includes("customer-delivery") &&
      customerWorkflowSource.includes("verify-customer-delivery.mjs") &&
      customerWorkflowSource.includes("验证客户交付验收入口") &&
      customerWorkflowSource.includes("bash ./scripts/hermes handoff-check") &&
      customerWorkflowSource.includes("HANDOFF_ARGS") &&
      customerWorkflowSource.includes("--skip-live") &&
      customerWorkflowSource.includes("--skip-live-chat") &&
      customerWorkflowSource.includes("--output desktop/src-tauri/target/release/customer-delivery/crazor-handoff-report.md") &&
      customerWorkflowSource.includes("--json") &&
      customerWorkflowSource.includes("CRAZOR_CUSTOMER_ACCESS_CODE") &&
      customerWorkflowSource.includes("CRAZOR_CUSTOMER_LOGIN_TOKEN") &&
      customerWorkflowSource.includes("strict") &&
      customerWorkflowSource.includes("skip"),
    "manual customer package builds should let operators choose preflight behavior and delivery protocol version"
  )
  assert.ok(
    hermesScript.includes("customer-env") &&
      hermesScript.includes("customer-build") &&
      hermesScript.includes('build-customer.sh" --env-file') &&
      customerBackendEnvScript.includes("buildCustomerBackendEnv") &&
      customerBackendEnvScript.includes("CRAZOR_CUSTOMER_SERVER_PREFLIGHT") &&
      customerBackendEnvScript.includes("CRAZOR_CUSTOMER_ACCESS_CODE") &&
      customerBackendEnvScript.includes("AGENT_GATEWAY_API_KEY") &&
      customerBackendEnvScript.includes("HERMES_API_SERVER_KEY") &&
      customerBackendEnvScript.includes("CRAZOR_REQUIRE_BUSINESS_READ_TOKEN") &&
      customerBackendEnvScript.includes("WECHAT_APP_ID") &&
      customerBackendEnvScript.includes("CORS_ORIGINS") &&
      customerBackendEnvScript.includes("--check") &&
      customerBackendEnvScript.includes("docker compose --env-file <环境文件> up -d --build"),
    "operators should have a scripted way to generate a customer backend env file before building the desktop package"
  )
})

test("customer backend can be deployed to a remote Docker host with preserved data", () => {
  assert.ok(
    hermesScript.includes("customer-deploy") &&
      hermesScript.includes("deploy-customer-backend.sh"),
    "Hermes helper should expose a fixed customer backend deployment entrypoint"
  )
  assert.ok(
    customerBackendDeployScript.includes("--remote-dir") &&
      customerBackendDeployScript.includes("/home/wings/docker/crazor") &&
      customerBackendDeployScript.includes("releases") &&
      customerBackendDeployScript.includes("current") &&
      customerBackendDeployScript.includes("shared/data") &&
      customerBackendDeployScript.includes("docker compose --env-file .env.customer up -d --build") &&
      customerBackendDeployScript.includes("customer-backend-env.mjs") &&
      customerBackendDeployScript.includes("customer-desktop-smoke.mjs") &&
      customerBackendDeployScript.includes("CRAZOR_DESKTOP_SMOKE_ACCESS_CODE") &&
      customerBackendDeployScript.includes("--diagnose-only") &&
      customerBackendDeployScript.includes("run_remote_diagnostics") &&
      customerBackendDeployScript.includes("wait_for_delivery_readiness") &&
      customerBackendDeployScript.includes("require_live_chat_model_connection") &&
      customerBackendDeployScript.includes("is_model_api_key_name") &&
      customerBackendDeployScript.includes("is_local_model_base_url") &&
      customerBackendDeployScript.includes('SKIP_LIVE_CHAT" != "1"') &&
      customerBackendDeployScript.includes("真实对话模型连接预检通过") &&
      customerBackendDeployScript.includes("Provider API Key/token") &&
      customerBackendDeployScript.includes("/api/delivery/readiness") &&
      customerBackendDeployScript.includes("summarizeIssues") &&
      customerBackendDeployScript.includes("check.status === \"error\"") &&
      customerBackendDeployScript.includes("[\"ready\", \"degraded\"].includes(status)") &&
      customerBackendDeployScript.includes("crazor-server -> hermes:8642") &&
      customerBackendDeployScript.includes("--secrets-env-file") &&
      customerBackendDeployScript.includes("OPENROUTER_API_KEY") &&
      customerBackendDeployScript.includes("ANTHROPIC_API_KEY") &&
      customerBackendDeployScript.includes("DASHSCOPE_API_KEY") &&
      customerBackendDeployScript.includes("DEEPSEEK_API_KEY") &&
      customerBackendDeployScript.includes("XAI_API_KEY") &&
      customerBackendDeployScript.includes("STEPFUN_API_KEY"),
    "Remote deployment should upload code, preserve relative data, preflight live-chat model secrets, start Compose, run desktop smoke, and expose remote diagnostics"
  )
  assert.ok(
    customerBackendDeployScript.includes("ARCHIVE_ENTRIES") &&
      customerBackendDeployScript.includes("docker-compose.yml") &&
      customerBackendDeployScript.includes("docker") &&
      customerBackendDeployScript.includes("server") &&
      customerBackendDeployScript.includes("web") &&
      customerBackendDeployScript.includes("scripts") &&
      customerBackendDeployScript.includes("web/src/components/office/data/officeLayout.js") &&
      !customerBackendDeployScript.includes("--exclude='./data'") &&
      !customerBackendDeployScript.includes(" -C \"$PROJECT_ROOT\" . |"),
    "Remote deployment archive should use a curated source list so runtime data is not uploaded and source data folders are preserved"
  )
})

test("Tauri remote API requests preserve customer login and actor tokens", () => {
  assert.ok(
    authFetchSource.includes('LOGIN_TOKEN_STORAGE_KEY = "crazor_token"') &&
      authFetchSource.includes('headers.set("Authorization", `Bearer ${loginToken}`)'),
    "direct fetch calls should attach the customer login JWT"
  )
  assert.ok(
    authFetchSource.includes('ACTOR_TOKEN_STORAGE_KEY = "crazor.actorToken"') &&
      authFetchSource.includes('headers.set("X-Crazor-Token", actorToken)'),
    "internal API/Agent scope tokens should use X-Crazor-Token"
  )
  assert.ok(
    serverIndex.includes("const scopedToken = String(c.req.header('X-Crazor-Token')") &&
      serverIndex.includes("return bearer.startsWith('czr_') ? bearer : ''"),
    "server should not confuse customer JWT Authorization with Crazor actor tokens"
  )
})

test("desktop client exposes the configured backend for delivery verification", () => {
  assert.ok(
    remoteApiSource.includes("getRemoteApiRuntimeInfo") &&
      remoteApiSource.includes("checkRemoteApiHealth") &&
      remoteApiSource.includes('url.protocol !== "http:"') &&
      remoteApiSource.includes('url.protocol !== "https:"') &&
      remoteApiSource.includes('buildRemoteApiUrl("/api/health"'),
    "desktop client should expose the embedded backend URL and health endpoint"
  )
  assert.ok(
    customerDeliverySource.includes("getCustomerDeliveryRuntimeInfo") &&
      customerDeliverySource.includes("VITE_CRAZOR_CUSTOMER_NAME") &&
      customerDeliverySource.includes("VITE_CRAZOR_DELIVERY_CHANNEL") &&
      customerDeliverySource.includes("VITE_CRAZOR_DELIVERY_PROTOCOL_VERSION") &&
      customerDeliverySource.includes("VITE_CRAZOR_DELIVERY_FINGERPRINT") &&
      customerDeliverySource.includes("VITE_CRAZOR_BUILD_SHA") &&
      customerDeliverySource.includes("VITE_CRAZOR_BUILD_TIME"),
    "desktop client should expose packaged customer identity from build-time env"
  )
  assert.ok(
    settingsModalSource.includes("客户端后端") &&
      settingsModalSource.includes("检测后端") &&
      settingsModalSource.includes("交付自检") &&
      settingsModalSource.includes("运行自检") &&
      settingsModalSource.includes("交付客户") &&
      settingsModalSource.includes("交付协议") &&
      settingsModalSource.includes("交付指纹") &&
      settingsModalSource.includes("deliveryInfo.protocolVersion") &&
      settingsModalSource.includes("deliveryInfo.deliveryFingerprint") &&
      settingsModalSource.includes("客户包") &&
      settingsModalSource.includes("远程服务") &&
      settingsModalSource.includes("同源服务") &&
      settingsModalSource.includes("构建版本") &&
      settingsModalSource.includes("构建时间") &&
      settingsModalSource.includes("isCustomerDeliveryMode") &&
      settingsModalSource.includes("客户交付模式") &&
      settingsModalSource.includes("本机端口控制") &&
      settingsModalSource.includes("{!isCustomerDeliveryMode && (") &&
      settingsModalSource.includes("nextCustomerDeliveryMode"),
    "settings connection panel should let operators verify the packaged client backend target"
  )
})

test("customer desktop blocks startup when the hosted backend is unavailable", () => {
  assert.ok(
    appSource.includes("CustomerDeliveryGate") &&
      appSource.indexOf("<CustomerDeliveryGate>") < appSource.indexOf("<AppInner"),
    "desktop app should check customer delivery readiness before entering the main workspace"
  )
  assert.ok(
    customerDeliveryGateSource.includes("getRemoteApiRuntimeInfo") &&
      customerDeliveryGateSource.includes("getCustomerDeliveryRuntimeInfo") &&
      customerDeliveryGateSource.includes("checkDeliveryReadiness") &&
      customerDeliveryGateSource.includes("evaluateDeliveryIdentity") &&
      customerDeliveryGateSource.includes("readiness?.status === \"blocked\"") &&
      customerDeliveryGateSource.includes("identity.status === \"error\"") &&
      customerDeliveryGateSource.includes("托管服务身份不匹配") &&
      customerDeliveryGateSource.includes("无法连接托管服务") &&
      customerDeliveryGateSource.includes("交付协议") &&
      customerDeliveryGateSource.includes("runtime.deliveryInfo.protocolVersion") &&
      customerDeliveryGateSource.includes("交付指纹") &&
      customerDeliveryGateSource.includes("runtime.deliveryInfo.deliveryFingerprint") &&
      customerDeliveryGateSource.includes("构建版本") &&
      customerDeliveryGateSource.includes("构建时间") &&
      customerDeliveryGateSource.includes("重新检测"),
    "customer delivery gate should block unreachable or blocked hosted services and offer retry"
  )
})

test("backend exposes a public delivery readiness self-check for installed clients", () => {
  assert.ok(
    serverIndex.includes("app.get('/api/delivery/readiness'") &&
      serverIndex.includes("buildDeliveryReadiness") &&
      serverIndex.includes("'delivery-identity'") &&
      serverIndex.includes("'agent-gateway'") &&
      serverIndex.includes("'chat-api'") &&
      serverIndex.includes("'model-config'") &&
      serverIndex.includes("'business-data'") &&
      serverIndex.includes("'knowledge-vault'"),
    "backend should expose a public readiness endpoint covering the delivery-critical chain"
  )
  assert.ok(
    serverIndex.includes("readModelConfigReadiness") &&
      serverIndex.includes("readGatewayModelListReadiness") &&
      serverIndex.includes("firstGatewayModelId") &&
      serverIndex.includes("gatewayFetch('/v1/models')") &&
      serverIndex.includes("isLocalModelBaseUrl") &&
      serverIndex.includes("apiKeySet") &&
      serverIndex.includes("Base URL"),
    "delivery readiness should validate model configuration through Dashboard or fall back to Gateway models before customer handoff"
  )
  assert.ok(
    serverIndex.includes("CRAZOR_DELIVERY_CUSTOMER") &&
      serverIndex.includes("CRAZOR_PUBLIC_BASE_URL") &&
      serverIndex.includes("CRAZOR_DELIVERY_PROTOCOL_VERSION") &&
      serverIndex.includes("deliveryCustomerName") &&
      serverIndex.includes("public_base_url") &&
      serverIndex.includes("protocol_version") &&
      serverIndex.includes("identity_fingerprint") &&
      serverIndex.includes("deliveryIdentityFingerprint") &&
      serverIndex.includes("backendOrigin(c)") &&
      serverIndex.includes("publicBaseUrl() || new URL(c.req.url).origin"),
    "backend readiness and WeChat callback should expose the hosted delivery identity and public base URL"
  )
  assert.ok(
    deliveryIdentitySource.includes("evaluateDeliveryIdentity") &&
      deliveryIdentitySource.includes("托管服务未声明交付客户") &&
      deliveryIdentitySource.includes("托管服务声明为") &&
      deliveryIdentitySource.includes("交付协议") &&
      deliveryIdentitySource.includes("未声明公开地址") &&
      deliveryIdentitySource.includes("托管服务公开地址为") &&
      deliveryIdentitySource.includes("交付指纹"),
    "customer desktop should reject a hosted backend whose delivery identity, public URL, or protocol version does not match the embedded customer package"
  )
  assert.ok(
    authMiddlewareSource.includes("'/api/delivery/'"),
    "delivery readiness endpoint should remain callable before customer login"
  )
})

test("desktop WeChat login uses backend callback plus client polling", () => {
  assert.ok(
    serverIndex.includes("wechatLoginSessions") &&
      serverIndex.includes("app.get('/api/auth/wechat/session/:state'") &&
      serverIndex.includes("const redirectUri = `${backendOrigin(c)}/api/auth/wechat/callback`") &&
      serverIndex.includes("WECHAT_APP_ID && WECHAT_APP_SECRET"),
    "backend should keep a state-bound desktop login session"
  )
  assert.ok(
    loginDialogSource.includes("/api/auth/wechat/session/") &&
      loginDialogSource.includes("localStorage.setItem('crazor_token', data.token)"),
    "desktop client should poll the backend login session and store the returned JWT"
  )
  assert.ok(
    loginDialogSource.includes("/api/auth/access-code") &&
      loginDialogSource.includes("status.accessCodeConfigured") &&
      loginDialogSource.includes("使用访问码登录") &&
      loginDialogSource.includes("请输入客户访问码") &&
      appInnerSource.includes("客户登录") &&
      !appInnerSource.includes("微信扫码登录"),
    "desktop login dialog should also support access-code customer handoff instead of assuming WeChat-only login"
  )
})

test("customer desktop requires login before entering workspace when backend enforces auth", () => {
  assert.ok(
    serverIndex.includes("app.get('/api/auth/status'") &&
      serverIndex.includes("app.post('/api/auth/access-code'") &&
      serverIndex.includes("loginRequired") &&
      serverIndex.includes("loginRequiredByEnv") &&
      serverIndex.includes("accessCodeConfigured") &&
      serverIndex.includes("Boolean(process.env.JWT_SECRET || process.env.WECHAT_APP_ID || process.env.CRAZOR_CUSTOMER_ACCESS_CODE)"),
    "backend auth status should tell packaged clients whether login is required"
  )
  assert.ok(
    appSource.includes("LoginPage") &&
      appSource.includes("authStatus") &&
      appSource.includes("authStatus?.loginRequired") &&
      appSource.includes("showLoginGate") &&
      appSource.includes("allowSkip={false}") &&
      appSource.indexOf("showLoginGate ?") < appSource.indexOf("<AppInner"),
    "desktop app should show an enforced login gate before rendering the workspace"
  )
  assert.ok(
    loginPageSource.includes("allowSkip = true") &&
      loginPageSource.includes("!loading && allowSkip") &&
      loginPageSource.includes("/api/auth/access-code") &&
      loginPageSource.includes("status.accessCodeConfigured") &&
      loginPageSource.includes("CRAZOR_CUSTOMER_ACCESS_CODE"),
    "login page should keep dev skip optional but expose customer access-code login for auth-gated clients"
  )
  assert.ok(
    appSource.includes("consumeLoginTokenFromLocation") &&
      loginPageSource.includes("consumeLoginTokenFromLocation") &&
      loginTokenRedirectSource.includes("params.delete(\"token\")") &&
      loginTokenRedirectSource.includes("location.pathname || \"/\"") &&
      loginTokenRedirectSource.includes("location.hash || \"\"") &&
      !appSource.includes("replaceState({}, '', '/')") &&
      !loginPageSource.includes("replaceState({}, '', '/')"),
    "login callback should remove token without leaving a customer's path-prefixed web entrypoint"
  )
})

test("customer MCP endpoint is gated by login or Agent token when auth is enabled", () => {
  assert.ok(
    serverIndex.includes("function requireMcpClientAuth") &&
      serverIndex.includes("mcp_auth_required") &&
      serverIndex.includes("resolveActorToken(actorToken)") &&
      serverIndex.includes("resolveLoginJwtActor(c)") &&
      serverIndex.includes("loginRequiredByEnv()"),
    "MCP should have an explicit auth gate because it is intentionally outside the generic auth middleware"
  )
  assert.ok(
    serverIndex.includes("app.post('/mcp'") &&
      serverIndex.includes("const denied = requireMcpClientAuth(c)") &&
      serverIndex.includes("if (denied) return denied") &&
      serverIndex.includes("app.get('/mcp/sse'") &&
      serverIndex.includes("app.delete('/mcp'"),
    "all MCP transports should reject anonymous access before parsing or executing requests"
  )
  assert.ok(
    serverIndex.includes("source: 'login-jwt'") &&
      serverIndex.includes("actor_type: 'human'") &&
      serverIndex.includes("resolveMcpRequestActor"),
    "logged-in desktop users should be represented in MCP audit context instead of anonymous mcp-client"
  )
})

test("docker customer backend receives hosted login and plan configuration", () => {
  assert.ok(
    composeSource.includes("JWT_SECRET: ${JWT_SECRET:-}") &&
      composeSource.includes("CRAZOR_CUSTOMER_ACCESS_CODE: ${CRAZOR_CUSTOMER_ACCESS_CODE:-}") &&
      composeSource.includes("WECHAT_APP_ID: ${WECHAT_APP_ID:-}") &&
      composeSource.includes("WECHAT_APP_SECRET: ${WECHAT_APP_SECRET:-}") &&
      composeSource.includes("DEPLOYMENT_TIER: ${DEPLOYMENT_TIER:-free}") &&
      composeSource.includes("CRAZOR_DELIVERY_CUSTOMER: ${CRAZOR_DELIVERY_CUSTOMER:-}") &&
      composeSource.includes("CRAZOR_PUBLIC_BASE_URL: ${CRAZOR_PUBLIC_BASE_URL:-}") &&
      composeSource.includes("CRAZOR_DELIVERY_PROTOCOL_VERSION: ${CRAZOR_DELIVERY_PROTOCOL_VERSION:-1}") &&
      composeSource.includes("HERMES_DASHBOARD_INSECURE: ${HERMES_DASHBOARD_INSECURE:-1}") &&
      composeSource.includes("${HERMES_DASHBOARD_BIND:-127.0.0.1}:9119:9119") &&
      composeSource.includes("HERMES_WORKSPACE_ROOT:-/opt/workspaces") &&
      composeSource.includes("HERMES_USER_WORKDIR:-/opt/workspaces/users/default") &&
      composeSource.includes("./data/hermes/workspaces:/opt/workspaces") &&
      !composeSource.includes("./data/hermes/workspaces:/opt/data/workspaces"),
    "Compose backend should receive customer login, plan, and delivery identity env vars instead of silently running without them"
  )
})

test("customer login JWT signing uses stable server crypto", () => {
  assert.ok(
    serverAuthSource.includes("createHmac") &&
      serverAuthSource.includes("createHmac('sha256', JWT_SECRET)") &&
      serverAuthSource.includes(".digest()"),
    "JWT signing should use standard HMAC instead of runtime-specific WebCrypto constructors"
  )
  assert.ok(
    !serverAuthSource.includes("new Bun.CryptoKey") &&
      !serverAuthSource.includes("signSync"),
    "JWT signing should not depend on non-portable Bun CryptoKey/signSync behavior"
  )
})

test("docker backend keeps Tauri client origins in CORS defaults", () => {
  assert.ok(
    composeSource.includes("CORS_ORIGINS:") &&
      composeSource.includes("tauri://localhost") &&
      composeSource.includes("http://tauri.localhost") &&
      composeSource.includes("https://tauri.localhost"),
    "Compose backend should allow packaged Tauri clients to call the configured service"
  )
})

test("customer desktop package can be built by CI with configured backend", () => {
  assert.ok(
    customerWorkflowSource.includes("workflow_dispatch") &&
      customerWorkflowSource.includes("pull_request") &&
      customerWorkflowSource.includes("server_url") &&
      customerWorkflowSource.includes("macos-current") &&
      customerWorkflowSource.includes("windows-current") &&
      customerWorkflowSource.includes("strategy:") &&
      customerWorkflowSource.includes("fail-fast: false") &&
      customerWorkflowSource.includes("matrix:") &&
      customerWorkflowSource.includes("fromJSON") &&
      customerWorkflowSource.includes("macos-latest") &&
      customerWorkflowSource.includes("windows-latest") &&
      customerWorkflowSource.includes("matrix.runner") &&
      customerWorkflowSource.includes("matrix.platform") &&
      customerWorkflowSource.includes("PACKAGE_PLATFORM") &&
      customerWorkflowSource.includes("delivery_protocol_version") &&
      customerWorkflowSource.includes("online-entrypoints") &&
      customerWorkflowSource.includes("online-chat") &&
      customerWorkflowSource.includes("installer_trust_mode") &&
      customerWorkflowSource.includes("require-trusted") &&
      customerWorkflowSource.includes("CRAZOR_REQUIRE_INSTALLER_TRUST") &&
      customerWorkflowSource.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24") &&
      customerWorkflowSource.includes("actions/checkout@v6.0.2") &&
      customerWorkflowSource.includes("actions/setup-node@v6.4.0") &&
      customerWorkflowSource.includes("actions/upload-artifact@v7.0.1") &&
      customerWorkflowSource.includes("crazor-desktop-${{ env.PACKAGE_PLATFORM }}-${{ github.run_id }}") &&
      customerWorkflowSource.includes("desktop/src-tauri/target/release/customer-delivery/**/*") &&
      customerWorkflowSource.includes("验证客户交付包") &&
      customerWorkflowSource.includes("验证安装包可安装性") &&
      customerWorkflowSource.includes("验证客户交付验收入口") &&
      customerWorkflowSource.includes("验证最终交付目录") &&
      customerWorkflowSource.includes("crazor-handoff-report.md") &&
      customerWorkflowSource.includes("--output desktop/src-tauri/target/release/customer-delivery/crazor-handoff-report.md") &&
      customerWorkflowSource.includes("准备 macOS 公证密钥") &&
      customerWorkflowSource.includes("配置 macOS 签名参数") &&
      customerWorkflowSource.includes("CRAZOR_APPLE_CERTIFICATE") &&
      customerWorkflowSource.includes("export_if_set") &&
      customerWorkflowSource.includes("未签名测试包") &&
      customerWorkflowSource.includes("APPLE_CERTIFICATE") &&
      customerWorkflowSource.includes("APPLE_CERTIFICATE_PASSWORD") &&
      customerWorkflowSource.includes("APPLE_API_KEY_P8") &&
      customerWorkflowSource.includes("APPLE_API_KEY_PATH") &&
      customerWorkflowSource.includes("APPLE_TEAM_ID") &&
      customerWorkflowSource.includes("导入 Windows 签名证书") &&
      customerWorkflowSource.includes("WINDOWS_CERTIFICATE") &&
      customerWorkflowSource.includes("WINDOWS_CERTIFICATE_PASSWORD") &&
      customerWorkflowSource.includes("配置 Windows 签名参数") &&
      customerWorkflowSource.includes("WINDOWS_CERTIFICATE_THUMBPRINT") &&
      customerWorkflowSource.includes("certificateThumbprint") &&
      customerWorkflowSource.includes("Import-PfxCertificate") &&
      customerWorkflowSource.includes("./scripts/build-customer.sh") &&
      customerWorkflowSource.includes("verify-customer-installer.mjs") &&
      customerWorkflowSource.includes("upload-artifact"),
    "GitHub Actions should expose a manual customer package build that embeds the configured backend URL"
  )
  const buildPackageStep = customerWorkflowSource.slice(
    customerWorkflowSource.indexOf("- name: 构建客户安装包"),
    customerWorkflowSource.indexOf("- name: 验证客户交付包")
  )
  assert.ok(
    !buildPackageStep.includes("APPLE_CERTIFICATE:") &&
      !buildPackageStep.includes("APPLE_CERTIFICATE_PASSWORD:") &&
      !buildPackageStep.includes("APPLE_SIGNING_IDENTITY:"),
    "Build step should not inject empty macOS signing secrets and accidentally trigger Tauri codesigning"
  )
  assert.ok(
    buildCustomerScript.includes('"current"') &&
      buildCustomerScript.includes('"macos-current"') &&
      buildCustomerScript.includes('"windows-current"') &&
      buildCustomerScript.includes("HOST_OS") &&
      buildCustomerScript.includes("npx tauri build") &&
      buildCustomerScript.includes("crazor-delivery-manifest.json") &&
      buildCustomerScript.includes("crazor-delivery-checksums.txt") &&
      buildCustomerScript.includes("crazor-start-here.md") &&
      buildCustomerScript.includes("renderStartGuide") &&
      buildCustomerScript.includes("copyFileSync") &&
      buildCustomerScript.includes('if (lowerName.endsWith(".app")) continue') &&
      buildCustomerScript.includes("bundleFiles") &&
      buildCustomerScript.includes("checksumFile") &&
      buildCustomerScript.includes('createHash("sha256")') &&
      buildCustomerScript.includes("createReadStream") &&
      buildCustomerScript.includes("sizeBytes") &&
      customerWorkflowSource.includes("CRAZOR_HEAD_SHA") &&
      buildCustomerScript.includes("GITHUB_HEAD_SHA || process.env.GITHUB_SHA") &&
      buildCustomerScript.includes("workflowSha") &&
      buildCustomerScript.includes("BUILD_SHA") &&
      buildCustomerScript.includes("BUILD_TIME") &&
      buildCustomerScript.includes('rm -rf "$BUNDLE_DIR"') &&
      buildCustomerScript.includes('find "$BUNDLE_DIR"') &&
      buildCustomerScript.includes("*.dmg") &&
      buildCustomerScript.includes("*.msi"),
    "customer build script should support current-platform packaging and verify installable bundle outputs"
  )
  assert.ok(
    verifyCustomerDeliveryScript.includes("verifyCustomerDeliveryPackage") &&
      verifyCustomerDeliveryScript.includes("manifest.bundleFiles") &&
      verifyCustomerDeliveryScript.includes("crazor-delivery-checksums.txt") &&
      verifyCustomerDeliveryScript.includes("crazor-start-here.md") &&
      verifyCustomerDeliveryScript.includes("validateStartGuide") &&
      verifyCustomerDeliveryScript.includes("缺少客户交付说明") &&
      verifyCustomerDeliveryScript.includes("deliveryIdentityFingerprint") &&
      verifyCustomerDeliveryScript.includes("crazor-handoff-report.md") &&
      verifyCustomerDeliveryScript.includes("Crazor 客户交付验收报告") &&
      verifyCustomerDeliveryScript.includes("SHA256 不一致") &&
      verifyCustomerDeliveryScript.includes("交付目录包含非交付文件") &&
      verifyCustomerDeliveryScript.includes('lowerName === "share"') &&
      verifyCustomerDeliveryScript.includes('lowerName === "macos"'),
    "customer delivery verifier should validate manifest, checksums, installer files, and reject build helper output"
  )
  assert.ok(
    verifyCustomerInstallerScript.includes("createInstallerSmokePlan") &&
      verifyCustomerInstallerScript.includes("hdiutil") &&
      verifyCustomerInstallerScript.includes("msiexec") &&
      verifyCustomerInstallerScript.includes("Get-AuthenticodeSignature") &&
      verifyCustomerInstallerScript.includes("CRAZOR_REQUIRE_INSTALLER_TRUST"),
    "customer installer smoke should open platform installers and expose a strict trust gate for formal delivery"
  )
})

test("customer desktop hosted backend chain can be smoke-tested before handoff", () => {
  assert.ok(
    hermesScript.includes("desktop-smoke") &&
      hermesScript.includes("customer-desktop-smoke.mjs") &&
      hermesScript.includes("handoff-check") &&
      hermesScript.includes("customer-handoff-check.mjs"),
    "operator script should expose a customer desktop remote smoke command"
  )
  assert.ok(
    customerDesktopSmokeScript.includes("runCustomerDesktopSmoke") &&
      customerDesktopSmokeScript.includes("requestDesktopText") &&
      customerDesktopSmokeScript.includes("buildCustomerServerUrl") &&
      customerDesktopSmokeScript.includes("validateWebEntrypointHtml") &&
      customerDesktopSmokeScript.includes("extractWebEntrypointAssetPaths") &&
      customerDesktopSmokeScript.includes("validateWebAssetResponse") &&
      customerDesktopSmokeScript.includes("/api/delivery/readiness") &&
      customerDesktopSmokeScript.includes("网页版统一入口检查") &&
      customerDesktopSmokeScript.includes("webEntrypointChecked") &&
      customerDesktopSmokeScript.includes("webAssetChecks") &&
      customerDesktopSmokeScript.includes("Web 统一入口未返回 Crazor 前端 HTML") &&
      customerDesktopSmokeScript.includes("Web 统一入口未声明可验证的前端静态资源") &&
      customerDesktopSmokeScript.includes("/api/auth/status") &&
      customerDesktopSmokeScript.includes("/api/auth/me") &&
      customerDesktopSmokeScript.includes("/api/crazor/context?limit=1") &&
      customerDesktopSmokeScript.includes("/api/crazor/contacts") &&
      customerDesktopSmokeScript.includes("/api/crazor/projects") &&
      customerDesktopSmokeScript.includes("/api/crazor/tasks") &&
      customerDesktopSmokeScript.includes("/api/crazor/docs/knowledge/tree") &&
      customerDesktopSmokeScript.includes("/api/crazor/attachments/policy") &&
      customerDesktopSmokeScript.includes("businessEntryChecks") &&
      customerDesktopSmokeScript.includes("validateBusinessEntrypointShape") &&
      customerDesktopSmokeScript.includes("/api/agent/provider") &&
      customerDesktopSmokeScript.includes("/api/models") &&
      customerDesktopSmokeScript.includes("/api/chat/completions") &&
      customerDesktopSmokeScript.includes("extractChatCompletionText") &&
      customerDesktopSmokeScript.includes("CRAZOR_DESKTOP_SMOKE_CHAT_TIMEOUT_MS") &&
      customerDesktopSmokeScript.includes("CRAZOR_DESKTOP_SMOKE_SKIP_LIVE_CHAT") &&
      customerDesktopSmokeScript.includes("CRAZOR_DESKTOP_SMOKE_LOGIN_TOKEN") &&
      customerDesktopSmokeScript.includes("CRAZOR_DESKTOP_SMOKE_ACCESS_CODE") &&
      customerDesktopSmokeScript.includes("CRAZOR_DESKTOP_SMOKE_ACTOR_TOKEN"),
    "customer desktop smoke should verify delivery identity, login gate, business context, and real chat responses"
  )
  assert.ok(
    customerHandoffCheckScript.includes("runCustomerHandoffCheck") &&
      customerHandoffCheckScript.includes("verifyCustomerDeliveryPackage") &&
      customerHandoffCheckScript.includes("validateCustomerBackendEnv") &&
      customerHandoffCheckScript.includes("verifyCustomerServer") &&
      customerHandoffCheckScript.includes("runCustomerDesktopSmoke") &&
      customerHandoffCheckScript.includes("交付指纹不一致") &&
      customerHandoffCheckScript.includes("CRAZOR_CUSTOMER_ACCESS_CODE") &&
      customerHandoffCheckScript.includes("listModelProviderConnections") &&
      customerHandoffCheckScript.includes("模型连接凭据") &&
      customerHandoffCheckScript.includes("Web 入口") &&
      customerHandoffCheckScript.includes("Web 静态资源") &&
      customerHandoffCheckScript.includes("## Web 入口自检") &&
      customerHandoffCheckScript.includes("isLocalModelBaseUrl") &&
      customerHandoffCheckScript.includes("renderCustomerHandoffReport") &&
      customerHandoffCheckScript.includes("## 业务入口自检") &&
      customerHandoffCheckScript.includes("## 后端自检项") &&
      customerHandoffCheckScript.includes("后端要求登录，但未提供可自动验证的客户访问码或登录 token"),
    "handoff check should compose artifact, backend env, hosted server, login, and desktop chat verification"
  )
  assert.ok(
    verifyCustomerServerScript.includes("normalizeReadinessChecks") &&
      verifyCustomerServerScript.includes("readinessChecks"),
    "customer server preflight should preserve delivery readiness checks for handoff reports"
  )
})
