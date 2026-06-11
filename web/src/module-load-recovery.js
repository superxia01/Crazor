// Copyright (c) 2026 MeeJoy

export const MODULE_LOAD_RELOAD_KEY = "crazor:module-load-reloaded"

export function isModuleLoadError(error) {
  const message = String(error?.message || error || "")
  return (
    /importing a module script failed/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /loading chunk \d+ failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}

export function reloadOnceForModuleLoadError(error, browserWindow = globalThis.window) {
  if (!isModuleLoadError(error) || !browserWindow) return false
  try {
    if (browserWindow.sessionStorage?.getItem(MODULE_LOAD_RELOAD_KEY) === "1") return false
    browserWindow.sessionStorage?.setItem(MODULE_LOAD_RELOAD_KEY, "1")
  } catch {
    // If sessionStorage is unavailable, still try one browser reload.
  }
  browserWindow.location?.reload?.()
  return true
}
