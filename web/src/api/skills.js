// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Skills API
// ========================
export async function getSkills() {
  return api.get('/api/skills')
}

export async function getSkillDetail(name) {
  return api.get(`/api/skills/${encodeURIComponent(name)}`)
}

export async function toggleSkill(name, enabled) {
  return api.patch(`/api/skills/${encodeURIComponent(name)}`, { enabled })
}

export async function getToolsets() {
  return api.get('/api/tools/toolsets')
}

export async function getMarketSkills() {
  return api.get('/api/skills/market')
}

export async function installSkill(identifier) {
  return api.post('/api/skills/install', { identifier })
}

export async function uninstallSkill(name) {
  return api.post('/api/skills/uninstall', { name })
}

export async function checkSkillUpdates(name = null) {
  return api.post('/api/skills/check-updates', { name })
}

export async function updateSkill(name = null) {
  return api.post('/api/skills/update', { name })
}

export async function inspectMarketSkill(identifier) {
  return api.get(`/api/skills/market/${encodeURIComponent(identifier)}`)
}
