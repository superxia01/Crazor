#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(process.env.CRAZOR_SMOKE_BASE_URL || "http://127.0.0.1:5173")
const skipHermes = truthy(process.env.CRAZOR_SMOKE_SKIP_HERMES)
const strictAuth = truthy(process.env.CRAZOR_SMOKE_STRICT_AUTH)
let authToken = (process.env.CRAZOR_SMOKE_TOKEN || "").trim()

const cleanupStack = []
const summary = []
let rpcId = 1
let mcpSessionId = ""
let mcpAgentToken = ""

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "")
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase())
}

function unique(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nextWeek() {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
}

function urlFor(path) {
  return new URL(path, `${baseUrl}/`).toString()
}

function query(path, params) {
  const qs = new URLSearchParams(params)
  return `${path}?${qs.toString()}`
}

function log(message) {
  console.log(message)
}

function assert(condition, message, detail) {
  if (condition) return
  const suffix = detail === undefined ? "" : `\n${JSON.stringify(detail, null, 2)}`
  throw new Error(`${message}${suffix}`)
}

async function request(path, options = {}) {
  const method = options.method || "GET"
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  }
  const shouldAuth = options.auth !== false
  if (shouldAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const fetchOptions = { method, headers }
  if (options.body !== undefined) {
    if (typeof FormData !== "undefined" && options.body instanceof FormData) {
      fetchOptions.body = options.body
    } else {
      headers["Content-Type"] = "application/json"
      fetchOptions.body = JSON.stringify(options.body)
    }
  }

  let response
  try {
    response = await fetch(urlFor(path), fetchOptions)
  } catch (error) {
    throw new Error(`${method} ${path} 网络请求失败：${error?.message || error}`)
  }

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  const expected = options.expect || [200, 201]
  if (!expected.includes(response.status)) {
    const message = typeof data?.error === "string" ? data.error : text
    throw new Error(`${method} ${path} 返回 ${response.status}：${message}`)
  }

  return { status: response.status, data, text }
}

async function step(name, fn) {
  process.stdout.write(`- ${name}... `)
  const result = await fn()
  summary.push(name)
  console.log("通过")
  return result
}

async function waitForHealth() {
  let lastError = null
  for (let i = 0; i < 60; i += 1) {
    try {
      return await request("/api/health", { auth: false })
    } catch (error) {
      lastError = error
      await sleep(500)
    }
  }
  throw lastError || new Error("/api/health 等待超时")
}

function trackCleanup(label, fn) {
  cleanupStack.push({ label, fn })
}

async function deleteIfExists(path) {
  await request(path, { method: "DELETE", expect: [200, 204, 404] })
}

async function runCleanup() {
  if (cleanupStack.length === 0) return
  log("\n清理临时数据：")
  const errors = []
  for (const item of cleanupStack.reverse()) {
    try {
      await item.fn()
      log(`  - ${item.label}：完成`)
    } catch (error) {
      errors.push(`${item.label}: ${error?.message || error}`)
      log(`  - ${item.label}：失败`)
    }
  }
  if (errors.length > 0) {
    throw new Error(`临时数据清理失败：\n${errors.join("\n")}`)
  }
}

async function bootstrapAuth() {
  if (authToken) {
    const me = await request("/api/crazor/identity/me")
    assert(me.data?.actor_id, "CRAZOR_SMOKE_TOKEN 无法解析为有效身份", me.data)
    return { memberId: "", tokenSource: "env" }
  }

  const memberName = unique("烟测管理员")
  let member
  try {
    member = await request("/api/crazor/identity/members", {
      method: "POST",
      auth: false,
      body: {
        name: memberName,
        actor_type: "human",
        role: "admin",
        status: "active",
      },
    })
  } catch (error) {
    throw new Error(
      `无法创建烟测管理员。若目标环境已开启写入认证且已有 active token，请设置 CRAZOR_SMOKE_TOKEN。\n${error?.message || error}`,
    )
  }

  const memberId = member.data.id
  trackCleanup("烟测管理员身份", () => deleteIfExists(`/api/crazor/identity/members/${encodeURIComponent(memberId)}`))

  const token = await request("/api/crazor/identity/tokens", {
    method: "POST",
    auth: false,
    body: {
      member_id: memberId,
      token_type: "api",
      label: "docker-smoke-admin",
      scopes: "*",
    },
  })

  authToken = token.data.token
  assert(authToken, "创建烟测管理员 token 后未返回明文 token", token.data)
  return { memberId, tokenSource: "bootstrap" }
}

async function createViewerToken() {
  const member = await request("/api/crazor/identity/members", {
    method: "POST",
    body: {
      name: unique("烟测只读身份"),
      actor_type: "human",
      role: "viewer",
      status: "active",
    },
  })
  const memberId = member.data.id
  trackCleanup("烟测只读身份", () => deleteIfExists(`/api/crazor/identity/members/${encodeURIComponent(memberId)}`))

  const token = await request("/api/crazor/identity/tokens", {
    method: "POST",
    body: {
      member_id: memberId,
      token_type: "api",
      label: "docker-smoke-viewer",
      scopes: "read:*",
    },
  })
  assert(token.data?.token, "只读 token 未返回明文 token", token.data)
  return token.data.token
}

async function requestWithToken(path, token, options = {}) {
  const original = authToken
  authToken = token
  try {
    return await request(path, options)
  } finally {
    authToken = original
  }
}

async function createAgentToken() {
  const member = await request("/api/crazor/identity/members", {
    method: "POST",
    body: {
      name: unique("烟测Agent"),
      actor_type: "agent",
      role: "member",
      status: "active",
    },
  })
  const memberId = member.data.id
  trackCleanup("烟测 Agent 身份", () => deleteIfExists(`/api/crazor/identity/members/${encodeURIComponent(memberId)}`))

  const token = await request("/api/crazor/identity/tokens", {
    method: "POST",
    body: {
      member_id: memberId,
      token_type: "agent",
      label: "docker-smoke-agent",
      scopes: "contact:create read:*",
    },
  })
  assert(token.data?.token, "Agent token 未返回明文 token", token.data)
  return token.data.token
}

async function mcpRpc(method, params = undefined, options = {}) {
  const token = options.auth === false ? "" : (options.token || mcpAgentToken || authToken)
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (mcpSessionId) headers["Mcp-Session-Id"] = mcpSessionId

  const body = {
    jsonrpc: "2.0",
    id: options.id || rpcId++,
    method,
  }
  if (params !== undefined) body.params = params

  const response = await fetch(urlFor("/mcp"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const sessionId = response.headers.get("Mcp-Session-Id")
  if (sessionId) mcpSessionId = sessionId

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  const expected = options.expect || [200]
  if (!expected.includes(response.status)) {
    throw new Error(`POST /mcp ${method} 返回 ${response.status}：${text}`)
  }
  if (data?.error) {
    throw new Error(`MCP ${method} 返回错误：${JSON.stringify(data.error)}`)
  }
  return { status: response.status, data, text, sessionId }
}

async function mcpNotification(method) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (mcpAgentToken) headers.Authorization = `Bearer ${mcpAgentToken}`
  if (mcpSessionId) headers["Mcp-Session-Id"] = mcpSessionId

  const response = await fetch(urlFor("/mcp"), {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method }),
  })
  const sessionId = response.headers.get("Mcp-Session-Id")
  if (sessionId) mcpSessionId = sessionId
  assert(response.status === 202, `MCP ${method} 通知未返回 202`, { status: response.status, body: await response.text() })
}

