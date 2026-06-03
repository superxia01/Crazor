// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  buildWorkspaceEntryHref,
  isWorkspaceSessionCompatible,
  resolveRequestedWorkspace,
  resolveSessionWorkspace,
} from "./api/login-entry.js"

test("login entry helper defaults to customer workspace", () => {
  assert.equal(resolveRequestedWorkspace({ search: "" }), "customer")
  assert.equal(resolveRequestedWorkspace({ search: "?workspace=customer" }), "customer")
})

test("login entry helper recognizes internal workspace query", () => {
  assert.equal(resolveRequestedWorkspace({ search: "?workspace=internal" }), "internal")
  assert.equal(resolveRequestedWorkspace({ search: "?from=wechat&workspace=internal", hash: "#ready" }), "internal")
})

test("login entry helper can use an environment default workspace", () => {
  assert.equal(resolveRequestedWorkspace({ search: "" }, { VITE_CRAZOR_DEFAULT_WORKSPACE: "internal" }), "internal")
  assert.equal(resolveRequestedWorkspace({ search: "?workspace=customer" }, { VITE_CRAZOR_DEFAULT_WORKSPACE: "internal" }), "customer")
})

test("login entry helper builds visible workspace switch links", () => {
  assert.equal(
    buildWorkspaceEntryHref("internal", { pathname: "/", search: "", hash: "" }),
    "/?workspace=internal",
  )
  assert.equal(
    buildWorkspaceEntryHref("internal", { pathname: "/", search: "?from=wechat", hash: "#ready" }),
    "/?from=wechat&workspace=internal#ready",
  )
  assert.equal(
    buildWorkspaceEntryHref("customer", { pathname: "/", search: "?workspace=internal&from=wechat", hash: "#ready" }),
    "/?from=wechat#ready",
  )
  assert.equal(
    buildWorkspaceEntryHref("customer", { pathname: "/", search: "", hash: "" }, { VITE_CRAZOR_DEFAULT_WORKSPACE: "internal" }),
    "/?workspace=customer",
  )
  assert.equal(
    buildWorkspaceEntryHref("internal", { pathname: "/", search: "?workspace=customer", hash: "" }, { VITE_CRAZOR_DEFAULT_WORKSPACE: "internal" }),
    "/",
  )
})

test("login entry helper detects mismatched session workspace", () => {
  assert.equal(resolveSessionWorkspace({ portalMode: true }), "customer")
  assert.equal(resolveSessionWorkspace({ portalMode: false }), "internal")
  assert.equal(isWorkspaceSessionCompatible("customer", { portalMode: true }), true)
  assert.equal(isWorkspaceSessionCompatible("internal", { portalMode: true }), false)
  assert.equal(isWorkspaceSessionCompatible("internal", { portalMode: false }), true)
})
