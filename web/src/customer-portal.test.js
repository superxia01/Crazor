// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverIndexSource = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const serverConfigSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-config.ts"), "utf8")
const composeSource = readFileSync(resolve(repoRoot, "docker-compose.yml"), "utf8")
const appSource = readFileSync(resolve(repoRoot, "web/src/App.jsx"), "utf8")
const appInnerSource = readFileSync(resolve(repoRoot, "web/src/AppInner.jsx"), "utf8")
const portalViewSource = readFileSync(resolve(repoRoot, "web/src/CustomerPortalView.jsx"), "utf8")
const portalApiSource = readFileSync(resolve(repoRoot, "web/src/api/customer-portal.js"), "utf8")

test("customer portal backend binds delivery contact and exposes protected portal routes", () => {
  assert.ok(
    serverConfigSource.includes("CRAZOR_DELIVERY_CONTACT_ID") &&
      composeSource.includes("CRAZOR_DELIVERY_CONTACT_ID: ${CRAZOR_DELIVERY_CONTACT_ID:-}") &&
      serverIndexSource.includes("function resolveDeliveryBoundContact()") &&
      serverIndexSource.includes("readDeliveryBindingReadiness") &&
      serverIndexSource.includes("CUSTOMER_PORTAL_ALLOWED_ROUTE_PREFIXES") &&
      serverIndexSource.includes("customer portal sessions cannot access internal workspace routes") &&
      serverIndexSource.includes("const portalMode = options.portalMode === undefined ? deliveryPortalEnabled() : Boolean(options.portalMode)") &&
      serverIndexSource.includes("app.get('/api/customer/portal'") &&
      serverIndexSource.includes("app.get('/api/customer/portal/docs'") &&
      serverIndexSource.includes("app.post('/api/customer/portal/deliveries/:id/acceptance'") &&
      serverIndexSource.includes("customerPortalAllowsAttachment") &&
      serverIndexSource.includes("const portalMode = payload.portal_mode === undefined ? deliveryPortalEnabled() : Boolean(payload.portal_mode)"),
    "backend should support a bound customer portal, isolate portal sessions from internal routes, and expose linked documents plus acceptance actions",
  )
})

test("customer login state should switch the shell into customer portal mode", () => {
  assert.ok(
    appSource.includes("portalMode: Boolean(data.portalMode)") &&
      appInnerSource.includes("const customerPortalMode = Boolean(userInfo?.portalMode)") &&
      appInnerSource.includes("CUSTOMER_PORTAL_SIDEBAR_GROUPS") &&
      appInnerSource.includes('setView("customer-portal")') &&
      appInnerSource.includes('{view === "customer-portal" && <CustomerPortalView />}'),
    "authenticated customer delivery sessions should land in a dedicated customer portal shell",
  )
})

test("customer portal view should read real data and allow acceptance feedback", () => {
  assert.ok(
    portalApiSource.includes('api.get("/api/customer/portal")') &&
      portalApiSource.includes('api.get(`/api/customer/portal/docs?id=${encodeURIComponent(String(id || ""))}`)') &&
      portalApiSource.includes('api.post(`/api/customer/portal/deliveries/${encodeURIComponent(String(deliveryId || ""))}/acceptance`, payload)') &&
      portalViewSource.includes("getCustomerPortal") &&
      portalViewSource.includes("submitCustomerDeliveryAcceptance") &&
      portalViewSource.includes("这里集中展示当前客户的交付状态、协作节点、归档资料和验收动作") &&
      portalViewSource.includes("当前页面不会补造演示数据") &&
      portalViewSource.includes("确认验收") &&
      portalViewSource.includes("申请返工"),
    "customer portal UI should be driven by real portal APIs and expose acceptance actions without mock filler",
  )
})
