// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Agent API
// ========================

export async function getAgents() {
  return api.get('/api/agents')
}

export async function getAgentProvider() {
  return api.get('/api/agent/provider')
}

export async function getAgentProviderCapabilities() {
  return api.get('/api/agent/provider/capabilities')
}

export async function getAiEmployees() {
  return api.get('/api/crazor/ai-employees')
}

export async function getAiEmployee(id) {
  return api.get(`/api/crazor/ai-employees/${encodeURIComponent(id)}`)
}

export async function prepareAiEmployeeRun(id, payload = {}) {
  return api.post(`/api/crazor/ai-employees/${encodeURIComponent(id)}/runs`, payload)
}
