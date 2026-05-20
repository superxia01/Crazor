// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Agent API
// ========================

export async function getAgents() {
  return api.get('/api/agents')
}
