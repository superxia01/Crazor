// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const appSource = readFileSync(new URL("../AppInner.jsx", import.meta.url), "utf8")
const dashboardApiSource = readFileSync(new URL("../api/dashboard.js", import.meta.url), "utf8")
const apiIndexSource = readFileSync(new URL("../api/index.js", import.meta.url), "utf8")
const modelConfigUtilsSource = readFileSync(new URL("./model-config-utils.js", import.meta.url), "utf8")

test("sidebar footer exposes a global model switcher above the Hermes version", () => {
  const switcherIndex = appSource.indexOf('data-sidebar-model-switcher="true"')
  const versionIndex = appSource.indexOf("{installedHermesLabel}")

  assert.ok(switcherIndex > -1, "sidebar footer should render a model switcher")
  assert.ok(versionIndex > -1, "sidebar footer should still show the Hermes version")
  assert.ok(
    switcherIndex < versionIndex,
    "model switcher should appear above the Hermes version line"
  )
  assert.ok(appSource.includes("handleSaveSidebarModel"), "save button should persist the selected model")
  assert.ok(
    appSource.includes("modelConfigSupported ? ("),
    "sidebar footer should only expose the model switcher when the current provider declares model-config support"
  )
})

test("model switcher uses the official Hermes model options and set APIs", () => {
  assert.ok(
    dashboardApiSource.includes("export async function getModelOptions()"),
    "dashboard API should expose model options"
  )
  assert.ok(
    dashboardApiSource.includes("export async function setDefaultModel(provider, model)"),
    "dashboard API should expose default model switching"
  )
  assert.ok(
    apiIndexSource.includes("getModelOptions") && apiIndexSource.includes("setDefaultModel"),
    "top-level API index should re-export model switcher functions"
  )
  assert.ok(
    appSource.includes("refreshSidebarModelOptions") &&
      appSource.includes("await setDefaultModel(nextProvider, nextModel)") &&
      appSource.includes("await getModelOptions()"),
    "desktop shell should load model options and persist the selected model through the shared web API layer"
  )
})

test("chat sends with the current global sidebar model after switching", () => {
  assert.ok(
    appSource.includes("const activeGlobalModel = selectorPrimaryModelConfig.model || \"\""),
    "AppInner should derive an authoritative global model from the saved selector config"
  )
  assert.ok(
    appSource.includes("model: activeGlobalModel || null"),
    "sendChatStream should use the current global model instead of stale session model data"
  )
  assert.ok(
    !appSource.includes("model: sessionModel || null"),
    "sendChatStream should not keep using stale per-session model fallback"
  )
  assert.ok(
    appSource.includes("getPrimaryModelValidationError") &&
      modelConfigUtilsSource.includes("主对话模型不能使用") &&
      modelConfigUtilsSource.includes("image_generation"),
    "sidebar model switcher should block saving image-only models as the primary chat model"
  )
})
