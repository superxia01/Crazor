// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDesktopHeaders,
  evaluateDesktopLoginGate,
  runCustomerDesktopSmoke,
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
