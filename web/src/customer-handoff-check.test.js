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
          checks: [],
        })
      }
      if (pathname === "/api/health") return jsonResponse({ status: "ok" })
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
    assert.equal(result.desktopSmoke.accessCodeLoginChecked, true)
    assert.equal(result.desktopSmoke.liveChatChecked, true)
    assert.ok(calls.some((call) => new URL(call.url).pathname === "/api/auth/access-code"))
    const report = renderCustomerHandoffReport(result)
    assert.match(report, /模型连接凭据: ANTHROPIC_API_KEY/)
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
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "crazor-handoff-"))
  const installerPath = "dmg/Crazor_1.0.0_aarch64.dmg"
  const installerContent = "fake installer"
  const sha256 = createHash("sha256").update(installerContent).digest("hex")

  mkdirSync(join(dir, "dmg"), { recursive: true })
  writeFileSync(join(dir, installerPath), installerContent)
  writeFileSync(join(dir, "crazor-delivery-checksums.txt"), `${sha256}  ${installerPath}\n`)
  writeFileSync(
    join(dir, "crazor-delivery-manifest.json"),
    JSON.stringify(
      {
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
        checksumFile: "crazor-delivery-checksums.txt",
        bundleFiles: [
          {
            path: installerPath,
            type: "installer",
            sizeBytes: Buffer.byteLength(installerContent),
            sha256,
          },
        ],
      },
      null,
      2,
    ) + "\n",
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
