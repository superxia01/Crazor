#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  parseEnvText,
  validateCustomerBackendEnv,
} from "./customer-backend-env.mjs"
import { runCustomerDesktopSmoke } from "./customer-desktop-smoke.mjs"
import { verifyCustomerDeliveryPackage } from "./verify-customer-delivery.mjs"
import {
  normalizeServerUrl,
  normalizeText,
  verifyCustomerServer,
} from "./verify-customer-server.mjs"

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_CHAT_TIMEOUT_MS = 60000

export async function runCustomerHandoffCheck({
  deliveryDir,
  envFile = "",
  accessCode = "",
  loginToken = "",
  actorToken = "",
  live = true,
  liveChat = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  chatTimeoutMs = DEFAULT_CHAT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const errors = []
  const warnings = []
  const normalizedDeliveryDir = resolve(process.cwd(), deliveryDir || "")
  const deliveryCheck = await verifyCustomerDeliveryPackage(normalizedDeliveryDir)

  if (!deliveryCheck.ok) {
    errors.push(...deliveryCheck.errors)
  }
  warnings.push(...(deliveryCheck.warnings || []))

  const manifest = deliveryCheck.manifest || {}
  const delivery = {
    dir: deliveryCheck.deliveryDir || normalizedDeliveryDir,
    customer: normalizeText(manifest.customer),
    serverUrl: normalizeServerUrl(manifest.serverUrl),
    platform: normalizeText(manifest.platform),
    deliveryProtocolVersion: normalizeText(manifest.deliveryProtocolVersion),
    identityFingerprint: normalizeText(manifest.deliveryIdentityFingerprint),
    gitSha: normalizeText(manifest.gitSha),
    builtAt: normalizeText(manifest.builtAt),
    installers: deliveryCheck.installers || [],
  }
  const env = readCustomerEnv(envFile, {
    expectedCustomer: delivery.customer,
    expectedServerUrl: delivery.serverUrl,
    expectedProtocolVersion: delivery.deliveryProtocolVersion,
    errors,
    warnings,
  })
  const resolvedAccessCode = normalizeText(
    accessCode ||
      env.accessCode ||
      process.env.CRAZOR_DESKTOP_SMOKE_ACCESS_CODE ||
      process.env.CRAZOR_CUSTOMER_ACCESS_CODE,
  )
  const resolvedLoginToken = normalizeText(
    loginToken ||
      process.env.CRAZOR_DESKTOP_SMOKE_LOGIN_TOKEN ||
      process.env.CRAZOR_CUSTOMER_LOGIN_TOKEN,
  )
  const resolvedActorToken = normalizeText(
    actorToken ||
      process.env.CRAZOR_DESKTOP_SMOKE_ACTOR_TOKEN ||
      process.env.CRAZOR_SMOKE_TOKEN,
  )

  let server = null
  let desktopSmoke = null

  if (deliveryCheck.ok && live) {
    server = await verifyCustomerServer({
      customer: delivery.customer,
      serverUrl: delivery.serverUrl,
      protocolVersion: delivery.deliveryProtocolVersion,
      identityFingerprint: delivery.identityFingerprint,
      timeoutMs,
      fetchImpl,
    })
    if (!server.ok) errors.push(...server.errors)
    warnings.push(...server.warnings)
    if (delivery.identityFingerprint && server.identityFingerprint && delivery.identityFingerprint !== server.identityFingerprint) {
      errors.push(`交付指纹不一致: 安装包=${delivery.identityFingerprint} 后端=${server.identityFingerprint}`)
    }

    if (server.ok) {
      try {
        desktopSmoke = await runCustomerDesktopSmoke({
          customer: delivery.customer,
          serverUrl: delivery.serverUrl,
          protocolVersion: delivery.deliveryProtocolVersion,
          loginToken: resolvedLoginToken,
          accessCode: resolvedAccessCode,
          actorToken: resolvedActorToken,
          timeoutMs,
          chatTimeoutMs,
          liveChat,
          fetchImpl,
          logger,
        })
        warnings.push(...desktopSmoke.warnings)
        if (desktopSmoke.interactiveLoginRequired) {
          errors.push("后端要求登录，但未提供可自动验证的客户访问码或登录 token，无法证明客户安装后可直接进入工作区")
        }
        if (desktopSmoke.loginRequired && !desktopSmoke.accessCodeLoginChecked && !resolvedLoginToken) {
          errors.push("后端要求登录，但本次未验证客户访问码换取 JWT")
        }
        if (liveChat && !desktopSmoke.liveChatChecked) {
          errors.push("本次未完成真实对话响应检查")
        }
      } catch (error) {
        errors.push(`客户桌面远程烟测失败: ${error?.message || error}`)
      }
    }
  } else if (!live) {
    warnings.push("已跳过在线后端与桌面对话验收；本次只校验安装包和客户后端环境文件")
  }

  return {
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    delivery,
    env: {
      file: env.file,
      checked: env.checked,
      customer: env.customer,
      serverUrl: env.serverUrl,
      deliveryProtocolVersion: env.deliveryProtocolVersion,
      accessCodeConfigured: Boolean(resolvedAccessCode),
    },
    server,
    desktopSmoke,
    live,
    liveChat,
    loginTokenProvided: Boolean(resolvedLoginToken),
    actorTokenProvided: Boolean(resolvedActorToken),
    errors,
    warnings: unique(warnings),
  }
}

export function renderCustomerHandoffReport(result) {
  const lines = [
    "# Crazor 客户交付验收报告",
    "",
    `- 验收时间: ${result.checkedAt}`,
    `- 验收结果: ${result.ok ? "通过" : "失败"}`,
    `- 客户: ${result.delivery.customer || "未声明"}`,
    `- 后端地址: ${result.delivery.serverUrl || "未声明"}`,
    `- 交付协议: ${result.delivery.deliveryProtocolVersion || "未声明"}`,
    `- 交付指纹: ${result.delivery.identityFingerprint || "未声明"}`,
    `- 平台: ${result.delivery.platform || "未声明"}`,
    `- 客户访问码: ${result.env.accessCodeConfigured ? "已提供" : "未提供"}`,
    "",
    "## 安装包",
    "",
  ]

  if (result.delivery.installers.length > 0) {
    for (const installer of result.delivery.installers) {
      lines.push(`- ${installer.path}: ${installer.sizeBytes} bytes, sha256=${installer.sha256}`)
    }
  } else {
    lines.push("- 未发现安装包")
  }

  lines.push(
    "",
    "## 后端配置",
    "",
    `- 环境文件: ${result.env.checked ? result.env.file : "未校验"}`,
    `- 配置客户: ${result.env.customer || "未声明"}`,
    `- 配置后端地址: ${result.env.serverUrl || "未声明"}`,
    `- 配置交付协议: ${result.env.deliveryProtocolVersion || "未声明"}`,
    "",
    "## 在线链路",
    "",
    `- 在线验收: ${result.live ? "已执行" : "已跳过"}`,
    `- 后端自检: ${result.server?.status || "未执行"}`,
    `- 后端指纹: ${result.server?.identityFingerprint || "未执行"}`,
    `- 登录门禁: ${result.desktopSmoke ? (result.desktopSmoke.loginRequired ? "需要登录" : "未要求登录") : "未执行"}`,
    `- 访问码登录: ${result.desktopSmoke?.accessCodeLoginChecked ? "已验证" : "未验证"}`,
    `- 真实对话: ${result.desktopSmoke?.liveChatChecked ? "已验证" : "未验证"}`,
    "",
    "## 错误",
    "",
  )

  if (result.errors.length > 0) {
    for (const error of result.errors) lines.push(`- ${error}`)
  } else {
    lines.push("- 无")
  }

  lines.push("", "## 警告", "")
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) lines.push(`- ${warning}`)
  } else {
    lines.push("- 无")
  }

  return `${lines.join("\n")}\n`
}

