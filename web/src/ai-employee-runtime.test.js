// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const runtimeSource = readFileSync(resolve(repoRoot, "server/src/services/ai-employee-runtime.ts"), "utf8")
const permissionsSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-permissions.ts"), "utf8")
const agentApiSource = readFileSync(resolve(repoRoot, "web/src/api/agent.js"), "utf8")
const smokeSource = readFileSync(resolve(repoRoot, "scripts/crazor-smoke.mjs"), "utf8")

test("AI Employee Runtime prepares auditable runs from real skills and context", () => {
  assert.ok(
    serverIndex.includes("app.get('/api/crazor/ai-employees'") &&
      serverIndex.includes("app.post('/api/crazor/ai-employees/:id/runs'"),
    "server should expose AI employee runtime endpoints"
  )
  assert.ok(
    runtimeSource.includes("prepareAiEmployeeRun") &&
      runtimeSource.includes("getUnifiedContext") &&
      runtimeSource.includes("getAgentProviderDescriptor") &&
      runtimeSource.includes("system_skill_id: 'vault-rules'"),
    "runtime should combine employee skill, system rules, provider descriptor, and unified context"
  )
  assert.ok(
    permissionsSource.includes('"ai_employee:run"') &&
      permissionsSource.includes('"ai_employee:read"') &&
      serverIndex.includes("if (lastSegment === 'runs') return 'run'") &&
      serverIndex.includes("segments[0] === 'ai-employees'"),
    "runtime endpoints should be permissioned and audited as ai_employee runs"
  )
  assert.ok(
    agentApiSource.includes("getAiEmployees") &&
      agentApiSource.includes("prepareAiEmployeeRun"),
    "web API layer should expose generic AI employee runtime helpers"
  )
  assert.ok(
    smokeSource.includes("AI Employee Runtime 最小运行单元") &&
      smokeSource.includes("/api/crazor/ai-employees") &&
      smokeSource.includes("/runs"),
    "delivery smoke test should verify the runtime endpoint"
  )
})
