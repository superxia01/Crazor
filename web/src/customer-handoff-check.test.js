// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  buildCustomerBackendEnv,
  renderCustomerBackendEnv,
} from "../../scripts/customer-backend-env.mjs"
import {
  listModelProviderConnections,
  renderCustomerHandoffReport,
  runCustomerHandoffCheck,
} from "../../scripts/customer-handoff-check.mjs"

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function htmlResponse() {
  return new Response("<!doctype html><html><head><title>Crazor数字员工系统</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/assets/index.js\"></script></body></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  })
}

function jsResponse() {
  return new Response("const app = 'Crazor';", {
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

test("customer handoff check verifies package, env, access-code login, and chat", async () => {
  const dir = createDeliveryFixture({
    customer: "CRAZYAIGC 客户",
    serverUrl: "https://client.example.com",
  })
  const envDir = mkdtempSync(join(tmpdir(), "crazor-handoff-env-"))
  const envFile = join(envDir, ".env.customer")
  writeFileSync(
    envFile,
    `${renderCustomerBackendEnv(
      buildCustomerBackendEnv({
        customer: "CRAZYAIGC 客户",
        serverUrl: "https://client.example.com",
        jwtSecret: "0123456789abcdef0123456789abcdef",
        accessCode: "handoff-code",
      }),
    )}ANTHROPIC_API_KEY=\"sk-live-handoff-secret\"\n`,
  )

  try {
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url, init })
      const pathname = new URL(url).pathname
      if (pathname === "/api/delivery/readiness") {
        return jsonResponse({
          status: "ready",
          delivery: {
            customer: "CRAZYAIGC 客户",
            public_base_url: "https://client.example.com",
            protocol_version: "1",
            identity_fingerprint: deliveryFingerprint("CRAZYAIGC 客户", "https://client.example.com", "customer", "1"),
          },
          checks: [
            { id: "agent-gateway", label: "Agent Gateway", status: "ok", detail: "Agent Gateway 可访问" },
            { id: "model-config", label: "模型配置", status: "ok", detail: "模型 hermes-agent 可用" },
            { id: "business-data", label: "业务数据 API", status: "ok", detail: "CRM、项目、任务和交付记录数据库可读" },
          ],
        })
      }
      if (pathname === "/api/health") return jsonResponse({ status: "ok" })
      if (pathname === "/") return htmlResponse()
      if (pathname === "/assets/index.js") return jsResponse()
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
        return jsonResponse({ loggedIn: true, nickname: "客户用户", portalMode: true })
      }
      if (pathname === "/api/customer/portal") {
        assert.equal(init.headers.Authorization, "Bearer access.jwt")
        assert.equal(init.headers["X-Crazor-Token"], undefined)
        return jsonResponse({
          binding: { status: "bound" },
          summary: { deliveries: 1, docs: 1, attachments: 0, pendingAcceptance: 0 },
          deliveries: [],
          tasks: [],
          docs: [],
          projects: [],
          attachments: { contact: [], projects: [], deliveries: [] },
        })
      }
      if (pathname === "/api/crazor/context") {
        assert.equal(init.headers.Authorization, "Bearer access.jwt")
        return jsonResponse({ error: "customer portal sessions cannot access internal workspace routes" }, 403)
      }
      if (pathname === "/api/crazor/contacts" && init.method === "POST") {
        assert.equal(init.headers.Authorization, "Bearer access.jwt")
        return jsonResponse({ error: "customer portal sessions cannot access internal workspace routes" }, 403)
      }
      if (pathname === "/api/agent/provider") {
        return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
      }
      if (pathname === "/api/models") {
        assert.equal(init.headers.Authorization, "Bearer access.jwt")
        assert.equal(init.headers["X-Crazor-Token"], undefined)
        return jsonResponse({ data: [{ id: "hermes-agent" }] })
      }
      if (pathname === "/api/chat/completions") {
        assert.equal(init.headers.Authorization, "Bearer access.jwt")
        assert.equal(init.headers["X-Crazor-Token"], undefined)
        assert.equal(JSON.parse(init.body).stream, false)
        return jsonResponse({ choices: [{ message: { content: "OK" } }] })
      }
      throw new Error(`unexpected ${url}`)
    }

    const result = await runCustomerHandoffCheck({
      deliveryDir: dir,
      envFile,
      fetchImpl,
      logger: { log() {}, warn() {} },
    })

    assert.equal(result.ok, true)
    assert.equal(result.env.checked, true)
    assert.equal(result.env.accessCodeConfigured, true)
    assert.deepEqual(result.env.modelConnections, ["ANTHROPIC_API_KEY"])
    assert.equal(result.delivery.identityFingerprint, deliveryFingerprint("CRAZYAIGC 客户", "https://client.example.com", "customer", "1"))
    assert.equal(result.server.identityFingerprint, result.delivery.identityFingerprint)
    assert.equal(result.server.readinessChecks.length, 3)
    assert.equal(result.desktopSmoke.accessCodeLoginChecked, true)
    assert.equal(result.desktopSmoke.accessActorTokenChecked, false)
    assert.equal(result.desktopSmoke.portalMode, true)
    assert.equal(result.desktopSmoke.customerPortalChecked, true)
    assert.equal(result.desktopSmoke.internalAdminBlockedChecked, true)
    assert.equal(result.desktopSmoke.internalWriteBlockedChecked, true)
    assert.equal(result.desktopSmoke.webEntrypointChecked, true)
    assert.deepEqual(result.desktopSmoke.webAssetChecks, [{ path: "/assets/index.js", type: "script", status: "ok" }])
    assert.deepEqual(result.desktopSmoke.businessEntryChecks, [
      { id: "customer-portal", label: "客户工作台", path: "/api/customer/portal", status: "ok" },
    ])
    assert.equal(result.desktopSmoke.businessWriteChecked, false)
    assert.equal(result.desktopSmoke.liveChatChecked, true)
    assert.ok(calls.some((call) => new URL(call.url).pathname === "/api/auth/access-code"))
    const report = renderCustomerHandoffReport(result)
    assert.match(report, /模型连接凭据: ANTHROPIC_API_KEY/)
    assert.match(report, /## 客户端内置配置/)
    assert.match(report, /API Base: https:\/\/client\.example\.com/)
    assert.match(report, /工作台模式: 客户交付/)
    assert.match(report, /客户工作台: 已验证/)
    assert.match(report, /内部后台隔离: 已验证/)
    assert.match(report, /业务写入: 已验证已隔离/)
    assert.match(report, /Web 入口: 已验证/)
    assert.match(report, /Web 静态资源: 1 项已验证/)
    assert.match(report, /## Web 入口自检/)
    assert.match(report, /通过 script: \/assets\/index\.js/)
    assert.match(report, /## 业务入口自检/)
    assert.match(report, /通过 客户工作台: \/api\/customer\/portal/)
    assert.match(report, /## 后端自检项/)
    assert.match(report, /通过 模型配置: 模型 hermes-agent 可用/)
    assert.match(report, /通过 业务数据 API: CRM、项目、任务和交付记录数据库可读/)
    assert.ok(!report.includes("handoff-code"))
    assert.ok(!report.includes("sk-live-handoff-secret"))
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(envDir, { recursive: true, force: true })
  }
})

test("customer handoff model connection audit redacts values and accepts local model base URLs", () => {
  assert.deepEqual(
    listModelProviderConnections({
      OPENAI_API_KEY: "change-me",
      ANTHROPIC_API_KEY: "sk-secret",
      OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1",
      LM_BASE_URL: "http://192.168.103.252:1234/v1",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1",
    }),
    ["ANTHROPIC_API_KEY", "OLLAMA_BASE_URL(local)", "LM_BASE_URL(local)"],
  )
})

test("customer handoff check rejects env server URL mismatches", async () => {
  const dir = createDeliveryFixture({
    customer: "CRAZYAIGC 客户",
    serverUrl: "https://client.example.com",
  })
  const envDir = mkdtempSync(join(tmpdir(), "crazor-handoff-env-"))
  const envFile = join(envDir, ".env.customer")
  writeFileSync(
    envFile,
    renderCustomerBackendEnv(
      buildCustomerBackendEnv({
        customer: "CRAZYAIGC 客户",
        serverUrl: "https://wrong.example.com",
        jwtSecret: "0123456789abcdef0123456789abcdef",
        accessCode: "handoff-code",
      }),
    ),
  )

  try {
    const result = await runCustomerHandoffCheck({
      deliveryDir: dir,
      envFile,
      live: false,
      logger: { log() {}, warn() {} },
    })

    assert.equal(result.ok, false)
    assert.match(result.errors.join("\n"), /CRAZOR_PUBLIC_BASE_URL 必须为 https:\/\/client.example.com/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(envDir, { recursive: true, force: true })
  }
})

test("customer handoff check verifies internal demo entry when configured", async () => {
  const dir = createDeliveryFixture({
    customer: "CRAZYAIGC 客户",
    serverUrl: "https://client.example.com",
    internalEntry: {
      enabled: true,
      url: "https://client.example.com?workspace=internal",
    },
  })
  const envDir = mkdtempSync(join(tmpdir(), "crazor-handoff-env-"))
  const envFile = join(envDir, ".env.customer")
  writeFileSync(
    envFile,
    `${renderCustomerBackendEnv(
      buildCustomerBackendEnv({
        customer: "CRAZYAIGC 客户",
        serverUrl: "https://client.example.com",
        jwtSecret: "0123456789abcdef0123456789abcdef",
        accessCode: "handoff-code",
        internalAccessCode: "internal-demo-001",
      }),
    )}FEISHU_APP_ID="cli_xxx_demo"\nFEISHU_APP_SECRET="demo_secret_value"\n`,
  )

  try {
    let feishuVerified = false
    const fetchImpl = async (url, init = {}) => {
      const pathname = new URL(url).pathname
      const auth = init.headers?.Authorization
      const actor = init.headers?.["X-Crazor-Token"]

      if (pathname === "/api/delivery/readiness") {
        return jsonResponse({
          status: feishuVerified ? "ready" : "degraded",
          delivery: {
            customer: "CRAZYAIGC 客户",
            public_base_url: "https://client.example.com",
            protocol_version: "1",
            identity_fingerprint: deliveryFingerprint("CRAZYAIGC 客户", "https://client.example.com", "customer", "1"),
          },
          checks: feishuVerified
            ? [
                {
                  id: "connector-feishu",
                  label: "飞书连接器",
                  status: "ok",
                  detail: "飞书认证成功，已识别 CRAZYAIGC Demo Tenant（最近检测 2026-06-03T04:30:00.000Z）",
                },
              ]
            : [
                {
                  id: "connector-feishu",
                  label: "飞书连接器",
                  status: "warn",
                  detail: "已配置飞书凭证，但尚未执行真实连通测试",
                },
              ],
        })
      }
      if (pathname === "/api/health") return jsonResponse({ status: "ok" })
      if (pathname === "/") return htmlResponse()
      if (pathname === "/assets/index.js") return jsResponse()
      if (pathname === "/api/auth/status") {
        return jsonResponse({ loginRequired: true, accessCodeConfigured: true, internalAccessCodeConfigured: true })
      }
      if (pathname === "/api/auth/access-code") {
        assert.equal(init.method, "POST")
        assert.equal(JSON.parse(init.body).code, "handoff-code")
        return jsonResponse({ loggedIn: true, token: "access.jwt", nickname: "客户用户" })
      }
      if (pathname === "/api/auth/internal-access-code") {
        assert.equal(init.method, "POST")
        assert.equal(JSON.parse(init.body).code, "internal-demo-001")
        return jsonResponse({
          loggedIn: true,
          token: "internal.jwt",
          actorToken: "internal.actor",
          actor: { member_id: "member_internal", token_prefix: "int_", scopes: ["*"] },
          nickname: "内部演示用户",
        })
      }
      if (pathname === "/api/auth/me") {
        if (auth === "Bearer access.jwt") {
          return jsonResponse({ loggedIn: true, nickname: "客户用户", portalMode: true, loginChannel: "access-code" })
        }
        if (auth === "Bearer internal.jwt") {
          return jsonResponse({ loggedIn: true, nickname: "内部演示用户", portalMode: false, loginChannel: "internal-access-code" })
        }
      }
      if (pathname === "/api/customer/portal") {
        assert.equal(auth, "Bearer access.jwt")
        assert.equal(actor, undefined)
        return jsonResponse({
          binding: { status: "bound" },
          summary: { deliveries: 1, docs: 1, attachments: 0, pendingAcceptance: 0 },
          deliveries: [],
          tasks: [],
          docs: [],
          projects: [],
          attachments: { contact: [], projects: [], deliveries: [] },
        })
      }
      if (pathname === "/api/crazor/context") {
        if (auth === "Bearer access.jwt") {
          return jsonResponse({ error: "customer portal sessions cannot access internal workspace routes" }, 403)
        }
        assert.equal(auth, "Bearer internal.jwt")
        assert.equal(actor, "internal.actor")
        return jsonResponse({ items: [] })
      }
      if (pathname === "/api/config") {
        assert.equal(auth, "Bearer internal.jwt")
        assert.equal(actor, "internal.actor")
        return jsonResponse({ app_name: "Crazor" })
      }
      if (pathname === "/api/model/info") {
        assert.equal(auth, "Bearer internal.jwt")
        assert.equal(actor, "internal.actor")
        return jsonResponse({ provider: "deepseek", model: "deepseek-chat" })
      }
      if (pathname === "/api/env") {
        assert.equal(auth, "Bearer internal.jwt")
        assert.equal(actor, "internal.actor")
        return jsonResponse({ keys: [{ key: "DEEPSEEK_API_KEY", configured: true }] })
      }
      if (pathname === "/api/integrations/checks") {
        assert.equal(auth, "Bearer internal.jwt")
        assert.equal(actor, "internal.actor")
        return jsonResponse({
          connectors: [
            { connector_id: "feishu", status: "warn", summary: "已配置飞书凭证，但尚未执行真实连通测试" },
          ],
        })
      }
      if (pathname === "/api/crazor/contacts" && init.method === "POST" && auth === "Bearer access.jwt") {
        return jsonResponse({ error: "customer portal sessions cannot access internal workspace routes" }, 403)
      }
      const businessResponse = businessEntrypointResponse(pathname, init)
      if (businessResponse) {
        if (auth === "Bearer internal.jwt") {
          assert.equal(actor, "internal.actor")
        }
        return businessResponse
      }
      if (pathname === "/api/agent/provider") {
        return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
      }
      if (pathname === "/api/models") {
        if (auth === "Bearer access.jwt") {
          assert.equal(actor, undefined)
        }
        if (auth === "Bearer internal.jwt") {
          assert.equal(actor, "internal.actor")
        }
        return jsonResponse({ data: [{ id: "hermes-agent" }] })
      }
      if (pathname === "/api/chat/completions") {
        if (auth === "Bearer access.jwt") {
          assert.equal(actor, undefined)
        }
        if (auth === "Bearer internal.jwt") {
          assert.equal(actor, "internal.actor")
        }
        return jsonResponse({ choices: [{ message: { content: "OK" } }] })
      }
      if (pathname === "/api/integrations/feishu/test") {
        assert.equal(auth, "Bearer internal.jwt")
        assert.equal(actor, "internal.actor")
        feishuVerified = true
        return jsonResponse({
          connector_id: "feishu",
          status: "ok",
          summary: "飞书认证成功，已识别 CRAZYAIGC Demo Tenant",
          checked_at: "2026-06-03T04:30:00.000Z",
        })
      }
      throw new Error(`unexpected ${url}`)
    }

    const result = await runCustomerHandoffCheck({
      deliveryDir: dir,
      envFile,
      fetchImpl,
      logger: { log() {}, warn() {} },
    })

    assert.equal(result.ok, true)
    assert.equal(result.delivery.internalEntry.enabled, true)
    assert.equal(result.delivery.internalEntry.url, "https://client.example.com?workspace=internal")
    assert.equal(result.env.internalAccessCodeConfigured, true)
    assert.equal(result.env.feishuConfigured, true)
    assert.equal(result.internalWorkspace.checked, true)
    assert.equal(result.internalWorkspace.loginChecked, true)
    assert.equal(result.internalWorkspace.actorTokenIssued, true)
    assert.equal(result.internalWorkspace.loginChannel, "internal-access-code")
    assert.equal(result.internalWorkspace.portalMode, false)
    assert.equal(result.internalWorkspace.businessEntryChecked, true)
    assert.equal(result.internalWorkspace.businessWriteChecked, true)
    assert.equal(result.internalWorkspace.liveChatChecked, true)
    assert.equal(result.internalWorkspace.settingsChecked, true)
    assert.equal(result.internalWorkspace.settingsChecks.length, 4)
    assert.equal(result.internalWorkspace.feishuCheck.checked, true)
    assert.equal(result.internalWorkspace.feishuCheck.status, "ok")
    assert.match(result.internalWorkspace.feishuCheck.summary, /飞书认证成功/)
    assert.ok(result.server.readinessChecks.some((check) => check.id === "connector-feishu" && check.status === "ok"))
    const report = renderCustomerHandoffReport(result)
    assert.match(report, /团队内部演示入口: 已启用/)
    assert.match(report, /入口地址: https:\/\/client\.example\.com\?workspace=internal/)
    assert.match(report, /演示码配置: 已提供/)
    assert.match(report, /飞书演示凭据: 已提供/)
    assert.match(report, /登录验收: 已验证/)
    assert.match(report, /工作台模式: 内部协作/)
    assert.match(report, /内部业务写入: 已验证/)
    assert.match(report, /内部真实对话: 已验证/)
    assert.match(report, /内部控制面: 4 项已验证/)
    assert.match(report, /飞书连接器: 已验证/)
    assert.match(report, /飞书结果: 飞书认证成功，已识别 CRAZYAIGC Demo Tenant/)
    assert.match(report, /## 内部控制面自检/)
    assert.match(report, /通过 基础配置: \/api\/config/)
    assert.match(report, /通过 模型配置: \/api\/model\/info/)
    assert.match(report, /通过 环境变量清单: \/api\/env/)
    assert.match(report, /通过 连接器状态: \/api\/integrations\/checks/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(envDir, { recursive: true, force: true })
  }
})

test("customer handoff check fails when login is required but no access code is verified", async () => {
  const dir = createDeliveryFixture({
    customer: "CRAZYAIGC 客户",
    serverUrl: "https://client.example.com",
  })

  try {
    const fetchImpl = async (url) => {
      const pathname = new URL(url).pathname
      if (pathname === "/api/delivery/readiness") {
        return jsonResponse({
          status: "ready",
          delivery: {
            customer: "CRAZYAIGC 客户",
            public_base_url: "https://client.example.com",
            protocol_version: "1",
            identity_fingerprint: deliveryFingerprint("CRAZYAIGC 客户", "https://client.example.com", "customer", "1"),
          },
          checks: [],
        })
      }
      if (pathname === "/api/health") return jsonResponse({ status: "ok" })
      if (pathname === "/") return htmlResponse()
      if (pathname === "/assets/index.js") return jsResponse()
      if (pathname === "/api/auth/status") return jsonResponse({ loginRequired: true })
      if (pathname === "/api/auth/me") return jsonResponse({ loggedIn: false })
      if (pathname === "/api/crazor/context") return jsonResponse({ error: "Unauthorized" }, 401)
      if (pathname === "/api/agent/provider") {
        return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
      }
      throw new Error(`unexpected ${url}`)
    }

    const result = await runCustomerHandoffCheck({
      deliveryDir: dir,
      fetchImpl,
      logger: { log() {}, warn() {} },
    })

    assert.equal(result.ok, false)
    assert.equal(result.desktopSmoke.interactiveLoginRequired, true)
    assert.match(result.errors.join("\n"), /无法证明客户安装后可直接进入工作区/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("customer handoff check rejects hosted backend fingerprint mismatches", async () => {
  const dir = createDeliveryFixture({
    customer: "CRAZYAIGC 客户",
    serverUrl: "https://client.example.com",
  })

  try {
    const fetchImpl = async (url) => {
      const pathname = new URL(url).pathname
      if (pathname === "/api/delivery/readiness") {
        return jsonResponse({
          status: "ready",
          delivery: {
            customer: "CRAZYAIGC 客户",
            public_base_url: "https://client.example.com",
            protocol_version: "1",
            identity_fingerprint: "ffffffffffff",
          },
          checks: [],
        })
      }
      if (pathname === "/api/health") return jsonResponse({ status: "ok" })
      if (pathname === "/") return htmlResponse()
      if (pathname === "/assets/index.js") return jsResponse()
      if (pathname === "/api/auth/status") return jsonResponse({ loginRequired: false })
      if (pathname === "/api/auth/me") return jsonResponse({ loggedIn: false })
      if (pathname === "/api/crazor/context") return jsonResponse({ items: [] })
      if (pathname === "/api/agent/provider") {
        return jsonResponse({ capability_ids: ["gateway.chat_completions"] })
      }
      if (pathname === "/api/models") return jsonResponse({ data: [{ id: "hermes-agent" }] })
      throw new Error(`unexpected ${url}`)
    }

    const result = await runCustomerHandoffCheck({
      deliveryDir: dir,
      fetchImpl,
      liveChat: false,
      logger: { log() {}, warn() {} },
    })

    assert.equal(result.ok, false)
    assert.match(result.errors.join("\n"), /交付指纹不一致/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createDeliveryFixture({
  customer = "测试客户",
  serverUrl = "https://crazor.example.com",
  protocolVersion = "1",
  internalEntry = { enabled: false, url: "" },
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "crazor-handoff-"))
  const installerPath = "dmg/Crazor_1.0.0_aarch64.dmg"
  const installerContent = "fake installer"
  const sha256 = createHash("sha256").update(installerContent).digest("hex")

  mkdirSync(join(dir, "dmg"), { recursive: true })
  writeFileSync(join(dir, installerPath), installerContent)
  writeFileSync(join(dir, "crazor-delivery-checksums.txt"), `${sha256}  ${installerPath}\n`)
  const manifest = {
    product: "Crazor",
    customer,
    serverUrl,
    platform: "macos-current",
    serverPreflight: {
      mode: "strict",
      result: "passed",
    },
    deliveryProtocolVersion: protocolVersion,
    deliveryIdentityFingerprint: deliveryFingerprint(customer, serverUrl, "customer", protocolVersion),
    gitSha: "abc123",
    workflowSha: "def456",
    githubRunId: "123",
    builtAt: "2026-06-01T20:00:00.000Z",
    internalEntry,
    clientRuntime: {
      apiBase: serverUrl,
      customerName: customer,
      deliveryChannel: "customer",
      deliveryProtocolVersion: protocolVersion,
      deliveryFingerprint: deliveryFingerprint(customer, serverUrl, "customer", protocolVersion),
      buildSha: "abc123",
      buildTime: "2026-06-01T20:00:00.000Z",
    },
    checksumFile: "crazor-delivery-checksums.txt",
    bundleFiles: [
      {
        path: installerPath,
        type: "installer",
        sizeBytes: Buffer.byteLength(installerContent),
        sha256,
      },
    ],
  }
  writeFileSync(
    join(dir, "crazor-delivery-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  )
  writeFileSync(
    join(dir, "crazor-start-here.md"),
    `# Crazor 客户交付说明

- 客户: ${manifest.customer}
- Web 统一入口: ${manifest.serverUrl}
- 桌面客户端后端: ${manifest.serverUrl}
- 交付协议: ${manifest.deliveryProtocolVersion}
- 交付指纹: ${manifest.deliveryIdentityFingerprint}

## 客户端内置配置

- API Base: ${manifest.clientRuntime.apiBase}
- 交付通道: ${manifest.clientRuntime.deliveryChannel}
- 内置客户: ${manifest.clientRuntime.customerName}
- 内置协议: ${manifest.clientRuntime.deliveryProtocolVersion}
- 内置指纹: ${manifest.clientRuntime.deliveryFingerprint}

## 桌面安装包

- ${installerPath}

${internalEntry.enabled ? `## 团队内部演示入口

- 入口地址: ${internalEntry.url}
- 说明: 仅供 CRAZYAIGC 团队成员演示后台、连接器和现场配置时使用。

` : ""}## 验收文件

- crazor-delivery-manifest.json
- crazor-delivery-checksums.txt
`,
  )
  return dir
}

function deliveryFingerprint(customer, serverUrl, channel, protocolVersion) {
  return createHash("sha256")
    .update(JSON.stringify({
      product: "Crazor",
      customer,
      serverUrl,
      channel,
      protocolVersion,
    }))
    .digest("hex")
    .slice(0, 12)
}
