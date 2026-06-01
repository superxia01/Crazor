// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  checkDeliveryReadiness,
  deliveryCheckStatusLabel,
  deliveryReadinessLabel,
} from "./api/delivery-readiness.js"

test("delivery readiness client calls the public backend self-check endpoint", async () => {
  const calls = []
  const result = await checkDeliveryReadiness(async (url, init) => {
    calls.push({ url, init })
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          status: "ready",
          checks: [{ id: "api", label: "后端 API", status: "ok", detail: "Crazor API 已响应" }],
        }
      },
    }
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "/api/delivery/readiness")
  assert.deepEqual(calls[0].init.headers, { Accept: "application/json" })
  assert.equal(result.status, "ready")
  assert.equal(result.checks[0].id, "api")
})

test("delivery readiness labels are stable for customer-facing status badges", () => {
  assert.equal(deliveryReadinessLabel("ready"), "交付就绪")
  assert.equal(deliveryReadinessLabel("degraded"), "部分可用")
  assert.equal(deliveryReadinessLabel("blocked"), "交付阻塞")
  assert.equal(deliveryCheckStatusLabel("ok"), "通过")
  assert.equal(deliveryCheckStatusLabel("warn"), "关注")
  assert.equal(deliveryCheckStatusLabel("error"), "失败")
})

test("delivery readiness client reports HTTP failures", async () => {
  await assert.rejects(
    () =>
      checkDeliveryReadiness(async () => ({
        ok: false,
        status: 503,
      })),
    /HTTP 503/,
  )
})
