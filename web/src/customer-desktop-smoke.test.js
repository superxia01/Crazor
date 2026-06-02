// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDesktopHeaders,
  buildCustomerServerUrl,
  evaluateDesktopLoginGate,
  extractWebEntrypointAssetPaths,
  runCustomerDesktopSmoke,
  summarizeReadinessIssues,
  validateBusinessEntrypointShape,
  validateWebAssetResponse,
  validateWebEntrypointHtml,
} from "../../scripts/customer-desktop-smoke.mjs"

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function htmlResponse(text = "<!doctype html><html><head><title>Crazor数字员工系统</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/assets/index.js\"></script></body></html>") {
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  })
}

function jsResponse(text = "import('/assets/chunk.js'); const app = 'Crazor';") {
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/javascript" },
  })
}

function businessEntrypointResponse(pathname, init = {}) {
  if (pathname === "/api/crazor/contacts" && init.method === "POST") {
    return jsonResponse({ id: "contact_smoke" }, 201)
  }
  if (pathname === "/api/crazor/contacts/contact_smoke" && init.method === "DELETE") {
    return jsonResponse({ ok: true })
  }
  if (pathname === "/api/crazor/contacts") return jsonResponse([])
  if (pathname === "/api/crazor/projects") return jsonResponse([])
  if (pathname === "/api/crazor/tasks") return jsonResponse([])
  if (pathname === "/api/crazor/deliveries") return jsonResponse([])
  if (pathname === "/api/crazor/docs/knowledge/tree") return jsonResponse({ folders: [], notes: [] })
  if (pathname === "/api/crazor/attachments/policy") return jsonResponse({ max_bytes: 20971520, allowed_extensions: ["md"] })
  return null
}

test("customer desktop smoke attaches login and actor tokens to hosted backend probes", async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") {
      return jsonResponse({ status: "ok" })
    }
    if (pathname === "/") return htmlResponse()
    if (pathname === "/assets/index.js") return jsResponse()
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
    const businessResponse = businessEntrypointResponse(pathname, init)
    if (businessResponse) {
      assert.equal(init.headers.Authorization, "Bearer login.jwt")
      assert.equal(init.headers["X-Crazor-Token"], "czr_actor")
      return businessResponse
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
  assert.equal(result.webEntrypointChecked, true)
  assert.deepEqual(result.webAssetChecks, [{ path: "/assets/index.js", type: "script", status: "ok" }])
  assert.equal(result.loginRequired, true)
  assert.equal(result.interactiveLoginRequired, false)
  assert.deepEqual(
    result.businessEntryChecks.map((item) => item.id),
    ["contacts", "projects", "tasks", "deliveries", "knowledge-tree", "attachment-policy"],
  )
  assert.equal(result.businessWriteChecked, true)
  assert.equal(result.liveChatChecked, true)
  assert.equal(result.chatReplyPreview, "OK")
  assert.ok(calls.some((call) => call.url === "https://client.example.com/api/crazor/context?limit=1"))
  assert.ok(calls.some((call) => call.url === "https://client.example.com/"))
  assert.ok(calls.some((call) => call.url === "https://client.example.com/assets/index.js"))
  assert.ok(calls.some((call) => call.url === "https://client.example.com/api/models"))
  assert.ok(calls.some((call) => call.url === "https://client.example.com/api/chat/completions"))
})

