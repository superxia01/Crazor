// Copyright (c) 2026 MeeJoy

const REMOTE_API_PREFIXES = ["/api", "/mcp"]

export function normalizeRemoteApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "")
}

export function buildRemoteApiUrl(input, apiBase, origin = browserOrigin()) {
  const base = normalizeRemoteApiBase(apiBase)
  if (!base || !origin) return ""

  const rawUrl = readRequestUrl(input)
  if (!rawUrl) return ""

  let url
  try {
    url = new URL(rawUrl, origin)
  } catch {
    return ""
  }

  if (!isSameRequestOrigin(url, origin)) return ""
  if (!isRemoteApiPath(url.pathname)) return ""

  return `${base}${url.pathname}${url.search}${url.hash}`
}

export function installRemoteApiBaseFetch(apiBase = configuredRemoteApiBase()) {
  if (typeof window === "undefined" || window.__crazorRemoteApiBaseFetchInstalled) return

  const base = normalizeRemoteApiBase(apiBase)
  if (!base) return

  window.__crazorRemoteApiBaseFetchInstalled = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = (input, init) => {
    const remoteUrl = buildRemoteApiUrl(input, base, window.location.origin)
    if (!remoteUrl) return nativeFetch(input, init)

    if (typeof Request !== "undefined" && input instanceof Request) {
      return nativeFetch(new Request(remoteUrl, input), init)
    }

    return nativeFetch(remoteUrl, init)
  }
}

export function getRemoteApiRuntimeInfo(apiBase = configuredRemoteApiBase(), origin = browserOrigin()) {
  const base = normalizeRemoteApiBase(apiBase)
  const healthUrl = base ? buildRemoteApiUrl("/api/health", base, origin) : "/api/health"
  return {
    enabled: Boolean(base),
    base,
    healthUrl: healthUrl || "/api/health",
  }
}

export async function checkRemoteApiHealth({
  apiBase = configuredRemoteApiBase(),
  origin = browserOrigin(),
  fetchImpl = globalThis.fetch,
} = {}) {
  const info = getRemoteApiRuntimeInfo(apiBase, origin)
  const startedAt = Date.now()
  const response = await fetchImpl(info.healthUrl, {
    headers: { Accept: "application/json" },
  })
  const latencyMs = Date.now() - startedAt
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return {
    ...info,
    ok: true,
    status: response.status,
    latencyMs,
  }
}

export function configuredRemoteApiBase() {
  return import.meta.env?.VITE_API_BASE || ""
}

function browserOrigin() {
  if (typeof window === "undefined") return ""
  return window.location.origin
}

function readRequestUrl(input) {
  if (typeof input === "string" || input instanceof URL) return String(input)
  return input?.url ? String(input.url) : ""
}

function isSameRequestOrigin(url, origin) {
  try {
    const originUrl = new URL(origin)
    if (url.origin !== "null" && originUrl.origin !== "null") {
      return url.origin === originUrl.origin
    }
    return url.protocol === originUrl.protocol && url.host === originUrl.host
  } catch {
    return false
  }
}

function isRemoteApiPath(pathname) {
  return REMOTE_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
