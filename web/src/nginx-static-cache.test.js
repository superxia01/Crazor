// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const nginxConfig = readFileSync(resolve(repoRoot, "docker/nginx.conf"), "utf8")

test("nginx never falls back missing built assets to the SPA html shell", () => {
  assert.match(
    nginxConfig,
    /location\s+\/assets\/\s*\{[\s\S]*try_files\s+\$uri\s+@asset_not_found;/,
    "hashed JS/CSS assets must serve only real files"
  )
  assert.match(
    nginxConfig,
    /location\s+@asset_not_found\s*\{[\s\S]*return\s+404;/,
    "missing assets should return 404 instead of index.html"
  )
  assert.match(
    nginxConfig,
    /location\s+=\s+\/index\.html\s*\{[\s\S]*Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate"/,
    "the HTML entrypoint should not be cached across releases"
  )
  assert.match(
    nginxConfig,
    /location\s+\/\s*\{[\s\S]*Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate"[\s\S]*try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/,
    "SPA route fallback can serve index.html, but must not cache it"
  )
})
