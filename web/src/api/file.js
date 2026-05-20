// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// File API
// ========================

export async function listDirectory(path, workspacePath = null) {
  const params = new URLSearchParams({ path })
  if (workspacePath) params.set('workspace', workspacePath)
  return api.get(`/api/files/list?${params}`)
}

export async function readFile(path, workspacePath = null) {
  const params = new URLSearchParams({ path })
  if (workspacePath) params.set('workspace', workspacePath)
  return api.get(`/api/files/read?${params}`)
}

export async function getFilePreview(path, workspacePath = null) {
  const params = new URLSearchParams({ path })
  if (workspacePath) params.set('workspace', workspacePath)
  return api.get(`/api/files/preview?${params}`)
}

export async function openFileExternal(path, workspacePath = null) {
  return api.post('/api/files/open', { path, workspace_path: workspacePath })
}

export async function writeFile(path, content, workspacePath = null) {
  return api.post('/api/files/write', { path, content, workspace_path: workspacePath })
}

export async function deleteFile(path, workspacePath = null) {
  const params = new URLSearchParams({ path })
  if (workspacePath) params.set('workspace', workspacePath)
  return api.delete(`/api/files?${params}`)
}

export async function createDirectory(path, workspacePath = null) {
  return api.post('/api/files/mkdir', { path, workspace_path: workspacePath })
}
