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
export const HERMES_SKILLS_INDEX_URL = 'https://hermes-agent.nousresearch.com/docs/api/skills-index.json'

// ========================
// Fetch market index helper
// ========================
export async function fetchMarketIndex() {
  const response = await fetch(HERMES_SKILLS_INDEX_URL, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch market index: HTTP ${response.status}`)
  }

  const payload = await response.json()
  return Array.isArray(payload?.skills) ? payload.skills : []
}
