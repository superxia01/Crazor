// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const buildCustomerScript = readFileSync(resolve(repoRoot, "scripts/build-customer.sh"), "utf8")
const webPackage = readFileSync(resolve(repoRoot, "web/package.json"), "utf8")
const desktopPackage = readFileSync(resolve(repoRoot, "desktop/package.json"), "utf8")
const authFetchSource = readFileSync(resolve(repoRoot, "web/src/api/crazor-auth.js"), "utf8")
const customerDeliverySource = readFileSync(resolve(repoRoot, "web/src/api/customer-delivery.js"), "utf8")
const remoteApiSource = readFileSync(resolve(repoRoot, "web/src/api/remote-api-base.js"), "utf8")
const settingsModalSource = readFileSync(resolve(repoRoot, "web/src/SettingsModal.jsx"), "utf8")
const loginDialogSource = readFileSync(resolve(repoRoot, "web/src/components/LoginDialog.jsx"), "utf8")
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const serverAuthSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-auth.ts"), "utf8")
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
      buildCustomerScript.includes("npm run build:tauri") &&
      buildCustomerScript.includes('grep -R -F "$SERVER_URL" "$PROJECT_ROOT/web/dist"') &&
      buildCustomerScript.includes('grep -R -F "$CUSTOMER" "$PROJECT_ROOT/web/dist"') &&
      !buildCustomerScript.includes("__CUSTOMER_SERVER_URL__"),
    "customer build should write package env before packaging and verify backend/customer identity is embedded"
  )
  assert.ok(
    buildCustomerScript.includes("command -v cargo") &&
      buildCustomerScript.includes("未找到 cargo") &&
      buildCustomerScript.indexOf("command -v cargo") < buildCustomerScript.indexOf("npm run build:tauri"),
    "customer build should fail fast when the Tauri Rust toolchain is missing"
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
      remoteApiSource.includes('buildRemoteApiUrl("/api/health"'),
    "desktop client should expose the embedded backend URL and health endpoint"
  )
  assert.ok(
    customerDeliverySource.includes("getCustomerDeliveryRuntimeInfo") &&
      customerDeliverySource.includes("VITE_CRAZOR_CUSTOMER_NAME") &&
      customerDeliverySource.includes("VITE_CRAZOR_DELIVERY_CHANNEL"),
    "desktop client should expose packaged customer identity from build-time env"
  )
  assert.ok(
    settingsModalSource.includes("客户端后端") &&
      settingsModalSource.includes("检测后端") &&
      settingsModalSource.includes("交付客户") &&
      settingsModalSource.includes("客户包") &&
      settingsModalSource.includes("远程服务") &&
      settingsModalSource.includes("同源服务"),
    "settings connection panel should let operators verify the packaged client backend target"
  )
})

test("desktop WeChat login uses backend callback plus client polling", () => {
  assert.ok(
    serverIndex.includes("wechatLoginSessions") &&
      serverIndex.includes("app.get('/api/auth/wechat/session/:state'") &&
      serverIndex.includes("const redirectUri = `${backendOrigin(c)}/api/auth/wechat/callback`"),
    "backend should keep a state-bound desktop login session"
  )
  assert.ok(
    loginDialogSource.includes("/api/auth/wechat/session/") &&
      loginDialogSource.includes("localStorage.setItem('crazor_token', data.token)"),
    "desktop client should poll the backend login session and store the returned JWT"
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
      customerWorkflowSource.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24") &&
      customerWorkflowSource.includes("actions/checkout@v6.0.2") &&
      customerWorkflowSource.includes("actions/setup-node@v6.4.0") &&
      customerWorkflowSource.includes("actions/upload-artifact@v7.0.1") &&
      customerWorkflowSource.includes("./scripts/build-customer.sh") &&
      customerWorkflowSource.includes("upload-artifact"),
    "GitHub Actions should expose a manual customer package build that embeds the configured backend URL"
  )
  assert.ok(
    buildCustomerScript.includes('"current"') &&
      buildCustomerScript.includes("npx tauri build") &&
      buildCustomerScript.includes("crazor-delivery-manifest.json") &&
      customerWorkflowSource.includes("CRAZOR_HEAD_SHA") &&
      buildCustomerScript.includes("GITHUB_HEAD_SHA || process.env.GITHUB_SHA") &&
      buildCustomerScript.includes("workflowSha") &&
      buildCustomerScript.includes('find "$BUNDLE_DIR"') &&
      buildCustomerScript.includes("*.dmg") &&
      buildCustomerScript.includes("*.msi"),
    "customer build script should support current-platform packaging and verify installable bundle outputs"
  )
})
