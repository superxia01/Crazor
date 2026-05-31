// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)

test("frontend does not keep standalone browser mock data modules", () => {
  assert.equal(
    existsSync(resolve(repoRoot, "web/src/api/mock-data.js")),
    false,
    "frontend mock-data module should not exist in the delivery code"
  )
})

test("manual mock database seeding script is not part of delivery code", () => {
  assert.equal(
    existsSync(resolve(repoRoot, "server/seed-mock.js")),
    false,
    "manual seed-mock script should not exist because it can pollute real demos"
  )
})

test("content demo records are gated by CRAZOR_SEED_DEMO_DATA", () => {
  const dbSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-db.ts"), "utf8")
  const indexSource = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")

  assert.ok(
    dbSource.includes("CRAZOR_SEED_DEMO_DATA"),
    "content demo seeding must be controlled by the shared demo-data environment switch"
  )
  assert.ok(
    dbSource.includes("if (!shouldSeedDemoData()) return 0"),
    "content demo seeding should be a no-op by default"
  )
  assert.ok(
    indexSource.includes("seedContentPieces()"),
    "startup can call the seeder only because the seeder is internally gated"
  )
})
