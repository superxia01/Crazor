#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { normalizeServerUrl, normalizeText } from "./verify-customer-server.mjs"

const DEFAULT_PROTOCOL_VERSION = "1"
const DEFAULT_OUTPUT_FILE = ".env.customer"
const DEFAULT_TAURI_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
]

export function buildCustomerBackendEnv({
  customer = "",
  serverUrl = "",
  protocolVersion = DEFAULT_PROTOCOL_VERSION,
  jwtSecret = "",
  accessCode = "",
  agentGatewayApiKey = "",
  wechatAppId = "",
  wechatAppSecret = "",
  composeProjectName = "",
  deploymentTier = "customer",
  webPort = "5173",
} = {}) {
  const normalizedCustomer = normalizeText(customer)
  const normalizedServerUrl = normalizeServerUrl(serverUrl)
  const generatedJwtSecret = jwtSecret || randomBytes(32).toString("hex")
  const generatedAccessCode = accessCode || randomBytes(9).toString("base64url")
  const generatedAgentGatewayApiKey = agentGatewayApiKey || randomBytes(32).toString("hex")
  const corsOrigins = unique([
    normalizedServerUrl,
    "http://localhost:5173",
    "http://localhost:5174",
    ...DEFAULT_TAURI_ORIGINS,
  ].filter(Boolean))
  const apiServerCorsOrigins = unique([
    "http://localhost:9119",
    "http://localhost:5173",
    normalizedServerUrl,
  ].filter(Boolean))

  return {
    COMPOSE_PROJECT_NAME: composeProjectName || makeComposeProjectName(normalizedCustomer),
    COMPOSE_PROFILES: "hermes",
    CRAZOR_WEB_PORT: String(webPort || "5173"),
    AGENT_PROVIDER: "hermes",
    AGENT_GATEWAY_URL: "http://hermes:8642",
    AGENT_DASHBOARD_URL: "http://hermes:9119",
    AGENT_GATEWAY_API_KEY: generatedAgentGatewayApiKey,
    HERMES_IMAGE: "nousresearch/hermes-agent:main",
    HERMES_GATEWAY_URL: "http://hermes:8642",
    HERMES_DASHBOARD_URL: "http://hermes:9119",
    HERMES_API_SERVER_KEY: generatedAgentGatewayApiKey,
    HERMES_GATEWAY_BIND: "127.0.0.1",
    HERMES_DASHBOARD_BIND: "127.0.0.1",
    HERMES_DASHBOARD_HOST: "0.0.0.0",
    HERMES_DASHBOARD_INSECURE: "1",
    HERMES_WORKSPACE_ROOT: "/opt/workspaces",
    HERMES_USER_WORKDIR: "/opt/workspaces/users/default",
    TZ: "Asia/Shanghai",
    CRON_TZ: "Asia/Shanghai",
    CRAZOR_SEED_DEMO_DATA: "false",
    DEPLOYMENT_TIER: deploymentTier || "customer",
    JWT_SECRET: generatedJwtSecret,
    CRAZOR_CUSTOMER_ACCESS_CODE: generatedAccessCode,
    WECHAT_APP_ID: String(wechatAppId || "").trim(),
    WECHAT_APP_SECRET: String(wechatAppSecret || "").trim(),
    CRAZOR_DELIVERY_CUSTOMER: normalizedCustomer,
    CRAZOR_DELIVERY_CHANNEL: "customer",
    CRAZOR_PUBLIC_BASE_URL: normalizedServerUrl,
    CRAZOR_DELIVERY_PROTOCOL_VERSION: normalizeText(protocolVersion) || DEFAULT_PROTOCOL_VERSION,
    CRAZOR_CUSTOMER_SERVER_PREFLIGHT: "strict",
    CRAZOR_REQUIRE_WRITE_TOKEN: "true",
    CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN: "true",
    CRAZOR_REQUIRE_BUSINESS_READ_TOKEN: "true",
    CORS_ORIGINS: corsOrigins.join(","),
    API_SERVER_CORS_ORIGINS: apiServerCorsOrigins.join(","),
  }
}

