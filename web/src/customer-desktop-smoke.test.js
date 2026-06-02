// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDesktopHeaders,
  evaluateDesktopLoginGate,
  runCustomerDesktopSmoke,
  summarizeReadinessIssues,
} from "../../scripts/customer-desktop-smoke.mjs"

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

test("customer desktop smoke attaches login and actor tokens to hosted backend probes", async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") {
      return jsonResponse({ status: "ok" })
    }
    if (pathname === "/api/delivery/readiness") {
      return jsonResponse({
        status: "ready",
        delivery: {
          customer: "CRAZYAIGC 内部",
          public_base_url: "https://client.example.com",
          protocol_version: "1",
        },
        checks: [],
      })
    }
    if (pathname === "/api/auth/status") {
      return jsonResponse({ loginRequired: true })
    }
    if (pathname === "/api/auth/me") {
      assert.equal(init.headers.Authorization, "Bearer login.jwt")
      return jsonResponse({ loggedIn: true, nickname: "客户用户" })
    }
    if (pathname === "/api/crazor/context") {
      assert.equal(init.headers.Authorization, "Bearer login.jwt")
      assert.equal(init.headers["X-Crazor-Token"], "czr_actor")
      return jsonResponse({ items: [] })
    }
    if (pathname === "/api/agent/provider") {
      return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
    }
    if (pathname === "/api/models") {
      assert.equal(init.headers.Authorization, "Bearer login.jwt")
      assert.equal(init.headers["X-Crazor-Token"], "czr_actor")
      return jsonResponse({ data: [{ id: "hermes-agent" }] })
    }
    if (pathname === "/api/chat/completions") {
      assert.equal(init.method, "POST")
      assert.equal(init.headers.Authorization, "Bearer login.jwt")
      assert.equal(init.headers["X-Crazor-Token"], "czr_actor")
      assert.equal(init.headers["Content-Type"], "application/json")
      assert.equal(JSON.parse(init.body).stream, false)
      return jsonResponse({ choices: [{ message: { content: "OK" } }] })
    }
    throw new Error(`unexpected ${url}`)
  }

  const result = await runCustomerDesktopSmoke({
    customer: "CRAZYAIGC 内部",
    serverUrl: "https://client.example.com/",
    protocolVersion: "1",
    loginToken: "login.jwt",
    actorToken: "czr_actor",
    fetchImpl,
    logger: { log() {}, warn() {} },
  })

  assert.equal(result.ok, true)
  assert.equal(result.serverUrl, "https://client.example.com")
  assert.equal(result.loginRequired, true)
  assert.equal(result.interactiveLoginRequired, false)
  assert.equal(result.liveChatChecked, true)
  assert.equal(result.chatReplyPreview, "OK")
  assert.ok(calls.some((call) => call.url === "https://client.example.com/api/crazor/context?limit=1"))
  assert.ok(calls.some((call) => call.url === "https://client.example.com/api/models"))
  assert.ok(calls.some((call) => call.url === "https://client.example.com/api/chat/completions"))
})

test("customer desktop smoke can exchange customer access code for login JWT", async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/api/delivery/readiness") {
      return jsonResponse({
        status: "ready",
        delivery: {
          customer: "CRAZYAIGC 内部",
          public_base_url: "https://client.example.com",
          protocol_version: "1",
        },
        checks: [],
      })
    }
    if (pathname === "/api/auth/status") {
      return jsonResponse({ loginRequired: true, accessCodeConfigured: true })
    }
    if (pathname === "/api/auth/access-code") {
      assert.equal(init.method, "POST")
      assert.equal(JSON.parse(init.body).code, "handoff-code")
      return jsonResponse({ loggedIn: true, token: "access.jwt", nickname: "客户用户" })
    }
    if (pathname === "/api/auth/me") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      return jsonResponse({ loggedIn: true, nickname: "客户用户" })
    }
    if (pathname === "/api/crazor/context") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      return jsonResponse({ items: [] })
    }
    if (pathname === "/api/agent/provider") {
      return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
    }
    if (pathname === "/api/models") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      return jsonResponse({ data: [{ id: "hermes-agent" }] })
    }
    if (pathname === "/api/chat/completions") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      return jsonResponse({ choices: [{ message: { content: "OK" } }] })
    }
    throw new Error(`unexpected ${url}`)
  }

  const result = await runCustomerDesktopSmoke({
    customer: "CRAZYAIGC 内部",
    serverUrl: "https://client.example.com",
    accessCode: "handoff-code",
    fetchImpl,
    logger: { log() {}, warn() {} },
  })

  assert.equal(result.ok, true)
  assert.equal(result.accessCodeLoginChecked, true)
  assert.equal(result.interactiveLoginRequired, false)
  assert.equal(result.liveChatChecked, true)
  assert.ok(calls.some((call) => new URL(call.url).pathname === "/api/auth/access-code"))
})

