// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  getCrazorAuthToken,
  storeCustomerLoginCredentials,
} from "./api/crazor-auth.js"

function installWindowStub() {
  const previousWindow = globalThis.window
  const previousCustomEvent = globalThis.CustomEvent
  const storage = new Map()
  const events = []

  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type
      this.detail = init.detail
    }
  }
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, String(value))
      },
      removeItem(key) {
        storage.delete(key)
      },
    },
    dispatchEvent(event) {
      events.push(event)
      return true
    },
  }

  return {
    events,
    storage,
    restore() {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
      if (previousCustomEvent === undefined) delete globalThis.CustomEvent
      else globalThis.CustomEvent = previousCustomEvent
    },
  }
}

test("customer login credentials replace stale actor tokens", () => {
  const stub = installWindowStub()
  try {
    assert.equal(storeCustomerLoginCredentials({ token: " login.jwt ", actor_token: " czr_fresh " }), true)
    assert.equal(stub.storage.get("crazor_token"), "login.jwt")
    assert.equal(getCrazorAuthToken(), "czr_fresh")
    assert.equal(stub.events.at(-1)?.detail?.hasToken, true)

    assert.equal(storeCustomerLoginCredentials({ token: "next.jwt" }), true)
    assert.equal(stub.storage.get("crazor_token"), "next.jwt")
    assert.equal(getCrazorAuthToken(), "")
    assert.equal(stub.events.at(-1)?.detail?.hasToken, false)

    assert.equal(storeCustomerLoginCredentials({ actor_token: "czr_without_jwt" }), false)
    assert.equal(stub.storage.get("crazor_token"), "next.jwt")
    assert.equal(getCrazorAuthToken(), "")
  } finally {
    stub.restore()
  }
})