export function validateCustomerBackendEnv(env = {}, {
  expectedCustomer = "",
  expectedServerUrl = "",
  strict = false,
} = {}) {
  const errors = []
  const warnings = []
  const customer = normalizeText(env.CRAZOR_DELIVERY_CUSTOMER)
  const serverUrl = normalizeServerUrl(env.CRAZOR_PUBLIC_BASE_URL)
  const expectedNormalizedCustomer = normalizeText(expectedCustomer)
  const expectedNormalizedServerUrl = normalizeServerUrl(expectedServerUrl)

  if (!customer) errors.push("CRAZOR_DELIVERY_CUSTOMER 不能为空")
  if (expectedNormalizedCustomer && customer !== expectedNormalizedCustomer) {
    errors.push(`CRAZOR_DELIVERY_CUSTOMER 必须为 ${expectedNormalizedCustomer}`)
  }
  if (!serverUrl) errors.push("CRAZOR_PUBLIC_BASE_URL 必须是 http:// 或 https:// 地址")
  if (expectedNormalizedServerUrl && serverUrl !== expectedNormalizedServerUrl) {
    errors.push(`CRAZOR_PUBLIC_BASE_URL 必须为 ${expectedNormalizedServerUrl}`)
  }
  if (!normalizeText(env.CRAZOR_DELIVERY_PROTOCOL_VERSION)) {
    errors.push("CRAZOR_DELIVERY_PROTOCOL_VERSION 不能为空")
  }
  if (env.CRAZOR_DELIVERY_CHANNEL !== "customer") {
    errors.push("CRAZOR_DELIVERY_CHANNEL 必须为 customer")
  }
  if (env.CRAZOR_CUSTOMER_SERVER_PREFLIGHT !== "strict") {
    errors.push("CRAZOR_CUSTOMER_SERVER_PREFLIGHT 必须为 strict，避免未预检就构建客户包")
  }
  if (env.CRAZOR_SEED_DEMO_DATA !== "false") {
    errors.push("CRAZOR_SEED_DEMO_DATA 必须为 false，客户环境不能默认写入演示数据")
  }
  if (!String(env.COMPOSE_PROFILES || "").split(",").map((item) => item.trim()).includes("hermes")) {
    errors.push("COMPOSE_PROFILES 必须包含 hermes")
  }
  if (env.AGENT_GATEWAY_URL !== "http://hermes:8642") {
    errors.push("AGENT_GATEWAY_URL 必须指向 Compose 内部 Hermes Gateway")
  }
  if (!isUsableAgentGatewayKey(env.AGENT_GATEWAY_API_KEY)) {
    errors.push("AGENT_GATEWAY_API_KEY 必须是至少 32 字符的正式密钥")
  }
  if (env.HERMES_API_SERVER_KEY !== env.AGENT_GATEWAY_API_KEY) {
    errors.push("HERMES_API_SERVER_KEY 必须与 AGENT_GATEWAY_API_KEY 保持一致")
  }
  if (env.HERMES_WORKSPACE_ROOT !== "/opt/workspaces") {
    errors.push("HERMES_WORKSPACE_ROOT 必须为 /opt/workspaces，避免工作区嵌套到 /opt/data 初始化目录")
  }
  if (env.HERMES_USER_WORKDIR !== "/opt/workspaces/users/default") {
    errors.push("HERMES_USER_WORKDIR 必须为 /opt/workspaces/users/default")
  }
  if (env.HERMES_DASHBOARD_BIND !== "127.0.0.1") {
    errors.push("HERMES_DASHBOARD_BIND 必须为 127.0.0.1，避免客户环境暴露 Hermes Dashboard 管理面")
  }
  if (env.HERMES_DASHBOARD_HOST !== "0.0.0.0") {
    errors.push("HERMES_DASHBOARD_HOST 必须为 0.0.0.0，确保 Crazor 后端可通过 Compose 内网访问 Dashboard")
  }
  if (env.HERMES_DASHBOARD_INSECURE !== "1") {
    errors.push("HERMES_DASHBOARD_INSECURE 必须为 1，显式允许受控内网 Dashboard 绑定")
  }
  if (env.CRAZOR_REQUIRE_WRITE_TOKEN !== "true") {
    errors.push("CRAZOR_REQUIRE_WRITE_TOKEN 必须为 true")
  }
  if (env.CRAZOR_REQUIRE_BUSINESS_READ_TOKEN !== "true") {
    errors.push("CRAZOR_REQUIRE_BUSINESS_READ_TOKEN 必须为 true")
  }
  if (env.CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN !== "true") {
    errors.push("CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN 必须为 true")
  }
  if (!isStrongJwtSecret(env.JWT_SECRET)) {
    errors.push("JWT_SECRET 必须是至少 32 字符的正式密钥")
  }
  if (!isStrongAccessCode(env.CRAZOR_CUSTOMER_ACCESS_CODE)) {
    errors.push("CRAZOR_CUSTOMER_ACCESS_CODE 必须是至少 8 字符的客户访问码")
  }

  const corsOrigins = splitCsv(env.CORS_ORIGINS)
  for (const requiredOrigin of DEFAULT_TAURI_ORIGINS) {
    if (!corsOrigins.includes(requiredOrigin)) {
      errors.push(`CORS_ORIGINS 缺少 Tauri 来源 ${requiredOrigin}`)
    }
  }
  if (serverUrl && !corsOrigins.includes(serverUrl)) {
    errors.push("CORS_ORIGINS 必须包含 CRAZOR_PUBLIC_BASE_URL")
  }

  const apiServerOrigins = splitCsv(env.API_SERVER_CORS_ORIGINS)
  if (!apiServerOrigins.includes("http://localhost:9119")) {
    errors.push("API_SERVER_CORS_ORIGINS 必须包含 Hermes Dashboard 来源")
  }

  if (serverUrl && isLoopbackUrl(serverUrl)) {
    warnings.push("CRAZOR_PUBLIC_BASE_URL 当前是本机地址，正式客户安装包应改为客户可访问的局域网 IP 或 HTTPS 域名")
  }
  if (serverUrl && new URL(serverUrl).protocol === "http:" && !isPrivateNetworkUrl(serverUrl)) {
    warnings.push("公网客户交付建议使用 HTTPS；HTTP 仅适合可信局域网")
  }
  if (!normalizeText(env.WECHAT_APP_ID) || !normalizeText(env.WECHAT_APP_SECRET)) {
    if (!isStrongAccessCode(env.CRAZOR_CUSTOMER_ACCESS_CODE)) {
      warnings.push("微信登录未配置；客户登录页会提示设置 WECHAT_APP_ID 和 WECHAT_APP_SECRET")
    }
  }

  return {
    ok: errors.length === 0 && (!strict || warnings.length === 0),
    errors,
    warnings,
  }
}

