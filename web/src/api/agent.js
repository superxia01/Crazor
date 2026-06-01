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