function readCustomerEnv(envFile, {
  expectedCustomer,
  expectedServerUrl,
  expectedProtocolVersion,
  errors,
  warnings,
}) {
  const result = {
    file: "",
    checked: false,
    customer: "",
    serverUrl: "",
    deliveryProtocolVersion: "",
    accessCode: "",
  }

  if (!envFile) {
    warnings.push("未提供客户后端环境文件；无法核对 .env.customer 是否与安装包一致")
    return result
  }

  const absoluteEnvFile = resolve(process.cwd(), envFile)
  result.file = absoluteEnvFile
  if (!existsSync(absoluteEnvFile)) {
    errors.push(`客户后端环境文件不存在: ${absoluteEnvFile}`)
    return result
  }

  const parsed = parseEnvText(readFileSync(absoluteEnvFile, "utf8"))
  const validation = validateCustomerBackendEnv(parsed, {
    expectedCustomer,
    expectedServerUrl,
  })
  result.checked = true
  result.customer = normalizeText(parsed.CRAZOR_DELIVERY_CUSTOMER)
  result.serverUrl = normalizeServerUrl(parsed.CRAZOR_PUBLIC_BASE_URL)
  result.deliveryProtocolVersion = normalizeText(parsed.CRAZOR_DELIVERY_PROTOCOL_VERSION)
  result.accessCode = normalizeText(parsed.CRAZOR_CUSTOMER_ACCESS_CODE)

  if (!validation.ok) errors.push(...validation.errors)
  warnings.push(...validation.warnings)
  if (expectedProtocolVersion && result.deliveryProtocolVersion !== expectedProtocolVersion) {
    errors.push(`CRAZOR_DELIVERY_PROTOCOL_VERSION 必须为 ${expectedProtocolVersion}`)
  }

  return result
}

