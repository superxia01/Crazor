// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Dashboard / Gateway Process APIs
// ========================

export async function checkDashboardRunning() {
  try {
    await api.get('/api/status')
    return true
  } catch {
    return false
  }
}

export async function checkGatewayRunning() {
  try {
    await api.get('/api/health')
    return true
  } catch {
    return false
  }
}

export async function restartHermesGateway() {
  return api.post('/api/gateway/restart')
}

export async function stopHermesGateway() {
  return api.post('/api/gateway/stop')
}

export async function stopHermesDashboard() {
  return api.post('/api/dashboard/stop')
}

// ========================
// Dashboard Logs / Config APIs
// ========================
export async function getLogs({ file = 'agent', lines = 100, level = 'ALL', component = 'all' } = {}) {
  return api.get(`/api/logs?file=${file}&lines=${lines}&level=${level}&component=${component}`)
}

export async function getEnvVars() {
  return api.get('/api/env')
}

export async function getPrimaryModelConfig() {
  return api.get('/api/model/info')
}

export async function getConfiguredModelCandidates() {
  return api.get('/api/model/options')
}

export async function getModelOptions() {
  return api.get('/api/model/options')
}

export async function setDefaultModel(provider, model) {
  const normalizedProvider = String(provider || '').trim()
  const normalizedModel = String(model || '').trim()

  if (!normalizedProvider || !normalizedModel) {
    throw new Error('Provider and model are required')
  }

  return api.post('/api/model/set', {
    provider: normalizedProvider,
    model: normalizedModel,
  })
}

export async function savePrimaryModelConfig(config) {
  const payload = {
    model: String(config?.model || '').trim(),
    provider: String(config?.provider || '').trim(),
    baseUrl: String(config?.baseUrl || '').trim(),
    apiKey: String(config?.apiKey || '').trim(),
    apiMode: String(config?.apiMode || '').trim(),
    contextLength: config?.contextLength ?? null,
    clearFields: Array.isArray(config?.clearFields) ? config.clearFields : [],
  }

  return api.patch('/api/config', payload)
}

export async function setEnvVar(key, value) {
  return api.post('/api/env', { key, value })
}

export async function deleteEnvVar(key) {
  return api.delete(`/api/env/${encodeURIComponent(key)}`)
}

export async function revealEnvVar(key) {
  return api.get(`/api/env/${encodeURIComponent(key)}/reveal`)
}
