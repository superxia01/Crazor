#!/usr/bin/env node

import { fileURLToPath } from "node:url"
import {
  normalizeServerUrl,
  normalizeText,
  verifyCustomerServer,
} from "./verify-customer-server.mjs"

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_CHAT_TIMEOUT_MS = 60000
const DEFAULT_PROTOCOL_VERSION = "1"
const BUSINESS_ENTRYPOINTS = [
  { id: "contacts", label: "客户 CRM", path: "/api/crazor/contacts", shape: "array" },
  { id: "projects", label: "项目机会", path: "/api/crazor/projects", shape: "array" },
  { id: "tasks", label: "任务协作", path: "/api/crazor/tasks", shape: "array" },
  { id: "deliveries", label: "交付记录", path: "/api/crazor/deliveries", shape: "array" },
  { id: "knowledge-tree", label: "知识库树", path: "/api/crazor/docs/knowledge/tree", shape: "any" },
  { id: "attachment-policy", label: "附件策略", path: "/api/crazor/attachments/policy", shape: "object" },
]
const WEB_ASSET_EXTENSIONS = new Set([".js", ".css"])

export function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase())
}

export function buildDesktopHeaders({ loginToken = "", actorToken = "", json = false } = {}) {
  const headers = { Accept: "application/json" }
  const normalizedLoginToken = String(loginToken || "").trim()
  const normalizedActorToken = String(actorToken || "").trim()
  if (normalizedLoginToken) headers.Authorization = `Bearer ${normalizedLoginToken}`
  if (normalizedActorToken) headers["X-Crazor-Token"] = normalizedActorToken
  if (json) headers["Content-Type"] = "application/json"
  return headers
}

export function evaluateDesktopLoginGate(authStatus = {}, me = {}, { loginToken = "" } = {}) {
  const loginRequired = Boolean(authStatus?.loginRequired)
  const loggedIn = Boolean(me?.loggedIn)
  const hasLoginToken = Boolean(String(loginToken || "").trim())
  return {
    loginRequired,
    loggedIn,
    needsInteractiveLogin: loginRequired && !hasLoginToken,
    ok: !loginRequired || loggedIn || !hasLoginToken,
  }
}

export function extractChatCompletionText(data = {}) {
  const message = data?.choices?.[0]?.message
  if (typeof message?.content === "string") return message.content.trim()
  if (Array.isArray(message?.content)) {
    return message.content
      .map((part) => part?.text || "")
      .filter(Boolean)
      .join("\n")
      .trim()
  }
  return ""
}

export function summarizeReadinessIssues(readiness = {}) {
  const checks = Array.isArray(readiness?.checks) ? readiness.checks : []
  return checks
    .filter((check) => check?.status === "warn" || check?.status === "error")
    .map((check) => {
      const label = normalizeText(check?.label || check?.id || "检查项")
      const detail = normalizeText(check?.detail || "无详情")
      const status = normalizeText(check?.status)
      return `${label}${status === "error" ? "失败" : "警告"}: ${detail}`
    })
}

export function validateBusinessEntrypointShape(entrypoint, data) {
  if (entrypoint.shape === "array") return Array.isArray(data)
  if (entrypoint.shape === "object") return Boolean(data && typeof data === "object" && !Array.isArray(data))
  return data !== null && data !== undefined
}

export function validateCustomerPortalPayload(data) {
  return Boolean(
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.summary &&
    typeof data.summary === "object" &&
    data.binding &&
    typeof data.binding === "object",
  )
}

export function validateWebEntrypointHtml(text) {
  const html = String(text || "")
  return /<html[\s>]/i.test(html) &&
    /<title>[^<]*Crazor/i.test(html) &&
    /\bid=["']root["']/i.test(html) &&
    /<script\b/i.test(html)
}

export function buildCustomerServerUrl(baseUrl, path = "/") {
  const normalizedBaseUrl = normalizeServerUrl(baseUrl)
  if (!normalizedBaseUrl) return ""

  const base = new URL(`${normalizedBaseUrl}/`)
  const normalizedPath = String(path || "/").trim()
  if (!normalizedPath || normalizedPath === "/") return base.toString()

  const basePath = base.pathname.replace(/\/+$/, "")
  const pathAlreadyIncludesBase =
    basePath &&
    normalizedPath.startsWith("/") &&
    (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))
  if (pathAlreadyIncludesBase) {
    return new URL(normalizedPath, base.origin).toString()
  }

  return new URL(normalizedPath.replace(/^\/+/, ""), base).toString()
}