function parseMcpToolResult(response, toolName) {
  assert(!response.data?.result?.isError, `MCP ${toolName} 工具返回 isError`, response.data)
  const text = response.data?.result?.content?.[0]?.text
  assert(text, `MCP ${toolName} 工具未返回文本结果`, response.data)
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`MCP ${toolName} 工具结果不是 JSON：${text}`)
  }
}

async function callMcpTool(name, args = {}) {
  const response = await mcpRpc("tools/call", {
    name,
    arguments: args,
  })
  return parseMcpToolResult(response, name)
}

async function main() {
  log(`Crazor Docker MVP 烟测开始：${baseUrl}`)

  await step("后端健康检查", async () => {
    const health = await waitForHealth()
    assert(health.status === 200, "/api/health 未返回 200", health.data)
  })

  await step("客户交付自检入口", async () => {
    const readiness = await request("/api/delivery/readiness", { auth: false })
    assert(["ready", "degraded", "blocked"].includes(readiness.data?.status), "交付自检未返回有效状态", readiness.data)
    const checks = readiness.data?.checks || []
    assert(Array.isArray(checks), "交付自检未返回检查项列表", readiness.data)
    for (const id of ["api", "delivery-identity", "auth", "agent-gateway", "chat-api", "model-config", "business-data", "knowledge-vault"]) {
      assert(checks.some((check) => check.id === id), `交付自检缺少 ${id} 检查项`, readiness.data)
    }
    if (!skipHermes) {
      assert(readiness.data.status !== "blocked", "完整 Docker + Hermes 部署不应被交付自检判定为阻塞", readiness.data)
    }
  })

  await step("Agent Provider Adapter 状态", async () => {
    const provider = await request("/api/agent/provider", { auth: false })
    assert(provider.data?.id, "Agent Provider 未返回 provider id", provider.data)
    assert(Array.isArray(provider.data?.capability_ids), "Agent Provider 未返回能力列表", provider.data)
    assert(provider.data.capability_ids.includes("gateway.chat_completions"), "Agent Provider 未声明对话能力", provider.data)
    assert(provider.data.capability_ids.includes("crazor.mcp"), "Agent Provider 未声明 Crazor MCP 能力", provider.data)
    assert(typeof provider.data?.runtime?.gateway?.available === "boolean", "Agent Provider 未返回网关运行状态", provider.data)
    if (!skipHermes) {
      assert(provider.data.hermes_compatible === true, "默认部署应声明 Hermes 兼容 Provider", provider.data)
      assert(provider.data.capability_ids.includes("dashboard.status"), "Hermes Provider 未声明控制台状态能力", provider.data)
      assert(typeof provider.data?.runtime?.dashboard?.available === "boolean", "Hermes Provider 未返回控制台运行状态", provider.data)
    }
  })

  if (!skipHermes) {
    await step("Hermes Provider 状态代理", async () => {
      const status = await request("/api/status", { auth: false })
      assert(status.status === 200, "/api/status 未返回 200", status.data)

      const version = await request("/api/hermes/version", { auth: false })
      assert(version.status === 200, "/api/hermes/version 未返回 200", version.data)
      assert(version.data?.platform === "hermes-agent", "Hermes 版本代理未返回 provider 平台", version.data)
      assert(typeof version.data?.version === "string", "Hermes 版本代理未返回版本字段", version.data)
    })
  }

  await step("准备可审计烟测身份", async () => {
    const auth = await bootstrapAuth()
    const me = await request("/api/crazor/identity/me")
    assert(me.data?.actor_id, "当前 token 未能派生 actor", me.data)
    assert(auth.tokenSource === "env" || me.data.actor_id === auth.memberId, "派生 actor 与烟测身份不一致", me.data)
  })

  await step("MCP StreamableHTTP Agent 工具链路", async () => {
    mcpAgentToken = await createAgentToken()
    const init = await mcpRpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "crazor-smoke", version: "1.0.0" },
    }, { token: mcpAgentToken })
    assert(mcpSessionId, "MCP initialize 未返回 Mcp-Session-Id", init.data)
    assert(init.data?.result?.serverInfo?.name === "crazor-mcp", "MCP initialize 未返回 Crazor 服务信息", init.data)

    await mcpNotification("notifications/initialized")

    const list = await mcpRpc("tools/list")
    const tools = list.data?.result?.tools || []
    assert(tools.some((tool) => tool.name === "create_contact"), "MCP tools/list 缺少 create_contact", tools)
    assert(tools.some((tool) => tool.name === "get_task_reminders"), "MCP tools/list 缺少 get_task_reminders", tools)
    assert(tools.some((tool) => tool.name === "list_docs"), "MCP tools/list 缺少 list_docs", tools)
    assert(
      !tools.some((tool) => ["getbiji_sync", "getbiji_status", "getbiji_force_full"].includes(tool.name)),
      "MCP tools/list 不应暴露 Get 笔记占位工具",
      tools,
    )

    const docsTree = await callMcpTool("list_docs", { scope: "knowledge" })
    assert(Array.isArray(docsTree?.folders), "MCP list_docs 未返回 folders 数组", docsTree)
    assert(Array.isArray(docsTree?.notes), "MCP list_docs 未返回 notes 数组", docsTree)
    assert(docsTree.folders.length > 0, "MCP list_docs 未返回知识库目录，Agent 无法发现文档路径", docsTree)
    const folder = docsTree.folders.find((item) => item.name === "20-业务流程") || docsTree.folders[0]
    const folderDocs = await callMcpTool("list_docs", { scope: "knowledge", folder_id: folder.id })
    assert(Array.isArray(folderDocs?.folders), "MCP list_docs(folder_id) 未返回子目录数组", folderDocs)
    assert(Array.isArray(folderDocs?.notes), "MCP list_docs(folder_id) 未返回文档数组", folderDocs)

    const mcpContact = await callMcpTool("create_contact", {
      name: unique("烟测MCP客户"),
      company: "CRAZYAIGC MCP 烟测公司",
      source: "mcp-smoke",
      stage: "新线索",
    })
    assert(mcpContact?.id, "MCP create_contact 未返回客户 ID", mcpContact)
    trackCleanup("烟测 MCP 客户", () => deleteIfExists(`/api/crazor/contacts/${encodeURIComponent(mcpContact.id)}`))

    const logs = await request(query("/api/crazor/audit-logs", { entity: "contact", entity_id: mcpContact.id, limit: "20" }))
    assert(
      logs.data.some((item) => item.action === "create" && item.source === "agent-token"),
      "MCP create_contact 未记录 agent-token 审计来源",
      logs.data,
    )
  })

  await step("业务只读边界探测", async () => {
    const probe = await request("/api/crazor/contacts", { auth: false, expect: [200, 401] })
    if (probe.status === 401) {
      assert(probe.data?.required_scope === "contact:read", "业务只读严格模式返回的 required_scope 不正确", probe.data)
    } else {
      assert(!strictAuth, "严格认证模式下匿名业务读取仍然放行", probe.data)
      assert(Array.isArray(probe.data), "默认业务读取未返回数组", probe.data)
    }
  })

  if (strictAuth) {
    await step("严格认证匿名写入边界", async () => {
      const anonymousWrite = await request("/api/crazor/contacts", {
        method: "POST",
        auth: false,
        body: { name: unique("严禁匿名客户"), source: "strict-smoke" },
        expect: [401, 403, 201],
      })
      if (anonymousWrite.data?.id) {
        trackCleanup("误放行匿名客户", () => deleteIfExists(`/api/crazor/contacts/${encodeURIComponent(anonymousWrite.data.id)}`))
      }
      assert(
        anonymousWrite.status === 401,
        "严格认证模式下匿名 REST 写入未返回 401",
        anonymousWrite.data,
      )
      assert(anonymousWrite.data?.required_scope === "contact:create", "匿名 REST 写入 required_scope 不正确", anonymousWrite.data)

      const mcpAnonymous = await mcpRpc("tools/call", {
        name: "create_contact",
        arguments: { name: unique("严禁匿名MCP客户"), source: "strict-smoke" },
      }, { auth: false })
      if (!mcpAnonymous.data?.result?.isError) {
        const created = parseMcpToolResult(mcpAnonymous, "create_contact")
        if (created?.id) {
          trackCleanup("误放行匿名 MCP 客户", () => deleteIfExists(`/api/crazor/contacts/${encodeURIComponent(created.id)}`))
        }
      }
      assert(mcpAnonymous.data?.result?.isError === true, "严格认证模式下匿名 MCP 写入未被拒绝", mcpAnonymous.data)
      assert(JSON.stringify(mcpAnonymous.data).includes("contact:create"), "匿名 MCP 写入拒绝信息缺少 contact:create", mcpAnonymous.data)
    })
  }

  await step("只读 token 可访问业务数据", async () => {
    const viewerToken = await createViewerToken()
    const contacts = await requestWithToken("/api/crazor/contacts", viewerToken)
    const analytics = await requestWithToken("/api/crazor/analytics/overview", viewerToken)
    const context = await requestWithToken("/api/crazor/context?limit=1", viewerToken)
    assert(Array.isArray(contacts.data), "只读 token 未能读取客户列表", contacts.data)
    assert(analytics.data?.contacts && analytics.data?.projects, "只读 token 未能读取分析概览", analytics.data)
    assert(Array.isArray(context.data?.items), "只读 token 未能读取 Unified Context", context.data)
  })

  const marker = unique("smoke")
  const contactName = `烟测客户-${marker}`
  const todayDate = today()

  let contact
  let followUp
  let contactDoc
  let project
  let task
  let delivery
  let deliveryPlan
  let channel
  let transaction
  let contentPiece
  let contentNote

  await step("客户 Case 基础链路", async () => {
    contact = (await request("/api/crazor/contacts", {
      method: "POST",
      body: {
        name: contactName,
        company: "CRAZYAIGC 烟测公司",
        stage: "新线索",
        source: "docker-smoke",
        level: "A",
        project_type: "企业培训",
        budget_range: "1-5万",
      },
    })).data
    trackCleanup("烟测客户", () => deleteIfExists(`/api/crazor/contacts/${encodeURIComponent(contact.id)}`))

    const updated = await request(`/api/crazor/contacts/${encodeURIComponent(contact.id)}`, {
      method: "PATCH",
      body: { stage: "跟进中", next_follow_up: "烟测下一步" },
    })
    assert(updated.data?.stage === "跟进中", "客户阶段更新失败", updated.data)
  })

  await step("跟进提醒处理链路", async () => {
    followUp = (await request("/api/crazor/follow-ups", {
      method: "POST",
      body: {
        contact_id: contact.id,
        date: todayDate,
        method: "微信",
        content: `烟测跟进 ${marker}`,
        next_step: "安排复盘",
        status: "待跟进",
      },
    })).data
    trackCleanup("烟测跟进", () => deleteIfExists(`/api/crazor/follow-ups/${encodeURIComponent(followUp.id)}`))

    const reminders = await request("/api/crazor/follow-up-reminders")
    assert(reminders.data.some((item) => item.id === followUp.id), "新建跟进未进入待处理提醒", reminders.data)

    await request(`/api/crazor/follow-ups/${encodeURIComponent(followUp.id)}`, {
      method: "PATCH",
      body: { status: "已完成", date: todayDate },
    })
    const after = await request("/api/crazor/follow-up-reminders")
    assert(!after.data.some((item) => item.id === followUp.id), "完成后的跟进仍在提醒列表", after.data)
  })

  await step("客户文档搜索与附件链路", async () => {
    contactDoc = (await request(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/docs`, {
      method: "POST",
      body: {
        filename: `烟测需求-${marker}.md`,
        contactName,
        content: `# 烟测需求\n\n唯一关键词：${marker}`,
      },
    })).data
    if (contactDoc.folder_id) {
      trackCleanup("烟测客户文档目录", () => deleteIfExists(query("/api/crazor/docs/knowledge/folders-ops", { id: contactDoc.folder_id })))
    }
    trackCleanup("烟测客户文档", () => deleteIfExists(query("/api/crazor/docs/knowledge/notes-ops", { id: contactDoc.id })))

    const search = await request(query(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/docs/search`, { q: marker }))
    assert(search.data.some((item) => item.id === contactDoc.id), "客户文档搜索未命中新建文档", search.data)

    const note = await request(query("/api/crazor/docs/knowledge/notes-ops", { id: contactDoc.id }))
    assert(String(note.data?.content || "").includes(marker), "客户文档正文读取失败", note.data)

    const form = new FormData()
    const fileContent = `smoke attachment ${marker}`
    form.append("file", new Blob([fileContent], { type: "text/plain" }), `smoke-${marker}.txt`)
    const attachment = (await request(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/attachments`, {
      method: "POST",
      body: form,
    })).data
    trackCleanup("烟测客户附件", () => deleteIfExists(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/attachments/${encodeURIComponent(attachment.name)}`))

    const preview = await request(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/attachments/${encodeURIComponent(attachment.name)}/preview`)
    assert(preview.data?.previewable === true && String(preview.data?.content || "").includes(marker), "附件文本预览失败", preview.data)
  })

  await step("渠道、成交和客户关联链路", async () => {
    channel = (await request("/api/crazor/channels", {
      method: "POST",
      body: {
        name: `烟测渠道-${marker}`,
        contact_person: "烟测渠道联系人",
        status: "活跃",
        rating: "潜力",
      },
    })).data
    trackCleanup("烟测渠道", () => deleteIfExists(`/api/crazor/channels/${encodeURIComponent(channel.id)}`))

    await request(`/api/crazor/channels/${encodeURIComponent(channel.id)}/referrals`, {
      method: "POST",
      body: {
        contact_id: contact.id,
        product_type: "企业培训",
        deal_amount: 1200,
        date: todayDate,
      },
    })
    const contactChannels = await request(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/channels`)
    assert(contactChannels.data.some((item) => item.channel_id === channel.id), "客户侧未读回渠道转介绍", contactChannels.data)

    transaction = (await request("/api/crazor/transactions", {
      method: "POST",
      body: {
        contact_id: contact.id,
        type: "income",
        amount: 1200,
        description: `烟测成交 ${marker}`,
        product_type: "企业培训",
        date: todayDate,
      },
    })).data
    trackCleanup("烟测财务流水", () => deleteIfExists(`/api/crazor/transactions/${encodeURIComponent(transaction.id)}`))

    const patched = await request(`/api/crazor/transactions/${encodeURIComponent(transaction.id)}`, {
      method: "PATCH",
      body: { invoice_status: "pending" },
    })
    assert(patched.data?.invoice_status === "pending", "财务流水更新失败", patched.data)
  })

  await step("项目任务与任务提醒链路", async () => {
    project = (await request("/api/crazor/projects", {
      method: "POST",
      body: {
        name: `烟测项目-${marker}`,
        description: "Docker MVP 烟测项目",
        contact_id: contact.id,
        budget: 1200,
      },
    })).data
    trackCleanup("烟测项目", () => deleteIfExists(`/api/crazor/projects/${encodeURIComponent(project.id)}`))

    task = (await request("/api/crazor/tasks", {
      method: "POST",
      body: {
        project_id: project.id,
        title: `烟测任务-${marker}`,
        priority: "high",
        status: "todo",
        due_date: todayDate,
      },
    })).data
    trackCleanup("烟测任务", () => deleteIfExists(`/api/crazor/tasks/${encodeURIComponent(task.id)}`))

    const byContact = await request(query("/api/crazor/tasks", { contact_id: contact.id }))
    assert(byContact.data.some((item) => item.id === task.id), "按客户未读回关联项目任务", byContact.data)

    const reminders = await request("/api/crazor/task-reminders")
    assert(reminders.data.some((item) => item.id === task.id), "今日到期任务未进入任务提醒", reminders.data)

    const mcpReminders = await callMcpTool("get_task_reminders", { limit: 50 })
    assert(Array.isArray(mcpReminders), "MCP get_task_reminders 未返回数组", mcpReminders)
    assert(mcpReminders.some((item) => item.id === task.id), "MCP get_task_reminders 未读到今日到期任务", mcpReminders)

    await request(`/api/crazor/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: { status: "done", due_date: nextWeek() },
    })
    const after = await request("/api/crazor/task-reminders")
    assert(!after.data.some((item) => item.id === task.id), "完成后的任务仍在任务提醒列表", after.data)
  })

  await step("客户交付记录与验收链路", async () => {
    const kickoff = (await request(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/delivery-kickoff`, {
      method: "POST",
      body: {
        project_id: project.id,
        title: `烟测交付-${marker}`,
        delivery_type: "企业培训",
        stage: "交付中",
        acceptance_status: "待客户确认",
        owner: "烟测内部负责人",
        customer_owner: "烟测客户负责人",
        start_date: todayDate,
        due_date: todayDate,
        deliverables: ["培训课件", "交付记录"],
        risks: ["无"],
        remark: `烟测交付闭环 ${marker}`,
      },
    })).data
    delivery = kickoff.delivery
    deliveryPlan = kickoff.plan
    if (deliveryPlan?.folder_id) {
      trackCleanup("烟测交付计划目录", () => deleteIfExists(query("/api/crazor/docs/knowledge/folders-ops", { id: deliveryPlan.folder_id })))
    }
    if (deliveryPlan?.id) {
      trackCleanup("烟测交付计划文档", () => deleteIfExists(query("/api/crazor/docs/knowledge/notes-ops", { id: deliveryPlan.id })))
    }
    trackCleanup("烟测交付记录", () => deleteIfExists(`/api/crazor/deliveries/${encodeURIComponent(delivery.id)}`))

    assert(delivery.contact_id === contact.id, "交付记录未关联客户", delivery)
    assert(delivery.project_id === project.id, "交付记录未关联项目", delivery)
    assert(delivery.handover_doc_id === deliveryPlan?.id, "交付记录未绑定自动生成的计划文档", { delivery, deliveryPlan })
    assert(Array.isArray(delivery.deliverables) && delivery.deliverables.includes("培训课件"), "交付物清单未结构化读回", delivery)

    const planNote = await request(query("/api/crazor/docs/knowledge/notes-ops", { id: deliveryPlan.id }))
    assert(String(planNote.data?.content || "").includes(`烟测交付-${marker}`), "交付计划文档未写入交付标题", planNote.data)
    assert(String(planNote.data?.content || "").includes("## 验收节点"), "交付计划文档缺少验收节点", planNote.data)

    const contactDocs = await request(`/api/crazor/contacts/${encodeURIComponent(contact.id)}/docs`)
    assert(contactDocs.data.some((item) => item.id === deliveryPlan.id), "客户详情未能反查交付计划文档", contactDocs.data)

    const patched = await request(`/api/crazor/deliveries/${encodeURIComponent(delivery.id)}`, {
      method: "PATCH",
      body: {
        stage: "已完成",
        acceptance_status: "已验收",
        accepted_at: todayDate,
      },
    })
    assert(patched.data?.stage === "已完成" && patched.data?.acceptance_status === "已验收", "交付验收状态更新失败", patched.data)

    const byContact = await request(query("/api/crazor/deliveries", { contact_id: contact.id }))
    assert(byContact.data.some((item) => item.id === delivery.id), "按客户未读回交付记录", byContact.data)

    const logs = await request(query("/api/crazor/audit-logs", { entity: "delivery", entity_id: delivery.id, limit: "20" }))
    assert(logs.data.some((item) => item.action === "create" && item.entity === "delivery"), "审计日志未记录交付创建", logs.data)
  })

  await step("内容发布、指标回收和知识正文链路", async () => {
    contentPiece = (await request("/api/crazor/content-pieces", {
      method: "POST",
      body: {
        title: `烟测内容-${marker}`,
        platform: "公众号",
        form: "文章",
        status: "选题中",
        topic_source: "docker-smoke",
      },
    })).data
    trackCleanup("烟测内容作品", () => deleteIfExists(`/api/crazor/content-pieces/${encodeURIComponent(contentPiece.id)}`))

    const published = await request(`/api/crazor/content-pieces/${encodeURIComponent(contentPiece.id)}/publish`, {
      method: "POST",
    })
    assert(published.data?.piece?.status === "已发布", "内容发布状态未回写", published.data)

    const metrics = await request(`/api/crazor/content-pieces/${encodeURIComponent(contentPiece.id)}/metrics`, {
      method: "PATCH",
      body: { views: 88, likes: 6, comments: 2, shares: 1 },
    })
    assert(metrics.data?.piece?.views === 88, "内容指标未回收", metrics.data)

    contentNote = (await request("/api/crazor/docs/knowledge/notes", {
      method: "POST",
      body: {
        title: `烟测内容正文-${marker}`,
        content: `# 内容正文\n\n烟测正文关键词：${marker}`,
      },
    })).data
    trackCleanup("烟测内容正文", () => deleteIfExists(query("/api/crazor/docs/knowledge/notes-ops", { id: contentNote.id })))

    const search = await request(query("/api/crazor/docs/knowledge/search", { q: marker }))
    assert(search.data.some((item) => item.id === contentNote.id), "知识库正文搜索未命中新建内容正文", search.data)

    const linked = await request(`/api/crazor/content-pieces/${encodeURIComponent(contentPiece.id)}`, {
      method: "PATCH",
      body: { doc_id: contentNote.id },
    })
    assert(linked.data?.doc_id === contentNote.id, "内容作品未关联知识正文", linked.data)

    await request(query("/api/crazor/docs/knowledge/notes-ops", { id: contentNote.id }), {
      method: "PATCH",
      body: {
        title: contentNote.title,
        content: `# 内容正文\n\n烟测正文关键词：${marker}\n\n### 指标回收\n- 阅读：88`,
      },
    })
    const note = await request(query("/api/crazor/docs/knowledge/notes-ops", { id: contentNote.id }))
    assert(String(note.data?.content || "").includes("### 指标回收"), "内容复盘模板未写入正文", note.data)
  })

  await step("分析概览与审计日志", async () => {
    const overview = await request("/api/crazor/analytics/overview")
    assert(Array.isArray(overview.data?.followUpReminders), "分析概览缺少 followUpReminders", overview.data)
    assert(Array.isArray(overview.data?.taskReminders), "分析概览缺少 taskReminders", overview.data)
    assert(overview.data?.deliveries && typeof overview.data.deliveries.total === "number", "分析概览缺少 deliveries 统计", overview.data)

    const logs = await request(query("/api/crazor/audit-logs", { entity: "contact", entity_id: contact.id, limit: "20" }))
    assert(logs.data.some((item) => item.action === "create" && item.entity === "contact"), "审计日志未记录客户创建", logs.data)
  })

  await step("Unified Context 上下文聚合入口", async () => {
    const context = await request(query("/api/crazor/context", {
      q: marker,
      contact_id: contact.id,
      types: "contact,project,task,delivery,follow_up,transaction,doc_note,audit_log",
      limit: "50",
    }))
    assert(Array.isArray(context.data?.items), "Unified Context 未返回 items 数组", context.data)
    assert(context.data.items.some((item) => item.type === "contact" && item.id === contact.id), "上下文未包含目标客户", context.data)
    assert(context.data.items.some((item) => item.type === "project" && item.id === project.id), "上下文未包含关联项目", context.data)
    assert(context.data.items.some((item) => item.type === "delivery" && item.id === delivery.id), "上下文未包含交付记录", context.data)
    assert(context.data.items.some((item) => item.type === "doc_note" && item.id === contactDoc.id), "上下文未包含客户需求文档", context.data)
    assert(context.data.items.some((item) => item.type === "audit_log" && item.relations?.entity_id === contact.id), "上下文未包含客户审计事件", context.data)
  })

  await step("AI Employee Runtime 最小运行单元", async () => {
    const employees = await request("/api/crazor/ai-employees")
    assert(Array.isArray(employees.data), "AI Employee Runtime 未返回数字员工列表", employees.data)
    assert(!employees.data.some((item) => item.id === "vault-rules"), "系统级 vault-rules 不应出现在数字员工列表", employees.data)
    const employee = employees.data.find((item) => item.id === "customer-manager") || employees.data[0]
    assert(employee?.id, "AI Employee Runtime 没有可运行数字员工", employees.data)

    const run = await request(`/api/crazor/ai-employees/${encodeURIComponent(employee.id)}/runs`, {
      method: "POST",
      expect: [201],
      body: {
        input: `请基于烟测客户 ${marker} 整理下一步跟进建议`,
        contact_id: contact.id,
        context_limit: 20,
      },
    })
    assert(run.data?.status === "prepared", "AI Employee Runtime 未返回 prepared 状态", run.data)
    assert(run.data?.employee?.id === employee.id, "AI Employee Runtime 返回的 employee 不一致", run.data)
    assert(run.data?.instructions?.system_skill?.id === "vault-rules", "AI Employee Runtime 未加载系统级规则", run.data)
    assert(run.data?.instructions?.employee_skill?.id === employee.id, "AI Employee Runtime 未加载数字员工 skill", run.data)
    assert(run.data?.handoff?.ready_for_agent === true, "AI Employee Runtime 未生成 Agent handoff", run.data)
    assert(
      run.data?.context?.items?.some((item) => item.type === "contact" && item.id === contact.id),
      "AI Employee Runtime 上下文未包含目标客户",
      run.data,
    )

    const logs = await request(query("/api/crazor/audit-logs", { entity: "ai_employee", entity_id: employee.id, limit: "20" }))
    assert(logs.data.some((item) => item.action === "run"), "AI Employee Runtime 未记录 run 审计日志", logs.data)
  })

  log("\n烟测通过：")
  for (const item of summary) {
    log(`  - ${item}`)
  }
}

let failure = null
try {
  await main()
} catch (error) {
  failure = error
  console.error(`\n烟测失败：${error?.message || error}`)
} finally {
  try {
    await runCleanup()
  } catch (error) {
    failure = failure || error
    console.error(`\n清理失败：${error?.message || error}`)
  }
}

if (failure) {
  process.exitCode = 1
} else {
  log("\nCrazor Docker MVP 烟测完成。")
}
