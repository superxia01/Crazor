// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Workspace API
// ========================

export async function getWorkspaces() {
  return api.get('/api/workspaces')
}

export async function setWorkspace(workspaceId) {
  return api.post('/api/workspaces/current', { workspace_id: workspaceId })
}

export async function getCurrentWorkspace() {
  return api.get('/api/workspaces/current')
}

export async function createTerminalSession(workspacePath = null) {
  return api.post('/api/terminal/sessions', { workspace_path: workspacePath })
}

export async function writeTerminalInput(sessionId, data) {
  return api.post(`/api/terminal/sessions/${encodeURIComponent(sessionId)}/input`, { data })
}

export async function resizeTerminalSession(sessionId, cols, rows) {
  return api.post(`/api/terminal/sessions/${encodeURIComponent(sessionId)}/resize`, { cols, rows })
}

export async function closeTerminalSession(sessionId) {
  return api.delete(`/api/terminal/sessions/${encodeURIComponent(sessionId)}`)
}

export async function onTerminalOutput(callback) {
  // Terminal output is not available in web mode without WebSocket
  return () => {}
}

export async function onTerminalExit(callback) {
  return () => {}
}

export async function createWorkspace(name, path, icon = '📁') {
  return api.post('/api/workspaces', { name, path, icon })
}

export async function updateWorkspace(workspaceId, name, path, icon = '📁') {
  return api.patch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, { name, path, icon })
}

export async function deleteWorkspace(workspaceId) {
  return api.delete(`/api/workspaces/${encodeURIComponent(workspaceId)}`)
}
