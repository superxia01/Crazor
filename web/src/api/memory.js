// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Memory API
// ========================

export async function getMemories(workspaceFilter = null) {
  const query = workspaceFilter ? `?workspace=${encodeURIComponent(workspaceFilter)}` : ''
  return api.get(`/api/memories${query}`)
}

export async function addMemory(summary, content, source = '手动', workspacePath = null) {
  return api.post('/api/memories', {
    summary,
    content,
    source,
    workspace_path: workspacePath,
  })
}

export async function updateMemory(id, summary, content, workspacePath = null) {
  return api.patch(`/api/memories/${encodeURIComponent(id)}`, {
    summary,
    content,
    workspace_path: workspacePath,
  })
}

export async function deleteMemory(id) {
  return api.delete(`/api/memories/${encodeURIComponent(id)}`)
}

export async function compactMemories() {
  return api.post('/api/memories/compact')
}