test("customer desktop smoke preserves path-prefixed hosted server URLs", async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push(url)
    const pathname = new URL(url).pathname
    const appPathname = pathname.replace(/^\/crazor(?=\/|$)/, "") || "/"
    if (appPathname === "/api/health") return jsonResponse({ status: "ok" })
    if (appPathname === "/") {
      return htmlResponse([
        "<!doctype html><html><head><title>Crazor数字员工系统</title></head>",
        "<body><div id=\"root\"></div><script type=\"module\" src=\"assets/index.js\"></script></body></html>",
      ].join(""))
    }
    if (appPathname === "/assets/index.js") return jsResponse()
    if (appPathname === "/api/delivery/readiness") {
      return jsonResponse({
        status: "ready",
        delivery: {
          public_base_url: "https://client.example.com/crazor",
          protocol_version: "1",
        },
        checks: [],
      })
    }
    if (appPathname === "/api/auth/status") return jsonResponse({ loginRequired: false })
    if (appPathname === "/api/auth/me") return jsonResponse({ loggedIn: false })
    if (appPathname === "/api/crazor/context") return jsonResponse({ items: [] })
    const businessResponse = businessEntrypointResponse(appPathname, init)
    if (businessResponse) return businessResponse
    if (appPathname === "/api/agent/provider") {
      return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
    }
    if (appPathname === "/api/models") return jsonResponse({ data: [{ id: "hermes-agent" }] })
    throw new Error(`unexpected ${url}`)
  }

  const result = await runCustomerDesktopSmoke({
    serverUrl: "https://client.example.com/crazor/",
    liveChat: false,
    fetchImpl,
    logger: { log() {}, warn() {} },
  })

  assert.equal(result.ok, true)
  assert.equal(result.serverUrl, "https://client.example.com/crazor")
  assert.deepEqual(result.webAssetChecks, [{ path: "/crazor/assets/index.js", type: "script", status: "ok" }])
  assert.ok(calls.some((url) => url === "https://client.example.com/crazor/api/health"))
  assert.ok(calls.some((url) => url === "https://client.example.com/crazor/"))
  assert.ok(calls.some((url) => url === "https://client.example.com/crazor/assets/index.js"))
  assert.ok(calls.some((url) => url === "https://client.example.com/crazor/api/crazor/context?limit=1"))
  assert.ok(!calls.some((url) => url.includes("/crazor/crazor/")))
})

test("customer desktop smoke can exchange customer access code for login JWT", async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/") return htmlResponse()
    if (pathname === "/assets/index.js") return jsResponse()
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
      return jsonResponse({ loggedIn: true, token: "access.jwt", actor_token: "czr_customer", nickname: "客户用户" })
    }
    if (pathname === "/api/auth/me") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      return jsonResponse({ loggedIn: true, nickname: "客户用户" })
    }
    if (pathname === "/api/crazor/context") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      return jsonResponse({ items: [] })
    }
    const businessResponse = businessEntrypointResponse(pathname, init)
    if (businessResponse) {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      assert.equal(init.headers["X-Crazor-Token"], "czr_customer")
      return businessResponse
    }
    if (pathname === "/api/agent/provider") {
      return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
    }
    if (pathname === "/api/models") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      assert.equal(init.headers["X-Crazor-Token"], "czr_customer")
      return jsonResponse({ data: [{ id: "hermes-agent" }] })
    }
    if (pathname === "/api/chat/completions") {
      assert.equal(init.headers.Authorization, "Bearer access.jwt")
      assert.equal(init.headers["X-Crazor-Token"], "czr_customer")
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
  assert.equal(result.webEntrypointChecked, true)
  assert.equal(result.webAssetChecks.length, 1)
  assert.equal(result.accessCodeLoginChecked, true)
  assert.equal(result.accessActorTokenChecked, true)
  assert.equal(result.interactiveLoginRequired, false)
  assert.equal(result.businessEntryChecks.length, 6)
  assert.equal(result.businessWriteChecked, true)
  assert.equal(result.liveChatChecked, true)
  assert.ok(calls.some((call) => new URL(call.url).pathname === "/api/auth/access-code"))
})

test("customer desktop smoke treats missing login token as an expected login gate", async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push(url)
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/") return htmlResponse()
    if (pathname === "/assets/index.js") return jsResponse()
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
  assert.equal(result.webEntrypointChecked, true)
  assert.equal(result.webAssetChecks.length, 1)
  assert.equal(result.interactiveLoginRequired, true)
  assert.equal(result.liveChatChecked, false)
  assert.ok(result.warnings.some((item) => item.includes("要求登录")))
  assert.ok(!calls.some((url) => new URL(url).pathname === "/api/models"))
})

