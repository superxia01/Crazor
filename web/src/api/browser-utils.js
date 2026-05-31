// Copyright (c) 2026 MeeJoy
// Platform detection utilities (Tauri-free)

// ========================
// Platform detection
// ========================

export function getPlatform() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (ua.includes('Mac')) return 'darwin'
  if (ua.includes('Win')) return 'win32'
  if (ua.includes('Linux')) return 'linux'
  return 'unknown'
}

export function isMac() {
  return getPlatform() === 'darwin'
}

export function isWindows() {
  return getPlatform() === 'win32'
}

export function isLinux() {
  return getPlatform() === 'linux'
}

// ========================
// Skills index URL
// ========================
export const HERMES_SKILLS_INDEX_URL = '/api/skills/market'
export const BROWSER_ENV_STORAGE_KEY = 'crazor.browserEnvVars'

function sanitizeEnvVars(vars) {
  const next = {}
  for (const [key, value] of Object.entries(vars || {})) {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) continue
    next[normalizedKey] = value === null || value === undefined ? '' : String(value)
  }
  return next
}

function getBrowserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadBrowserEnvVars() {
  const storage = getBrowserStorage()
  if (!storage) return {}
  try {
    return sanitizeEnvVars(JSON.parse(storage.getItem(BROWSER_ENV_STORAGE_KEY) || '{}'))
  } catch {
    return {}
  }
}

export function saveBrowserEnvVars(vars) {
  const next = sanitizeEnvVars(vars)
  const storage = getBrowserStorage()
  if (storage) {
    storage.setItem(BROWSER_ENV_STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

// ========================
// Fetch market index helper
// ========================
export async function fetchMarketIndex({ limit } = {}) {
  const query = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? `?limit=${Math.floor(Number(limit))}`
    : ''
  const response = await fetch(`${HERMES_SKILLS_INDEX_URL}${query}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch market index: HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload?.skills) ? payload.skills : []
}
