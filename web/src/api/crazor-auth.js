// Copyright (c) 2026 MeeJoy

const STORAGE_KEY = "crazor.actorToken"

export function getCrazorAuthToken() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(STORAGE_KEY) || ""
}

export function setCrazorAuthToken(token) {
  if (typeof window === "undefined") return
  const value = String(token || "").trim()
  if (value) window.localStorage.setItem(STORAGE_KEY, value)
  else window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent("crazor-auth-token-change", { detail: { hasToken: Boolean(value) } }))
}

export function clearCrazorAuthToken() {
  setCrazorAuthToken("")
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
    const token = getCrazorAuthToken()
    if (!token || !shouldAttachToken(input)) return nativeFetch(input, init)

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    if (!headers.has("Authorization") && !headers.has("X-Crazor-Token")) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    return nativeFetch(input, { ...init, headers })
  }
}

function shouldAttachToken(input) {
  try {
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url
    if (!rawUrl) return false
    const url = new URL(rawUrl, window.location.origin)
    if (url.origin !== window.location.origin) return false
    return url.pathname.startsWith("/api/crazor/") || url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")
  } catch {
    return false
  }
}
