// Copyright (c) 2026 MeeJoy

export function normalizeWorkspacePreference(value) {
  return String(value || "").trim().toLowerCase() === "internal" ? "internal" : "customer"
}

export function resolveRequestedWorkspace(location = globalThis.window?.location, env = import.meta.env || {}) {
  try {
    const params = new URLSearchParams(location?.search || "")
    if (params.has("workspace")) {
      return normalizeWorkspacePreference(params.get("workspace"))
    }
    return normalizeWorkspacePreference(env?.VITE_CRAZOR_DEFAULT_WORKSPACE)
  } catch {
    return "customer"
  }
}

export function buildWorkspaceEntryHref(
  workspace = "customer",
  location = globalThis.window?.location,
  env = import.meta.env || {},
) {
  const targetWorkspace = normalizeWorkspacePreference(workspace)
  const defaultWorkspace = normalizeWorkspacePreference(env?.VITE_CRAZOR_DEFAULT_WORKSPACE)
  const pathname = location?.pathname || "/"
  const hash = location?.hash || ""

  try {
    const params = new URLSearchParams(location?.search || "")
    if (targetWorkspace === defaultWorkspace) {
      params.delete("workspace")
    } else {
      params.set("workspace", targetWorkspace)
    }
    const search = params.toString()
    return `${pathname}${search ? `?${search}` : ""}${hash}`
  } catch {
    return pathname || "/"
  }
}

export function resolveSessionWorkspace(userInfo = null) {
  if (!userInfo) return ""
  return userInfo?.portalMode ? "customer" : "internal"
}

export function isWorkspaceSessionCompatible(requestedWorkspace = "customer", userInfo = null) {
  const sessionWorkspace = resolveSessionWorkspace(userInfo)
  if (!sessionWorkspace) return false
  return sessionWorkspace === normalizeWorkspacePreference(requestedWorkspace)
}