test("customer desktop smoke explains degraded readiness checks", async () => {
  const warnings = []
  const fetchImpl = async (url, init = {}) => {
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/") return htmlResponse()
    if (pathname === "/assets/index.js") return jsResponse()
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
    const businessResponse = businessEntrypointResponse(pathname, init)
    if (businessResponse) return businessResponse
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
  assert.equal(result.webEntrypointChecked, true)
  assert.equal(result.webAssetChecks.length, 1)
  assert.equal(result.businessEntryChecks.length, 6)
  assert.ok(result.warnings.some((item) => item.includes("交付身份警告")))
  assert.ok(result.warnings.some((item) => item.includes("CRAZOR_DELIVERY_CUSTOMER") || item.includes("后端未声明交付客户")))
  assert.ok(warnings.some((item) => item.includes("交付身份警告")))
})

test("customer desktop smoke helper exposes desktop request auth semantics", () => {
  assert.equal(
    buildCustomerServerUrl("https://client.example.com/crazor/", "/api/health"),
    "https://client.example.com/crazor/api/health",
  )
  assert.equal(
    buildCustomerServerUrl("https://client.example.com/crazor", "/crazor/assets/index.js"),
    "https://client.example.com/crazor/assets/index.js",
  )
  assert.equal(
    buildCustomerServerUrl("https://client.example.com/crazor", "/"),
    "https://client.example.com/crazor/",
  )
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
  assert.equal(validateBusinessEntrypointShape({ shape: "array" }, []), true)
  assert.equal(validateBusinessEntrypointShape({ shape: "array" }, {}), false)
  assert.equal(validateBusinessEntrypointShape({ shape: "object" }, { ok: true }), true)
  assert.equal(validateBusinessEntrypointShape({ shape: "object" }, []), false)
  assert.equal(validateWebEntrypointHtml("<!doctype html><html><head><title>Crazor数字员工系统</title></head><body><div id=\"root\"></div><script src=\"/assets/app.js\"></script></body></html>"), true)
  assert.equal(validateWebEntrypointHtml("{\"status\":\"ok\"}"), false)
  assert.deepEqual(
    extractWebEntrypointAssetPaths("<script src=\"/assets/app.js\"></script><link rel=\"stylesheet\" href=\"/assets/app.css\"><script src=\"https://cdn.example.com/skip.js\"></script>", "https://client.example.com"),
    [
      { path: "/assets/app.js", type: "script", label: "脚本资源" },
      { path: "/assets/app.css", type: "style", label: "样式资源" },
    ],
  )
  assert.deepEqual(
    extractWebEntrypointAssetPaths("<script src=\"assets/app.js\"></script>", "https://client.example.com/crazor"),
    [{ path: "/crazor/assets/app.js", type: "script", label: "脚本资源" }],
  )
  assert.equal(validateWebAssetResponse({ type: "script" }, "const app = 'Crazor'", "text/javascript"), true)
  assert.equal(validateWebAssetResponse({ type: "style" }, ".app { color: red; }", "text/css"), true)
  assert.equal(validateWebAssetResponse({ type: "script" }, "<html></html>", "text/html"), false)
})

test("customer desktop smoke rejects server URLs that do not serve the web shell", async () => {
  const fetchImpl = async (url, init = {}) => {
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/") return jsonResponse({ status: "api-only" })
    throw new Error(`unexpected ${url}`)
  }

  await assert.rejects(
    runCustomerDesktopSmoke({
      serverUrl: "http://127.0.0.1:3001",
      fetchImpl,
      logger: { log() {}, warn() {} },
    }),
    /Web 统一入口未返回 Crazor 前端 HTML/,
  )
})

test("customer desktop smoke rejects web shells with missing static assets", async () => {
  const fetchImpl = async (url, init = {}) => {
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/") return htmlResponse()
    if (pathname === "/assets/index.js") return jsonResponse({ error: "missing" }, 404)
    throw new Error(`unexpected ${url}`)
  }

  await assert.rejects(
    runCustomerDesktopSmoke({
      serverUrl: "http://127.0.0.1:5173",
      fetchImpl,
      logger: { log() {}, warn() {} },
    }),
    /GET \/assets\/index\.js 返回 404/,
  )
})

test("customer desktop smoke can skip live chat when only probing entrypoints", async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push(url)
    const pathname = new URL(url).pathname
    if (pathname === "/api/health") return jsonResponse({ status: "ok" })
    if (pathname === "/") return htmlResponse()
    if (pathname === "/assets/index.js") return jsResponse()
    if (pathname === "/api/delivery/readiness") {
      return jsonResponse({ status: "ready", delivery: {}, checks: [] })
    }
    if (pathname === "/api/auth/status") return jsonResponse({ loginRequired: false })
    if (pathname === "/api/auth/me") return jsonResponse({ loggedIn: false })
    if (pathname === "/api/crazor/context") return jsonResponse({ items: [] })
    const businessResponse = businessEntrypointResponse(pathname, init)
    if (businessResponse) return businessResponse
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
  assert.equal(result.webEntrypointChecked, true)
  assert.equal(result.webAssetChecks.length, 1)
  assert.equal(result.businessEntryChecks.length, 6)
  assert.ok(result.warnings.some((item) => item.includes("已跳过真实对话响应检查")))
  assert.ok(!calls.some((url) => new URL(url).pathname === "/api/chat/completions"))
})
