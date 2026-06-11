// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")

test("team member login sessions bypass missing actor-token short circuit", () => {
  assert.ok(
    serverIndex.includes("actor?.source === 'login-jwt' && (actor as any)?.role"),
    "Crazor REST middleware should recognize role-bound login JWT sessions"
  )
  assert.ok(
    serverIndex.includes("!extractActorToken(c) &&\n    !(actor?.source === 'login-jwt' && (actor as any)?.role)") &&
      serverIndex.indexOf("!(actor?.source === 'login-jwt' && (actor as any)?.role)") <
        serverIndex.indexOf("const missingActor = { actor_type: 'human', actor_id: 'missing-token', source: 'missing-token' }"),
    "role-bound team sessions should not be rejected by the missing-token guard before role permissions run"
  )
  assert.ok(
    serverIndex.includes("extractActorToken(c) || (actor?.source === 'login-jwt' && (actor as any)?.role)") &&
      serverIndex.includes("const permission = evaluateReadPermission(readActor, sensitiveRead.entity)") &&
      serverIndex.includes("const permission = evaluateReadPermission(readActor, businessRead.entity)"),
    "role-bound team sessions should also satisfy protected read permission evaluation"
  )
})
