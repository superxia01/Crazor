#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(process.env.CRAZOR_SMOKE_BASE_URL || "http://127.0.0.1:5173")
const skipHermes = truthy(process.env.CRAZOR_SMOKE_SKIP_HERMES)
let authToken = (process.env.CRAZOR_SMOKE_TOKEN || "").trim()

const cleanupStack = []
const summary = []

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

async function main() {
  log(`Crazor Docker MVP 烟测开始：${baseUrl}`)

  await step("后端健康检查", async () => {
    const health = await request("/api/health", { auth: false })
    assert(health.status === 200, "/api/health 未返回 200", health.data)
  })

  if (!skipHermes) {
    await step("Hermes Provider 状态代理", async () => {
      const status = await request("/api/status", { auth: false })
      assert(status.status === 200, "/api/status 未返回 200", status.data)
    })
  }

  await step("准备可审计烟测身份", async () => {
    const auth = await bootstrapAuth()
    const me = await request("/api/crazor/identity/me")
    assert(me.data?.actor_id, "当前 token 未能派生 actor", me.data)
    assert(auth.tokenSource === "env" || me.data.actor_id === auth.memberId, "派生 actor 与烟测身份不一致", me.data)
  })

  await step("业务只读边界探测", async () => {
    const probe = await request("/api/crazor/contacts", { auth: false, expect: [200, 401] })
    if (probe.status === 401) {
      assert(probe.data?.required_scope === "contact:read", "业务只读严格模式返回的 required_scope 不正确", probe.data)
    } else {
      assert(Array.isArray(probe.data), "默认业务读取未返回数组", probe.data)
    }
  })

  await step("只读 token 可访问业务数据", async () => {
    const viewerToken = await createViewerToken()
    const contacts = await requestWithToken("/api/crazor/contacts", viewerToken)
    const analytics = await requestWithToken("/api/crazor/analytics/overview", viewerToken)
    assert(Array.isArray(contacts.data), "只读 token 未能读取客户列表", contacts.data)
    assert(analytics.data?.contacts && analytics.data?.projects, "只读 token 未能读取分析概览", analytics.data)
  })

  const marker = unique("smoke")
  const contactName = `烟测客户-${marker}`
  const todayDate = today()

  let contact
  let followUp
  let contactDoc
  let project
  let task
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

    await request(`/api/crazor/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: { status: "done", due_date: nextWeek() },
    })
    const after = await request("/api/crazor/task-reminders")
    assert(!after.data.some((item) => item.id === task.id), "完成后的任务仍在任务提醒列表", after.data)
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

    const logs = await request(query("/api/crazor/audit-logs", { entity: "contact", entity_id: contact.id, limit: "20" }))
    assert(logs.data.some((item) => item.action === "create" && item.entity === "contact"), "审计日志未记录客户创建", logs.data)
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
