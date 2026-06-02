// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const dbSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-db.ts"), "utf8")
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const permissionsSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-permissions.ts"), "utf8")
const contextSource = readFileSync(resolve(repoRoot, "server/src/services/unified-context.ts"), "utf8")
const appInnerSource = readFileSync(resolve(repoRoot, "web/src/AppInner.jsx"), "utf8")
const contactsConfigSource = readFileSync(resolve(repoRoot, "web/src/configs/contactsConfig.jsx"), "utf8")
const deliveriesConfigSource = readFileSync(resolve(repoRoot, "web/src/configs/deliveriesConfig.jsx"), "utf8")
const desktopSmokeSource = readFileSync(resolve(repoRoot, "scripts/customer-desktop-smoke.mjs"), "utf8")
const dockerSmokeSource = readFileSync(resolve(repoRoot, "scripts/crazor-smoke.mjs"), "utf8")

test("customer delivery records are a real business module across API, UI, context, and smoke checks", () => {
  assert.ok(
    dbSource.includes("CREATE TABLE IF NOT EXISTS deliveries") &&
      dbSource.includes("export function listDeliveries") &&
      dbSource.includes("export function createDelivery") &&
      dbSource.includes("export function updateDelivery") &&
      dbSource.includes("export function getDeliveryStats"),
    "database service should expose persisted delivery records and stats",
  )

  assert.ok(
    serverIndex.includes("app.get('/api/crazor/deliveries'") &&
      serverIndex.includes("app.post('/api/crazor/deliveries'") &&
      serverIndex.includes("app.patch('/api/crazor/deliveries/:id'") &&
      serverIndex.includes("app.delete('/api/crazor/deliveries/:id'") &&
      serverIndex.includes("app.post('/api/crazor/contacts/:id/delivery-kickoff'") &&
      serverIndex.includes("buildDeliveryPlanContent") &&
      serverIndex.includes("deliveries: getDeliveryStats()") &&
      serverIndex.includes("'deliveries'") &&
      serverIndex.includes("CRM、项目、任务和交付记录数据库可读"),
    "server should route delivery CRUD, contact kickoff, analytics, read protection, and readiness checks",
  )

  assert.ok(
    permissionsSource.includes('"delivery:*"') &&
      permissionsSource.includes('"delivery:read"') &&
      permissionsSource.includes('delivery: ["delivery"]'),
    "role policies should protect delivery reads and writes",
  )

  assert.ok(
    contextSource.includes("listDeliveries") &&
      contextSource.includes("'delivery'") &&
      contextSource.includes("function mapDelivery") &&
      contextSource.includes("handover_doc_id"),
    "unified context should include delivery records for agent handoff",
  )

  assert.ok(
    appInnerSource.includes('import("@/DeliveriesView")') &&
      appInnerSource.includes('id: "deliveries"') &&
      appInnerSource.includes('view === "deliveries"') &&
      deliveriesConfigSource.includes('apiBase: "/api/crazor/deliveries"') &&
      deliveriesConfigSource.includes("交付管理") &&
      deliveriesConfigSource.includes("kanban") &&
      deliveriesConfigSource.includes("beforeCreate") &&
      deliveriesConfigSource.includes("beforeUpdate") &&
      contactsConfigSource.includes("启动交付") &&
      contactsConfigSource.includes("DELIVERY_KICKOFF_FIELDS") &&
      contactsConfigSource.includes("/delivery-kickoff") &&
      contactsConfigSource.includes("交付记录"),
    "frontend should expose an editable delivery management workspace and contact kickoff path",
  )

  assert.ok(
    desktopSmokeSource.includes("/api/crazor/deliveries") &&
      dockerSmokeSource.includes("客户交付记录与验收链路") &&
      dockerSmokeSource.includes("/delivery-kickoff") &&
      dockerSmokeSource.includes("交付计划文档") &&
      dockerSmokeSource.includes("types: \"contact,project,task,delivery") &&
      dockerSmokeSource.includes("entity === \"delivery\""),
    "customer delivery and Docker smoke tests should verify the delivery kickoff chain",
  )
})
