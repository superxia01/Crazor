// Copyright (c) 2026 MeeJoy

const ACTOR_TOKEN_STORAGE_KEY = "crazor.actorToken"
const LOGIN_TOKEN_STORAGE_KEY = "crazor_token"

export function getCrazorAuthToken() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(ACTOR_TOKEN_STORAGE_KEY) || ""
}

export function setCrazorAuthToken(token) {
  if (typeof window === "undefined") return
  const value = String(token || "").trim()
  if (value) window.localStorage.setItem(ACTOR_TOKEN_STORAGE_KEY, value)
  else window.localStorage.removeItem(ACTOR_TOKEN_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent("crazor-auth-token-change", { detail: { hasToken: Boolean(value) } }))
}

export function clearCrazorAuthToken() {
  setCrazorAuthToken("")
}

export function storeCustomerLoginCredentials(data = {}) {
  if (typeof window === "undefined") return false
  const token = String(data?.token || "").trim()
  if (!token) return false

  window.localStorage.setItem(LOGIN_TOKEN_STORAGE_KEY, token)
  setCrazorAuthToken(data?.actor_token || data?.actorToken || "")
  return true
}

export function maskCrazorToken(token) {
  const value = String(token || "")
  if (!value) return "未设置"
  if (value.length <= 18) return `${value.slice(0, 6)}...`
  return `${value.slice(0, 12)}...${value.slice(-4)}`
}

export function installCrazorAuthFetch() {
  if (typeof window === "undefined" || window.__crazorAuthFetchInstalled) return
  window.__crazorAuthFetchInstalled = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = (input, init = {}) => {
    if (!shouldAttachAuthHeaders(input)) return nativeFetch(input, init)

    const loginToken = getLoginToken()
    const actorToken = getCrazorAuthToken()
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    if (loginToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${loginToken}`)
    }
    if (actorToken && !headers.has("X-Crazor-Token")) {
      headers.set("X-Crazor-Token", actorToken)
    }

    return nativeFetch(input, { ...init, headers })
  }
}

function getLoginToken() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(LOGIN_TOKEN_STORAGE_KEY) || ""
}

function shouldAttachAuthHeaders(input) {
  try {
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url
    if (!rawUrl) return false
    const url = new URL(rawUrl, window.location.origin)
    if (url.origin !== window.location.origin) return false
    return url.pathname === "/api" ||
      url.pathname.startsWith("/api/") ||
      url.pathname === "/mcp" ||
      url.pathname.startsWith("/mcp/")
  } catch {
    return false
  }
}
