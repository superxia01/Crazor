// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const seedSkillsSource = readFileSync(resolve(repoRoot, "server/src/services/seed-skills.ts"), "utf8")
const vaultRulesSource = readFileSync(resolve(repoRoot, "server/data/skills/vault-rules.md"), "utf8")

test("system skills stay available to runtime but hidden from digital employee lists", () => {
  assert.ok(
    vaultRulesSource.includes("system: true") &&
      vaultRulesSource.includes("素材进 notebook，结论进 knowledge，结构化数据走数据库"),
    "vault-rules should be marked as a simplified system-level rule skill"
  )
  assert.ok(
    seedSkillsSource.includes("const isSystem = id === 'vault-rules'") &&
      seedSkillsSource.includes("const category = isSystem ? 'system'"),
    "seeded system skills should keep system category metadata"
  )
  assert.ok(
    serverIndex.includes("publicCrazorSkills()") &&
      serverIndex.includes("skill.category !== 'system'") &&
      serverIndex.includes("System skill cannot be installed as a digital employee") &&
      serverIndex.includes("System skill cannot be removed through digital employee APIs"),
    "digital employee APIs should hide and protect system skills"
  )
})
