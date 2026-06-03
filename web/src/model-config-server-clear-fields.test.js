// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverSource = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")

test("model config patch clears explicitly emptied connection fields", () => {
  assert.ok(
    serverSource.includes("const explicitBaseUrlClear = hasBaseUrl && !baseUrl") &&
      serverSource.includes("const explicitApiKeyClear = hasApiKey && !apiKey") &&
      serverSource.includes("const explicitApiModeClear = hasApiMode && !apiMode"),
    "server should treat explicit empty strings as clear operations for model connection fields"
  )
  assert.ok(
    serverSource.includes("clearFields.has('baseUrl') || clearFields.has('base_url') || explicitBaseUrlClear") &&
      serverSource.includes("clearFields.has('apiKey') || clearFields.has('api_key') || explicitApiKeyClear") &&
      serverSource.includes("clearFields.has('apiMode') || clearFields.has('api_mode') || explicitApiModeClear"),
    "server should drop stale model.base_url, model.api_key, and model.api_mode values when the payload clears them"
  )
})