test("customer desktop smoke treats missing login token as an expected login gate", async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/api/delivery/readiness") {
      return jsonResponse({ status: "ready", delivery: {}, checks: [] })
    }
    if (pathname === "/api/auth/status") return jsonResponse({ loginRequired: true })
    if (pathname === "/api/auth/me") return jsonResponse({ loggedIn: false })
    if (pathname === "/api/crazor/context") return jsonResponse({ error: "Unauthorized" }, 401)
    if (pathname === "/api/agent/provider") {
      return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
    }
    throw new Error(`unexpected ${url}`)
  }

  const result = await runCustomerDesktopSmoke({
    serverUrl: "http://127.0.0.1:5173",
    fetchImpl,
    logger: { log() {}, warn() {} },
  })

  assert.equal(result.ok, true)
  assert.equal(result.loginRequired, true)
  assert.equal(result.interactiveLoginRequired, true)
  assert.equal(result.liveChatChecked, false)
  assert.ok(result.warnings.some((item) => item.includes("要求登录")))
  assert.ok(!calls.some((url) => new URL(url).pathname === "/api/models"))
})

test("customer desktop smoke explains degraded readiness checks", async () => {
  const warnings = []
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/api/delivery/readiness") {
      return jsonResponse({
        status: "degraded",
        delivery: { channel: "local" },
        checks: [
          {
            id: "delivery-identity",
            label: "交付身份",
            status: "warn",
            detail: "后端未声明交付客户，客户包无法校验是否连到正确服务",
          },
        ],
      })
    }
    if (pathname === "/api/auth/status") return jsonResponse({ loginRequired: false })
    if (pathname === "/api/auth/me") return jsonResponse({ loggedIn: false })
    if (pathname === "/api/crazor/context") return jsonResponse({ items: [] })
    if (pathname === "/api/agent/provider") return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
    if (pathname === "/api/models") return jsonResponse({ data: [{ id: "hermes-agent" }] })
    throw new Error(`unexpected ${url}`)
  }

  const result = await runCustomerDesktopSmoke({
    serverUrl: "http://127.0.0.1:5173",
    liveChat: false,
    fetchImpl,
    logger: { log() {}, warn(message) { warnings.push(message) } },
  })

  assert.equal(result.ok, true)
  assert.equal(result.readinessStatus, "degraded")
  assert.ok(result.warnings.some((item) => item.includes("交付身份警告")))
  assert.ok(result.warnings.some((item) => item.includes("CRAZOR_DELIVERY_CUSTOMER") || item.includes("后端未声明交付客户")))
  assert.ok(warnings.some((item) => item.includes("交付身份警告")))
})

test("customer desktop smoke helper exposes desktop request auth semantics", () => {
  assert.deepEqual(buildDesktopHeaders({ loginToken: " jwt ", actorToken: " czr ", json: true }), {
    Accept: "application/json",
    Authorization: "Bearer jwt",
    "X-Crazor-Token": "czr",
    "Content-Type": "application/json",
  })

  assert.deepEqual(
    evaluateDesktopLoginGate({ loginRequired: true }, { loggedIn: false }, { loginToken: "" }),
    {
      loginRequired: true,
      loggedIn: false,
      needsInteractiveLogin: true,
      ok: true,
    },
  )
  assert.equal(
    evaluateDesktopLoginGate({ loginRequired: true }, { loggedIn: false }, { loginToken: "bad" }).ok,
    false,
  )
  assert.deepEqual(summarizeReadinessIssues({
    checks: [
      { label: "交付身份", status: "warn", detail: "缺少客户" },
      { label: "模型配置", status: "error", detail: "缺少 API Key" },
      { label: "后端 API", status: "ok", detail: "已响应" },
    ],
  }), [
    "交付身份警告: 缺少客户",
    "模型配置失败: 缺少 API Key",
  ])
})

test("customer desktop smoke can skip live chat when only probing entrypoints", async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/api/delivery/readiness") {
      return jsonResponse({ status: "ready", delivery: {}, checks: [] })
    }
    if (pathname === "/api/auth/status") return jsonResponse({ loginRequired: false })
    if (pathname === "/api/auth/me") return jsonResponse({ loggedIn: false })
    if (pathname === "/api/crazor/context") return jsonResponse({ items: [] })
    if (pathname === "/api/agent/provider") return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
    if (pathname === "/api/models") return jsonResponse({ data: [{ id: "hermes-agent" }] })
    throw new Error(`unexpected ${url}`)
  }

  const result = await runCustomerDesktopSmoke({
    serverUrl: "http://127.0.0.1:5173",
    liveChat: false,
    fetchImpl,
    logger: { log() {}, warn() {} },
  })

  assert.equal(result.liveChatChecked, false)
  assert.ok(result.warnings.some((item) => item.includes("已跳过真实对话响应检查")))
  assert.ok(!calls.some((url) => new URL(url).pathname === "/api/chat/completions"))
})
