// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)

test("MCP tools do not expose placeholder Getbiji sync capabilities", () => {
  const mcpSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-mcp.ts"), "utf8")
  const dbSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-db.ts"), "utf8")

  for (const toolName of ["getbiji_sync", "getbiji_status", "getbiji_force_full"]) {
    assert.equal(
      mcpSource.includes(toolName),
      false,
      `${toolName} should not be listed or executable before a real adapter exists`
    )
  }

  assert.equal(
    dbSource.includes("Getbiji Stubs"),
    false,
    "database service should not keep Getbiji placeholder implementations"
  )
  assert.equal(
    dbSource.includes("占位返回"),
    false,
    "placeholder sync responses must not be treated as delivery code"
  )
})
