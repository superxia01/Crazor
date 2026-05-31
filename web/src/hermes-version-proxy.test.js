// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverSource = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")

test("Hermes version endpoint reads Dashboard status metadata", () => {
  assert.ok(
    serverSource.includes("app.get('/api/hermes/version'"),
    "server should expose the Hermes version endpoint"
  )
  assert.ok(
    serverSource.includes("const resp = await dashboardFetch(`/api/status`)"),
    "Hermes version should read Dashboard /api/status instead of Gateway /health"
  )
  assert.ok(
    serverSource.includes("version: data.version || 'unknown'"),
    "Hermes version response should normalize missing version metadata"
  )
  assert.ok(
    serverSource.includes("platform: 'hermes-agent'"),
    "Hermes version response should identify the current provider platform"
  )
  assert.equal(
    serverSource.includes("fetch(`${AGENT_GATEWAY_URL}/health`)"),
    false,
    "Hermes version should not depend on Gateway /health because it does not expose release metadata reliably"
  )
})
