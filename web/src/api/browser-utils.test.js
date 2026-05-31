// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  BROWSER_ENV_STORAGE_KEY,
  HERMES_SKILLS_INDEX_URL,
  fetchMarketIndex,
  loadBrowserEnvVars,
  saveBrowserEnvVars,
} from "./browser-utils.js"

test("market index helper uses the Crazor server proxy", async () => {
  const previousFetch = globalThis.fetch
  let requestedUrl = null
  let requestedOptions = null

  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url)
    requestedOptions = options
    return {
      ok: true,
      async json() {
        return [{ identifier: "crm", name: "CRM" }]
      },
    }
  }

  try {
    const result = await fetchMarketIndex({ limit: 20 })

    assert.equal(HERMES_SKILLS_INDEX_URL, "/api/skills/market")
    assert.equal(requestedUrl, "/api/skills/market?limit=20")
    assert.equal(requestedOptions?.method, "GET")
    assert.equal(requestedOptions?.cache, "no-store")
    assert.deepEqual(result, [{ identifier: "crm", name: "CRM" }])
  } finally {
    globalThis.fetch = previousFetch
  }
})

test("browser env vars persist dashboard settings without server-side mock data", () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  const store = new Map()

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null
      },
      setItem(key, value) {
        store.set(key, String(value))
      },
    },
  })

  try {
    const saved = saveBrowserEnvVars({
      DASHBOARD_HOST: "127.0.0.1",
      DASHBOARD_PORT: 9119,
      "": "ignored",
    })

    assert.deepEqual(saved, {
      DASHBOARD_HOST: "127.0.0.1",
      DASHBOARD_PORT: "9119",
    })
    assert.equal(store.has(BROWSER_ENV_STORAGE_KEY), true)
    assert.deepEqual(loadBrowserEnvVars(), saved)
  } finally {
    if (previousStorage) {
      Object.defineProperty(globalThis, "localStorage", previousStorage)
    } else {
      delete globalThis.localStorage
    }
  }
})
