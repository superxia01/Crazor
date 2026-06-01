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
    const response = await fetchImpl(new URL(path, `${normalizedBaseUrl}/`).toString(), {
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
      throw new Error("托管后端交付自检状态为 blocked")
    }
    if (status === "degraded") {
      warnings.push("托管后端交付自检状态为 degraded，客户可启动但需要关注警告项")
    }
    return readiness.data
  })

  const authStatus = await step("客户登录门禁检查", async () => {
    const status = await requestDesktopJson(normalizedServerUrl, "/api/auth/status", {
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
    const me = await requestDesktopJson(normalizedServerUrl, "/api/auth/me", {
      loginToken,
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
    const gate = evaluateDesktopLoginGate(status.data, me.data, { loginToken })
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

    await requestDesktopJson(normalizedServerUrl, "/api/crazor/context?limit=1", {
      loginToken,
      actorToken,
      timeoutMs,
      fetchImpl,
      expected: [200],
    })
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
      loginToken,
      actorToken,
      timeoutMs,
      fetchImpl,
      expected: [200],
    })

    if (liveChat) {
      const chat = await requestDesktopJson(normalizedServerUrl, "/api/chat/completions", {
        method: "POST",
        loginToken,
        actorToken,
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
    loginRequired: authStatus.gate.loginRequired,
    interactiveLoginRequired: authStatus.gate.needsInteractiveLogin,
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
