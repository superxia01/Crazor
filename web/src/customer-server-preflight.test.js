// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateCustomerServerReadiness,
  normalizeServerUrl,
  verifyCustomerServer,
} from "../../scripts/verify-customer-server.mjs"

test("customer server preflight passes matching ready hosted backend", () => {
  const result = evaluateCustomerServerReadiness(" CRAZYAIGC 内部 ", "https://client.example.com/crazor/", {
    status: "ready",
    delivery: {
      customer: "CRAZYAIGC 内部",
      public_base_url: "https://client.example.com/crazor",
    },
    checks: [
      { id: "api", label: "后端 API", status: "ok", detail: "ok" },
    ],
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test("customer server preflight fails customer identity mismatch", () => {
  const result = evaluateCustomerServerReadiness("CRAZYAIGC 内部", "https://client.example.com", {
    status: "ready",
    delivery: {
      customer: "测试环境",
      public_base_url: "https://client.example.com",
    },
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /测试环境/)
})

test("customer server preflight fails public base URL mismatch", () => {
  const result = evaluateCustomerServerReadiness("CRAZYAIGC 内部", "https://client.example.com", {
    status: "ready",
    delivery: {
      customer: "CRAZYAIGC 内部",
      public_base_url: "https://old.example.com",
    },
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /公开地址/)
})

test("customer server preflight reports degraded backend as warning", () => {
  const result = evaluateCustomerServerReadiness("CRAZYAIGC 内部", "https://client.example.com", {
    status: "degraded",
    delivery: {
      customer: "CRAZYAIGC 内部",
      public_base_url: "https://client.example.com",
    },
    checks: [
      { id: "agent-dashboard", label: "Agent Dashboard", status: "warn", detail: "不可访问" },
    ],
  })
  assert.equal(result.ok, true)
  assert.ok(result.warnings.some((item) => item.includes("degraded")))
  assert.ok(result.warnings.some((item) => item.includes("Agent Dashboard")))
})

test("customer server preflight fetches delivery readiness endpoint", async () => {
  const calls = []
  const result = await verifyCustomerServer({
    customer: "CRAZYAIGC 内部",
    serverUrl: "https://client.example.com/",
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            status: "ready",
            delivery: {
              customer: "CRAZYAIGC 内部",
              public_base_url: "https://client.example.com",
            },
            checks: [],
          }
        },
      }
    },
  })

  assert.equal(result.ok, true)
  assert.equal(calls[0].url, "https://client.example.com/api/delivery/readiness")
  assert.equal(calls[0].init.headers.Accept, "application/json")
})

test("customer server preflight validates server URL format", () => {
  assert.equal(normalizeServerUrl("ftp://client.example.com"), "")
  assert.equal(normalizeServerUrl("https://client.example.com/app/"), "https://client.example.com/app")
})
