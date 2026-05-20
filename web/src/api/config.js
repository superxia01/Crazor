// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Config API
// ========================
export async function getConfig() {
  return api.get('/api/config')
}

export async function setConfig(key, value) {
  return api.patch('/api/config', { [key]: value })
}

export async function testGatewayConnection(host, port) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)

  try {
    // Test via our backend health check
    await api.get('/api/health')
    return { ok: true, target: `${host}:${port}` }
  } finally {
    clearTimeout(timeout)
  }
}

export async function getGatewayInfo(host, port) {
  try {
    const data = await api.get('/api/hermes/version')
    return {
      target: `${host}:${port}`,
      version: data?.version || data?.agent_version || null,
    }
  } catch {
    return { target: `${host}:${port}`, version: null }
  }
}

export async function getHermesVersionInfo() {
  try {
    return await api.get('/api/hermes/version')
  } catch {
    return {
      installed_display: null,
      installed_version: null,
      latest_tag: null,
      latest_name: null,
      latest_display: null,
    }
  }
}

export async function updateHermesAgent() {
  return api.post('/api/hermes/update')
}
