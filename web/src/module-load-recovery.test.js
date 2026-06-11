// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import { isModuleLoadError, reloadOnceForModuleLoadError, MODULE_LOAD_RELOAD_KEY } from "./module-load-recovery.js"

test("module load recovery detects stale lazy chunk failures", () => {
  assert.equal(isModuleLoadError(new Error("Importing a module script failed.")), true)
  assert.equal(
    isModuleLoadError(new Error("Failed to fetch dynamically imported module: https://example.com/assets/page.js")),
    true
  )
  assert.equal(isModuleLoadError(new Error("Loading chunk 12 failed.")), true)
  assert.equal(isModuleLoadError(new Error("普通渲染错误")), false)
})

test("module load recovery reloads only once per tab", () => {
  const storage = new Map()
  let reloads = 0
  const browserWindow = {
    sessionStorage: {
      getItem(key) {
        return storage.get(key) || null
      },
      setItem(key, value) {
        storage.set(key, String(value))
      },
    },
    location: {
      reload() {
        reloads += 1
      },
    },
  }

  assert.equal(reloadOnceForModuleLoadError(new Error("Importing a module script failed."), browserWindow), true)
  assert.equal(storage.get(MODULE_LOAD_RELOAD_KEY), "1")
  assert.equal(reloads, 1)
  assert.equal(reloadOnceForModuleLoadError(new Error("Importing a module script failed."), browserWindow), false)
  assert.equal(reloads, 1)
  assert.equal(reloadOnceForModuleLoadError(new Error("普通渲染错误"), browserWindow), false)
})
