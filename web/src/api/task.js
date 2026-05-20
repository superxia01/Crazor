// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Task API
// ========================

export async function getTasks(workspaceFilter = null) {
  const query = workspaceFilter ? `?workspace=${encodeURIComponent(workspaceFilter)}` : ''
  return api.get(`/api/tasks${query}`)
}

export async function createTask(title, description, dueDate = null, workspacePath = null) {
  return api.post('/api/tasks', {
    title,
    description,
    due_date: dueDate,
    workspace_path: workspacePath,
  })
}

export async function updateTask(id, status) {
  return api.patch(`/api/tasks/${encodeURIComponent(id)}`, { status })
}

export async function deleteTask(id) {
  return api.delete(`/api/tasks/${encodeURIComponent(id)}`)
}