export function extractWebEntrypointAssetPaths(html, baseUrl) {
  const normalizedBaseUrl = normalizeServerUrl(baseUrl)
  if (!normalizedBaseUrl) return []
  const base = new URL(buildCustomerServerUrl(normalizedBaseUrl, "/"))
  const assets = []
  const seen = new Set()
  const attrPattern = /\b(?:src|href)=["']([^"']+)["']/gi
  let match

  while ((match = attrPattern.exec(String(html || "")))) {
    const rawValue = String(match[1] || "").trim()
    if (!rawValue || rawValue.startsWith("#") || rawValue.startsWith("data:") || rawValue.startsWith("blob:")) continue

    let assetUrl
    try {
      assetUrl = new URL(rawValue, base)
    } catch {
      continue
    }
    if (assetUrl.origin !== base.origin) continue

    const extension = assetUrl.pathname.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || ""
    if (!WEB_ASSET_EXTENSIONS.has(extension)) continue

    const path = `${assetUrl.pathname}${assetUrl.search}`
    if (seen.has(path)) continue
    seen.add(path)
    assets.push({
      path,
      type: extension === ".css" ? "style" : "script",
      label: extension === ".css" ? "样式资源" : "脚本资源",
    })
  }

  return assets
}

export function validateWebAssetResponse(asset = {}, text = "", contentType = "") {
  const body = String(text || "").trim()
  if (!body || /<html[\s>]/i.test(body)) return false
  const normalizedType = String(contentType || "").toLowerCase()
  if (asset.type === "style") {
    return normalizedType.includes("css") || /[.#]?[a-z0-9_-]+\s*\{[^}]+}/i.test(body)
  }
  return normalizedType.includes("javascript") ||
    normalizedType.includes("ecmascript") ||
    /\b(import|export|function|const|let|var)\b/.test(body)
}

export async function requestDesktopText(baseUrl, path, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  expected = [200],
  accept = "text/html",
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedBaseUrl = normalizeServerUrl(baseUrl)
  if (!normalizedBaseUrl) throw new Error("客户桌面烟测需要有效的 http:// 或 https:// 后端地址")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(buildCustomerServerUrl(normalizedBaseUrl, path), {
      headers: { Accept: accept },
      signal: controller.signal,
    })
    const text = await response.text()
    if (!expected.includes(response.status)) {
      throw new Error(`GET ${path} 返回 ${response.status}${text ? `：${text.slice(0, 200)}` : ""}`)
    }
    return { status: response.status, text, contentType: response.headers?.get?.("Content-Type") || "" }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`GET ${path} 超时`)
    }
    if (error instanceof Error && error.message.startsWith(`GET ${path} 返回`)) {
      throw error
    }
    throw new Error(`GET ${path} 网络请求失败：${error?.message || error}`)
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestDesktopJson(baseUrl, path, {
  method = "GET",
  body,
  loginToken = "",
  actorToken = "",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  expected = [200],
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedBaseUrl = normalizeServerUrl(baseUrl)
  if (!normalizedBaseUrl) throw new Error("客户桌面烟测需要有效的 http:// 或 https:// 后端地址")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const headers = buildDesktopHeaders({ loginToken, actorToken, json: body !== undefined })

  try {
    const response = await fetchImpl(buildCustomerServerUrl(normalizedBaseUrl, path), {
      method,
      headers,
      signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!expected.includes(response.status)) {
      const detail = typeof data?.error === "string" ? data.error : text
      throw new Error(`${method} ${path} 返回 ${response.status}${detail ? `：${detail}` : ""}`)
    }
    return { status: response.status, data, text }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${method} ${path} 超时`)
    }
    if (error instanceof Error && error.message.startsWith(`${method} ${path} 返回`)) {
      throw error
    }
    throw new Error(`${method} ${path} 网络请求失败：${error?.message || error}`)
  } finally {
    clearTimeout(timeout)
  }
}

export async function runCustomerDesktopSmoke({
  customer = "",
  serverUrl = "",
  protocolVersion = process.env.CRAZOR_DELIVERY_PROTOCOL_VERSION || DEFAULT_PROTOCOL_VERSION,
  loginToken = process.env.CRAZOR_DESKTOP_SMOKE_LOGIN_TOKEN || process.env.CRAZOR_CUSTOMER_LOGIN_TOKEN || "",
  accessCode = process.env.CRAZOR_DESKTOP_SMOKE_ACCESS_CODE || process.env.CRAZOR_CUSTOMER_ACCESS_CODE || "",
  actorToken = process.env.CRAZOR_DESKTOP_SMOKE_ACTOR_TOKEN || process.env.CRAZOR_SMOKE_TOKEN || "",
  timeoutMs = Number(process.env.CRAZOR_DESKTOP_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  chatTimeoutMs = Number(process.env.CRAZOR_DESKTOP_SMOKE_CHAT_TIMEOUT_MS || Math.max(timeoutMs, DEFAULT_CHAT_TIMEOUT_MS)),
  liveChat = process.env.CRAZOR_DESKTOP_SMOKE_LIVE_CHAT === undefined
    ? !truthy(process.env.CRAZOR_DESKTOP_SMOKE_SKIP_LIVE_CHAT)
    : truthy(process.env.CRAZOR_DESKTOP_SMOKE_LIVE_CHAT),
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl)
  if (!normalizedServerUrl) {
    throw new Error("客户桌面烟测需要有效的 http:// 或 https:// 后端地址")
  }
  const expectedCustomer = normalizeText(customer)
  const summary = []
  const warnings = []
  let chatReply = ""
  let webEntrypointChecked = false
  const webAssetChecks = []
  let activeLoginToken = String(loginToken || "").trim()
  let activeActorToken = String(actorToken || "").trim()
  let accessCodeLoginChecked = false
  let accessActorTokenChecked = false
  const businessEntryChecks = []
  let businessWriteChecked = false
  let portalMode = false
  let customerPortalChecked = false
  let internalAdminBlockedChecked = false
  let internalWriteBlockedChecked = false

  async function step(name, fn) {
    logger.log(`- ${name}...`)
    const result = await fn()
    summary.push(name)
    return result
  }

  logger.log(`Crazor 客户桌面远程烟测开始：${normalizedServerUrl}`)

  await step("托管后端健康检查", async () => {
    await requestDesktopJson(normalizedServerUrl, "/api/health", {
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
  })

  await step("网页版统一入口检查", async () => {
    const web = await requestDesktopText(normalizedServerUrl, "/", {
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
    if (!validateWebEntrypointHtml(web.text)) {
      throw new Error("Web 统一入口未返回 Crazor 前端 HTML，请确认 serverUrl 指向 crazor-web 网关而不是裸后端 API")
    }
    const assets = extractWebEntrypointAssetPaths(web.text, normalizedServerUrl)
    if (assets.length === 0) {
      throw new Error("Web 统一入口未声明可验证的前端静态资源，请确认生产构建产物已部署")
    }
    for (const asset of assets) {
      const response = await requestDesktopText(normalizedServerUrl, asset.path, {
        timeoutMs,
        fetchImpl,
        expected: [200],
        accept: asset.type === "style" ? "text/css,*/*" : "text/javascript,application/javascript,*/*",
      })
      if (!validateWebAssetResponse(asset, response.text, response.contentType)) {
        throw new Error(`${asset.label} ${asset.path} 未返回有效前端资源`)
      }
      webAssetChecks.push({
        path: asset.path,
        type: asset.type,
        status: "ok",
      })
    }
    webEntrypointChecked = true
  })

  const readinessResult = await step("客户交付身份预检", async () => {
    if (expectedCustomer) {
      const result = await verifyCustomerServer({
        customer: expectedCustomer,
        serverUrl: normalizedServerUrl,
        protocolVersion,
        timeoutMs,
        fetchImpl,
      })
      if (!result.ok) {
        throw new Error(`客户交付身份预检失败：\n${result.errors.map((item) => `- ${item}`).join("\n")}`)
      }
      warnings.push(...result.warnings)
      return result
    }

    const readiness = await requestDesktopJson(normalizedServerUrl, "/api/delivery/readiness", {
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
    const status = readiness.data?.status
    if (!["ready", "degraded", "blocked"].includes(status)) {
      throw new Error(`交付自检返回未知状态: ${status || "空"}`)
    }
    if (status === "blocked") {
      const issues = summarizeReadinessIssues(readiness.data)
      throw new Error(`托管后端交付自检状态为 blocked${issues.length ? `：${issues.join("；")}` : ""}`)
    }
    if (status === "degraded") {
      const issues = summarizeReadinessIssues(readiness.data)
      warnings.push(`托管后端交付自检状态为 degraded，客户可启动但需要关注警告项${issues.length ? `：${issues.join("；")}` : ""}`)
    }
    return readiness.data
  })

  const authStatus = await step("客户登录门禁检查", async () => {
    const status = await requestDesktopJson(normalizedServerUrl, "/api/auth/status", {
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
    if (status.data?.loginRequired && !activeLoginToken && String(accessCode || "").trim()) {
      const login = await requestDesktopJson(normalizedServerUrl, "/api/auth/access-code", {
        method: "POST",
        timeoutMs,
        fetchImpl,
        expected: [200],
        body: { code: String(accessCode || "").trim() },
      })
      activeLoginToken = String(login.data?.token || "").trim()
      if (!activeLoginToken) {
        throw new Error("客户访问码登录成功响应未返回 JWT")
      }
      const issuedActorToken = String(login.data?.actor_token || login.data?.actorToken || "").trim()
      if (!activeActorToken && issuedActorToken) {
        activeActorToken = issuedActorToken
        accessActorTokenChecked = true
      }
      accessCodeLoginChecked = true
    }
    const me = await requestDesktopJson(normalizedServerUrl, "/api/auth/me", {
      loginToken: activeLoginToken,
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
    portalMode = Boolean(me.data?.portalMode)
    const gate = evaluateDesktopLoginGate(status.data, me.data, { loginToken: activeLoginToken })
    if (!gate.ok) {
      throw new Error("已提供登录 token，但 /api/auth/me 未返回登录态")
    }
    if (gate.needsInteractiveLogin) {
      warnings.push("托管后端要求登录；未提供登录 token，本次只验证客户端会被登录门禁拦截")
    }
    return { status: status.data, me: me.data, gate }
  })

  await step("业务上下文入口检查", async () => {
    if (authStatus.gate.needsInteractiveLogin) {
      await requestDesktopJson(normalizedServerUrl, "/api/crazor/context?limit=1", {
        timeoutMs,
        fetchImpl,
        expected: [401],
      })
      return
    }

    if (portalMode) {
      const portal = await requestDesktopJson(normalizedServerUrl, "/api/customer/portal", {
        loginToken: activeLoginToken,
        actorToken: activeActorToken,
        timeoutMs,
        fetchImpl,
        expected: [200],
      })
      if (!validateCustomerPortalPayload(portal.data)) {
        throw new Error("客户工作台返回结构不符合预期")
      }
      customerPortalChecked = true
      businessEntryChecks.push({
        id: "customer-portal",
        label: "客户工作台",
        path: "/api/customer/portal",
        status: "ok",
      })

      await requestDesktopJson(normalizedServerUrl, "/api/crazor/context?limit=1", {
        loginToken: activeLoginToken,
        actorToken: activeActorToken,
        timeoutMs,
        fetchImpl,
        expected: [401, 403],
      })
      internalAdminBlockedChecked = true
      return
    }

    await requestDesktopJson(normalizedServerUrl, "/api/crazor/context?limit=1", {
      loginToken: activeLoginToken,
      actorToken: activeActorToken,
      timeoutMs,
      fetchImpl,
      expected: [200],
    })

    for (const entrypoint of BUSINESS_ENTRYPOINTS) {
      const response = await requestDesktopJson(normalizedServerUrl, entrypoint.path, {
        loginToken: activeLoginToken,
        actorToken: activeActorToken,
        timeoutMs,
        fetchImpl,
        expected: [200],
      })
      if (!validateBusinessEntrypointShape(entrypoint, response.data)) {
        throw new Error(`${entrypoint.label} 返回结构不符合预期`)
      }
      businessEntryChecks.push({
        id: entrypoint.id,
        label: entrypoint.label,
        path: entrypoint.path,
        status: "ok",
      })
    }
  })

  await step("业务写入权限检查", async () => {
    if (authStatus.gate.needsInteractiveLogin) return

    if (portalMode) {
      await requestDesktopJson(normalizedServerUrl, "/api/crazor/contacts", {
        method: "POST",
        loginToken: activeLoginToken,
        actorToken: activeActorToken,
        timeoutMs,
        fetchImpl,
        expected: [401, 403],
        body: {
          name: `Crazor 客户越权探测 ${Date.now()}`,
          status: "lead",
        },
      })
      internalWriteBlockedChecked = true
      return
    }

    const created = await requestDesktopJson(normalizedServerUrl, "/api/crazor/contacts", {
      method: "POST",
      loginToken: activeLoginToken,
      actorToken: activeActorToken,
      timeoutMs,
      fetchImpl,
      expected: [200, 201],
      body: {
        name: `Crazor 交付验收 ${Date.now()}`,
        status: "lead",
        notes: "客户交付自动验收创建，验证后删除。",
      },
    })
    const contactId = normalizeText(created.data?.id)
    if (!contactId) {
      throw new Error("业务写入接口返回成功，但未返回客户记录 ID")
    }

    await requestDesktopJson(normalizedServerUrl, `/api/crazor/contacts/${encodeURIComponent(contactId)}`, {
      method: "DELETE",
      loginToken: activeLoginToken,
      actorToken: activeActorToken,
      timeoutMs,
      fetchImpl,
      expected: [200, 204],
    })
    businessWriteChecked = true
  })

  await step("对话能力入口检查", async () => {
    const provider = await requestDesktopJson(normalizedServerUrl, "/api/agent/provider", {
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
    const capabilities = provider.data?.capability_ids || []
    if (!Array.isArray(capabilities) || !capabilities.includes("gateway.chat_completions")) {
      throw new Error("Agent Provider 未声明 gateway.chat_completions 对话能力")
    }

    if (authStatus.gate.needsInteractiveLogin) return

    await requestDesktopJson(normalizedServerUrl, "/api/models", {
      loginToken: activeLoginToken,
      actorToken: activeActorToken,
      timeoutMs,
      fetchImpl,
      expected: [200],
    })

    if (liveChat) {
      const chat = await requestDesktopJson(normalizedServerUrl, "/api/chat/completions", {
        method: "POST",
        loginToken: activeLoginToken,
        actorToken: activeActorToken,
        timeoutMs: chatTimeoutMs,
        fetchImpl,
        expected: [200],
        body: {
          model: "hermes-agent",
          stream: false,
          messages: [{ role: "user", content: "请只回复 OK" }],
        },
      })
      chatReply = extractChatCompletionText(chat.data)
      if (!chatReply) {
        throw new Error("对话接口返回成功，但未返回可展示的 assistant 文本")
      }
    } else {
      warnings.push("已跳过真实对话响应检查；本次只验证对话入口和模型列表")
    }
  })

  for (const warning of warnings) {
    logger.warn(`警告: ${warning}`)
  }

  logger.log("Crazor 客户桌面远程烟测完成。")
  return {
    ok: true,
    customer: expectedCustomer,
    serverUrl: normalizedServerUrl,
    protocolVersion: normalizeText(protocolVersion),
    readinessStatus: readinessResult?.status || "",
    webEntrypointChecked,
    webAssetChecks,
    loginRequired: authStatus.gate.loginRequired,
    interactiveLoginRequired: authStatus.gate.needsInteractiveLogin,
    accessCodeLoginChecked,
    accessActorTokenChecked,
    portalMode,
    customerPortalChecked,
    internalAdminBlockedChecked,
    internalWriteBlockedChecked,
    businessEntryChecks,
    businessWriteChecked,
    liveChatChecked: Boolean(chatReply),
    chatReplyPreview: chatReply.slice(0, 80),
    warnings,
    summary,
  }
}

async function main() {
  const customer = process.argv[2] || process.env.CRAZOR_DELIVERY_CUSTOMER || ""
  const serverUrl = process.argv[3] || process.env.CRAZOR_PUBLIC_BASE_URL || process.env.CRAZOR_SMOKE_BASE_URL || "http://127.0.0.1:5173"
  await runCustomerDesktopSmoke({ customer, serverUrl })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`客户桌面远程烟测失败: ${error?.message || error}`)
    process.exit(1)
  })
}
