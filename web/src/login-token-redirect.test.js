// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import { consumeLoginTokenFromLocation } from "./api/login-token-redirect.js"

test("login token callback preserves path-prefixed customer web entrypoints", () => {
  const writes = []
  const removals = []
  const replacements = []

  const token = consumeLoginTokenFromLocation({
    location: {
      pathname: "/crazor",
      search: "?token=login.jwt&from=wechat",
      hash: "#ready",
    },
    storage: {
      setItem(key, value) {
        writes.push({ key, value })
      },
      removeItem(key) {
        removals.push(key)
      },
    },
    history: {
      replaceState(state, title, url) {
        replacements.push({ state, title, url })
      },
    },
  })

  assert.equal(token, "login.jwt")
  assert.deepEqual(writes, [{ key: "crazor_token", value: "login.jwt" }])
  assert.deepEqual(removals, ["crazor.actorToken"])
  assert.deepEqual(replacements, [{ state: {}, title: "", url: "/crazor?from=wechat#ready" }])
})

test("login token callback leaves the URL untouched when no token exists", () => {
  let wrote = false
  let replaced = false

  const token = consumeLoginTokenFromLocation({
    location: {
      pathname: "/crazor",
      search: "?from=wechat",
      hash: "#ready",
    },
    storage: {
      setItem() {
        wrote = true
      },
    },
    history: {
      replaceState() {
        replaced = true
      },
    },
  })

  assert.equal(token, "")
  assert.equal(wrote, false)
  assert.equal(replaced, false)
})