function parseArgs(argv) {
  const options = {
    live: true,
    liveChat: true,
    json: false,
  }
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--env-file" || arg === "-e") options.envFile = argv[++index] || ""
    else if (arg === "--access-code") options.accessCode = argv[++index] || ""
    else if (arg === "--login-token") options.loginToken = argv[++index] || ""
    else if (arg === "--actor-token") options.actorToken = argv[++index] || ""
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++index] || DEFAULT_TIMEOUT_MS)
    else if (arg === "--chat-timeout-ms") options.chatTimeoutMs = Number(argv[++index] || DEFAULT_CHAT_TIMEOUT_MS)
    else if (arg === "--skip-live") options.live = false
    else if (arg === "--skip-live-chat") options.liveChat = false
    else if (arg === "--json") options.json = true
    else if (arg === "--output" || arg === "-o") options.output = argv[++index] || ""
    else if (arg === "--help" || arg === "-h") options.help = true
    else positional.push(arg)
  }
  options.deliveryDir = positional[0] || options.deliveryDir || ""
  return options
}

function printHelp() {
  console.log(`用法:
  ./scripts/hermes handoff-check <customer-delivery目录> --env-file .env.customer
  node scripts/customer-handoff-check.mjs <customer-delivery目录> --env-file .env.customer --output handoff.md

说明:
  校验客户安装包、客户后端环境文件、托管后端交付身份、访问码登录和桌面对话链路。
  默认会执行在线后端验收；只校验离线产物时加 --skip-live。
  默认会实际调用一次非流式对话；只检查入口时加 --skip-live-chat。

常用参数:
  --env-file <文件>       客户后端环境文件，通常是 .env.customer
  --access-code <访问码>  覆盖环境文件中的 CRAZOR_CUSTOMER_ACCESS_CODE
  --login-token <JWT>     使用已有客户登录 JWT 验收
  --actor-token <Token>   使用 Crazor 内部权限 token 验收受控业务接口
  --output <文件>         输出 Markdown 验收报告
  --json                  输出 JSON 结果`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  if (!options.deliveryDir) {
    printHelp()
    process.exit(1)
  }

  const result = await runCustomerHandoffCheck({
    ...options,
    logger: options.json ? { log() {}, warn() {} } : console,
  })
  const report = renderCustomerHandoffReport(result)
  if (options.output) {
    writeFileSync(resolve(process.cwd(), options.output), report)
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`${result.ok ? "客户交付验收通过" : "客户交付验收失败"}：${result.delivery.customer || "未知客户"}`)
    console.log(`- 安装包目录: ${result.delivery.dir}`)
    console.log(`- 后端地址: ${result.delivery.serverUrl || "未声明"}`)
    console.log(`- 交付指纹: ${result.delivery.identityFingerprint || "未声明"}`)
    console.log(`- 客户访问码: ${result.env.accessCodeConfigured ? "已提供" : "未提供"}`)
    console.log(`- 在线验收: ${result.live ? "已执行" : "已跳过"}`)
    if (options.output) console.log(`- 验收报告: ${resolve(process.cwd(), options.output)}`)
    for (const warning of result.warnings) console.warn(`警告: ${warning}`)
    for (const error of result.errors) console.error(`错误: ${error}`)
  }

  if (!result.ok) process.exit(1)
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`客户交付验收失败: ${error?.message || error}`)
    process.exit(1)
  })
}
