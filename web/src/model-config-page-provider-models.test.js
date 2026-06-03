// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const modelConfigPageSource = readFileSync(new URL("./ModelConfigPage.jsx", import.meta.url), "utf8")

test("provider model config loads provider model options and exposes a guided picker", () => {
  assert.ok(
    modelConfigPageSource.includes("getModelOptions"),
    "model config page should request provider model options from the shared API layer"
  )
  assert.ok(
    modelConfigPageSource.includes("selectedProviderModelSuggestions"),
    "provider dialog should derive provider-scoped model suggestions"
  )
  assert.ok(
    modelConfigPageSource.includes("suggestions={selectedProviderModelSuggestions}") &&
      modelConfigPageSource.includes("可选模型"),
    "provider dialog should expose a model picker while keeping the manual field"
  )
})
