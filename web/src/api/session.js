// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Session API
// ========================
export async function getSessions(workspaceFilter = null) {
  const query = workspaceFilter ? `?workspace=${encodeURIComponent(workspaceFilter)}` : ''
  return api.get(`/api/sessions${query}`)
}

export async function createSession(title, agentId, workspacePath = null, model = null) {
  return api.post('/api/sessions', {
    title,
    agent_id: agentId,
    workspace_path: workspacePath,
    model,
  })
}

export async function getSessionResponseId(sessionId) {
  const data = await api.get(`/api/sessions/${sessionId}`)
  return data?.response_id || null
}

export async function setSessionResponseId(sessionId, responseId = null) {
  return api.patch(`/api/sessions/${sessionId}`, { response_id: responseId })
}

export async function deleteSession(sessionId) {
  return api.delete(`/api/sessions/${sessionId}`)
}

export async function togglePinSession(sessionId) {
  return api.post(`/api/sessions/${sessionId}/pin`)
}

export async function updateSessionTitle(sessionId, title) {
  return api.patch(`/api/sessions/${sessionId}`, { title })
}

export async function updateSessionModel(sessionId, model = null) {
  return api.patch(`/api/sessions/${sessionId}`, { model })
}

export async function getMessages(sessionId) {
  return api.get(`/api/sessions/${sessionId}/messages`)
}

export async function addMessage(sessionId, role, content) {
  return api.post(`/api/sessions/${sessionId}/messages`, { role, content })
}

export async function savePastedAttachment(workspacePath, fileName, dataBase64, isImage = false) {
  return api.post('/api/files/attachment', {
    workspace_path: workspacePath,
    file_name: fileName,
    data_base64: dataBase64,
    is_image: isImage,
  })
}

export async function importAttachmentFromPath(workspacePath, sourcePath) {
  return api.post('/api/files/import', {
    workspace_path: workspacePath,
    source_path: sourcePath,
  })
}
