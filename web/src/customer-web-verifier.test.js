// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import { verifyCustomerWebEntrypoint } from "../../scripts/verify-customer-web.mjs"

function textResponse(body, contentType) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": contentType },
  })
}

test("customer web verifier validates the web shell and static assets", async () => {
  const requestedUrls = []
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url))
    const pathname = new URL(url).pathname
    if (pathname === "/crazor/") {
      return textResponse(
        '<!doctype html><html><head><title>Crazor</title><link rel="stylesheet" href="assets/app.css"></head><body><div id="root"></div><script type="module" src="assets/app.js"></script></body></html>',
        "text/html",
      )
    }
    if (pathname === "/crazor/assets/app.css") {
      return textResponse(".app { color: #111; }", "text/css")
    }
    if (pathname === "/crazor/assets/app.js") {
      return textResponse("const app = 'crazor'; export { app };", "text/javascript")
    }
    return new Response("not found", { status: 404 })
  }

  const result = await verifyCustomerWebEntrypoint({
    serverUrl: "https://client.example.com/crazor",
    fetchImpl,
    logger: { log() {} },
  })

  assert.equal(result.ok, true)
  assert.equal(result.webEntrypointChecked, true)
  assert.equal(result.webAssetChecks.length, 2)
  assert.deepEqual(requestedUrls, [
    "https://client.example.com/crazor/",
    "https://client.example.com/crazor/assets/app.css",
    "https://client.example.com/crazor/assets/app.js",
  ])
})

test("customer web verifier rejects a backend API response served at the web URL", async () => {
  const fetchImpl = async () => textResponse('{"ok":true}', "application/json")

  await assert.rejects(
    verifyCustomerWebEntrypoint({
      serverUrl: "https://client.example.com",
      fetchImpl,
      logger: { log() {} },
    }),
    /未返回 Crazor 前端 HTML/,
  )
})
