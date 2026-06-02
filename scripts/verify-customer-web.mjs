#!/usr/bin/env node

import { fileURLToPath } from "node:url"
import {
  buildCustomerServerUrl,
  extractWebEntrypointAssetPaths,
  requestDesktopText,
  validateWebAssetResponse,
  validateWebEntrypointHtml,
} from "./customer-desktop-smoke.mjs"
import { normalizeServerUrl } from "./verify-customer-server.mjs"

const DEFAULT_TIMEOUT_MS = 8000

export async function verifyCustomerWebEntrypoint({
  serverUrl = "",
  timeoutMs = Number(process.env.CRAZOR_WEB_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl)
  if (!normalizedServerUrl) {
    throw new Error("Web 交付验证需要有效的 http:// 或 https:// 服务地址")
  }

  logger.log(`验证 Web 统一入口：${buildCustomerServerUrl(normalizedServerUrl, "/")}`)
  const web = await requestDesktopText(normalizedServerUrl, "/", {
    timeoutMs,
    fetchImpl,
    expected: [200],
  })
  if (!validateWebEntrypointHtml(web.text)) {
    throw new Error("Web 统一入口未返回 Crazor 前端 HTML，请确认 serverUrl 指向 crazor-web 网关而不是裸后端 API")
  }

  const assets = extractWebEntrypointAssetPaths(web.text, normalizedServerUrl)
  if (assets.length === 0) {
    throw new Error("Web 统一入口未声明可验证的前端静态资源，请确认生产构建产物已部署")
  }

  const webAssetChecks = []
  for (const asset of assets) {
    const response = await requestDesktopText(normalizedServerUrl, asset.path, {
      timeoutMs,
      fetchImpl,
      expected: [200],
      accept: asset.type === "style" ? "text/css,*/*" : "text/javascript,application/javascript,*/*",
    })
    if (!validateWebAssetResponse(asset, response.text, response.contentType)) {
      throw new Error(`${asset.label} ${asset.path} 未返回有效前端资源`)
    }
    webAssetChecks.push({
      path: asset.path,
      type: asset.type,
      status: "ok",
    })
  }

  logger.log(`Web 统一入口通过：已验证 ${webAssetChecks.length} 个前端静态资源`)
  return {
    ok: true,
    serverUrl: normalizedServerUrl,
    webEntrypointChecked: true,
    webAssetChecks,
  }
}

async function main() {
  const serverUrl = process.argv[2] || process.env.CRAZOR_PUBLIC_BASE_URL || process.env.CRAZOR_SMOKE_BASE_URL || "http://127.0.0.1:5173"
  await verifyCustomerWebEntrypoint({ serverUrl })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`Web 交付验证失败: ${error?.message || error}`)
    process.exit(1)
  })
}
