// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildRemoteApiUrl, normalizeRemoteApiBase } from "./api/remote-api-base.js"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const mainSource = readFileSync(resolve(repoRoot, "web/src/main.jsx"), "utf8")
const viteConfig = readFileSync(resolve(repoRoot, "web/vite.config.js"), "utf8")
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")

test("remote API base rewrites only same-origin Crazor API paths", () => {
  assert.equal(normalizeRemoteApiBase(" https://api.example.com/// "), "https://api.example.com")
  assert.equal(
    buildRemoteApiUrl("/api/status?x=1", "https://api.example.com/", "tauri://localhost"),
    "https://api.example.com/api/status?x=1",
  )
  assert.equal(
    buildRemoteApiUrl("tauri://localhost/api/crazor/context#top", "https://api.example.com", "tauri://localhost"),
    "https://api.example.com/api/crazor/context#top",
  )
  assert.equal(
    buildRemoteApiUrl("/mcp", "https://api.example.com", "tauri://localhost"),
    "https://api.example.com/mcp",
  )
  assert.equal(
    buildRemoteApiUrl("https://other.example.com/api/status", "https://api.example.com", "tauri://localhost"),
    "",
  )
})

test("Tauri remote API support is optional and does not replace Docker web defaults", () => {
  assert.ok(
    mainSource.indexOf("installRemoteApiBaseFetch()") < mainSource.indexOf("installCrazorAuthFetch()"),
    "remote API fetch patch should run before auth token patch"
  )
  assert.ok(
    viteConfig.includes("mode === 'tauri'") && viteConfig.includes("base: isTauriBuild ? './' : '/'"),
    "Vite should only use relative asset paths for Tauri builds"
  )
  assert.ok(
    serverIndex.includes("'tauri://localhost'") && serverIndex.includes("'https://tauri.localhost'"),
    "server CORS defaults should allow Tauri origins"
  )
})
