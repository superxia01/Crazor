// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Hermes Config API (USER.md, SOUL.md, MEMORY.md)
// ========================

export async function readHermesUserConfig() {
  try {
    return await api.get('/api/hermes-config/user')
  } catch {
    return ''
  }
}

export async function writeHermesUserConfig(content) {
  return api.post('/api/hermes-config/user', { content: String(content || '') })
}

export async function readHermesSoulConfig() {
  try {
    return await api.get('/api/hermes-config/soul')
  } catch {
    return ''
  }
}

export async function writeHermesSoulConfig(content) {
  return api.post('/api/hermes-config/soul', { content: String(content || '') })
}

export async function readHermesMemoryConfig() {
  try {
    return await api.get('/api/hermes-config/memory')
  } catch {
    return ''
  }
}
