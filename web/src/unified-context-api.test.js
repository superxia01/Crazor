// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const contextSource = readFileSync(resolve(repoRoot, "server/src/services/unified-context.ts"), "utf8")
const permissionsSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-permissions.ts"), "utf8")
const smokeSource = readFileSync(resolve(repoRoot, "scripts/crazor-smoke.mjs"), "utf8")

test("Unified Context API is routed, permissioned, and smoke-tested", () => {
  assert.ok(
    serverIndex.includes("app.get('/api/crazor/context'"),
    "server should expose the unified context endpoint"
  )
  assert.ok(
    serverIndex.includes("'context'"),
    "context endpoint should be included in business read protection"
  )
  assert.ok(
    serverIndex.includes("getUnifiedContext({"),
    "context route should call the aggregation service"
  )
  assert.ok(
    permissionsSource.includes('"context:read"'),
    "read roles should include context:read"
  )
  assert.ok(
    contextSource.includes("listContacts") &&
      contextSource.includes("listProjects") &&
      contextSource.includes("listTasks") &&
      contextSource.includes("listNotesByContact") &&
      contextSource.includes("listAuditLogs"),
    "context service should aggregate business, document, and audit sources"
  )
  assert.ok(
    contextSource.includes("contact_id") && contextSource.includes("types") && contextSource.includes("limit"),
    "context service should support the documented query filters"
  )
  assert.ok(
    smokeSource.includes("Unified Context 上下文聚合入口"),
    "delivery smoke test should verify the unified context endpoint"
  )
})