export function renderCustomerBackendEnv(env = {}) {
  const lines = [
    "# Crazor 客户后端交付环境",
    "# 由 scripts/customer-backend-env.mjs 生成。密钥文件不要提交到 Git。",
    "",
  ]
  for (const key of Object.keys(env)) {
    lines.push(`${key}=${quoteEnvValue(env[key])}`)
  }
  return `${lines.join("\n")}\n`
}

export function parseEnvText(text = "") {
  const env = {}
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const index = line.indexOf("=")
    if (index < 1) continue
    const key = line.slice(0, index).trim()
    env[key] = unquoteEnvValue(line.slice(index + 1).trim())
  }
  return env
}

function makeComposeProjectName(customer) {
  const ascii = String(customer || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
  if (ascii) return `crazor-${ascii}`
  const hash = createHash("sha1").update(String(customer || "customer")).digest("hex").slice(0, 8)
  return `crazor-customer-${hash}`
}

function isStrongJwtSecret(value) {
  const text = String(value || "").trim()
  if (text.length < 32) return false
  return !["dev-secret-change-in-production", "change-me", "please-change"].some((bad) => text.includes(bad))
}

function isStrongAccessCode(value) {
  const text = String(value || "").trim()
  if (text.length < 8) return false
  return !["change-me", "please-change", "12345678", "password"].some((bad) => text.toLowerCase().includes(bad))
}

function isUsableAgentGatewayKey(value) {
  const text = String(value || "").trim()
  if (text.length < 32) return false
  return !["change-me", "please-change", "change-me-run-scripts-hermes-init"].some((bad) => text.includes(bad))
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function quoteEnvValue(value) {
  return `"${String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "$$")}"`
}

function unquoteEnvValue(value) {
  const text = String(value || "").trim()
  if (text.startsWith('"') && text.endsWith('"')) {
    return text
      .slice(1, -1)
      .replace(/\$\$/g, "$")
      .replace(/\\"/g, '"')
      .replace(/\\r/g, "\r")
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\")
  }
  return text
}

function isLoopbackUrl(value) {
  const host = new URL(value).hostname.toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

function isPrivateNetworkUrl(value) {
  const host = new URL(value).hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".local")) return true
  if (/^10\./.test(host)) return true
  const sharedAddressMatch = host.match(/^100\.(\d+)\./)
  if (sharedAddressMatch) {
    const secondOctet = Number(sharedAddressMatch[1])
    if (secondOctet >= 64 && secondOctet <= 127) return true
  }
  if (/^192\.168\./.test(host)) return true
  const match = host.match(/^172\.(\d+)\./)
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
}

function parseArgs(argv) {
  const options = {}
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--customer") options.customer = argv[++index] || ""
    else if (arg === "--server-url") options.serverUrl = argv[++index] || ""
    else if (arg === "--protocol-version") options.protocolVersion = argv[++index] || ""
    else if (arg === "--jwt-secret") options.jwtSecret = argv[++index] || ""
    else if (arg === "--access-code") options.accessCode = argv[++index] || ""
    else if (arg === "--agent-gateway-api-key") options.agentGatewayApiKey = argv[++index] || ""
    else if (arg === "--wechat-app-id") options.wechatAppId = argv[++index] || ""
    else if (arg === "--wechat-app-secret") options.wechatAppSecret = argv[++index] || ""
    else if (arg === "--output" || arg === "-o") options.output = argv[++index] || ""
    else if (arg === "--check") options.check = argv[++index] || ""
    else if (arg === "--stdout") options.stdout = true
    else if (arg === "--force") options.force = true
    else if (arg === "--strict") options.strict = true
    else if (arg === "--help" || arg === "-h") options.help = true
    else positional.push(arg)
  }
  if (!options.customer && positional[0]) options.customer = positional[0]
  if (!options.serverUrl && positional[1]) options.serverUrl = positional[1]
  if (!options.output && positional[2]) options.output = positional[2]
  return options
}

function printHelp() {
  console.log(`用法:
  node scripts/customer-backend-env.mjs "客户名称" "http://局域网IP:5173" [输出文件]
  node scripts/customer-backend-env.mjs --customer "客户名称" --server-url "https://crazor.example.com" --access-code "客户访问码" --agent-gateway-api-key "Agent网关密钥" --output .env.customer --force
  node scripts/customer-backend-env.mjs --check .env.customer --customer "客户名称" --server-url "https://crazor.example.com" --strict

说明:
  生成客户后端 Docker Compose 环境文件，默认输出到 .env.customer。
  默认会生成 CRAZOR_CUSTOMER_ACCESS_CODE 访问码和 AGENT_GATEWAY_API_KEY；正式交付也可同时传入 --wechat-app-id 和 --wechat-app-secret。`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  if (options.check) {
    const checkPath = resolve(process.cwd(), options.check)
    if (!existsSync(checkPath)) {
      console.error(`客户后端环境文件不存在: ${checkPath}`)
      process.exit(1)
    }
    const parsed = parseEnvText(readFileSync(checkPath, "utf8"))
    const validation = validateCustomerBackendEnv(parsed, {
      expectedCustomer: options.customer,
      expectedServerUrl: options.serverUrl,
      strict: Boolean(options.strict),
    })
    if (!validation.ok) {
      console.error("客户后端环境校验失败:")
      for (const error of validation.errors) console.error(`- ${error}`)
      for (const warning of validation.warnings) console.error(`- ${warning}`)
      process.exit(1)
    }
    console.log(`客户后端环境校验通过: ${checkPath}`)
    for (const warning of validation.warnings) {
      console.warn(`警告: ${warning}`)
    }
    return
  }

  const env = buildCustomerBackendEnv(options)
  const validation = validateCustomerBackendEnv(env, {
    expectedCustomer: options.customer,
    expectedServerUrl: options.serverUrl,
    strict: Boolean(options.strict),
  })
  if (!validation.ok) {
    console.error("客户后端环境生成失败:")
    for (const error of validation.errors) console.error(`- ${error}`)
    for (const warning of validation.warnings) console.error(`- ${warning}`)
    process.exit(1)
  }

  const content = renderCustomerBackendEnv(env)
  const output = options.stdout ? "" : resolve(process.cwd(), options.output || DEFAULT_OUTPUT_FILE)
  const logInfo = options.stdout ? console.error : console.log
  if (output) {
    if (existsSync(output) && !options.force) {
      console.error(`客户后端环境文件已存在: ${output}。如需覆盖请加 --force。`)
      process.exit(1)
    }
    writeFileSync(output, content, { mode: 0o600 })
    logInfo(`客户后端环境已生成: ${output}`)
  } else {
    process.stdout.write(content)
  }

  for (const warning of validation.warnings) {
    console.warn(`警告: ${warning}`)
  }
  logInfo(`客户: ${env.CRAZOR_DELIVERY_CUSTOMER}`)
  logInfo(`服务地址: ${env.CRAZOR_PUBLIC_BASE_URL}`)
  logInfo("后续: docker compose --env-file <环境文件> up -d --build")
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`客户后端环境生成失败: ${error?.message || error}`)
    process.exit(1)
  })
}
