// Copyright (c) 2026 MeeJoy

const LOGIN_TOKEN_STORAGE_KEY = "crazor_token"

export function consumeLoginTokenFromLocation({
  location = globalThis.window?.location,
  history = globalThis.window?.history,
  storage = globalThis.window?.localStorage,
  tokenKey = LOGIN_TOKEN_STORAGE_KEY,
} = {}) {
  if (!location) return ""

  const params = new URLSearchParams(location.search || "")
  const token = String(params.get("token") || "").trim()
  if (!token) return ""

  storage?.setItem?.(tokenKey, token)
  params.delete("token")

  const pathname = location.pathname || "/"
  const search = params.toString()
  const hash = location.hash || ""
  const nextUrl = `${pathname}${search ? `?${search}` : ""}${hash}`
  history?.replaceState?.({}, "", nextUrl)

  return token
}
