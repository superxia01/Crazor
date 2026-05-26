// Copyright (c) 2026 MeeJoy
// Notebook / Knowledge — server-side storage (filesystem vault)

async function request(url, options = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${resp.status}`)
  }
  return resp.json()
}

// The server uses a catch-all route that reads the ID from the path.
// We pass the ID as-is — the browser won't re-encode %2F in fetch URLs.
function encId(id) {
  return encodeURIComponent(id)
}

function createServerNotebookStore(scope) {
  const base = `/api/crazor/docs/${scope}`

  return {
    listTree: async () => request(`${base}/tree`),

    createFolder: async (parentId, name) =>
      request(`${base}/folders`, { method: 'POST', body: JSON.stringify({ parentId, name }) }),

    renameFolder: async (folderId, name) =>
      request(`${base}/folders-ops?id=${encId(folderId)}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

    deleteFolder: async (folderId) =>
      request(`${base}/folders-ops?id=${encId(folderId)}`, { method: 'DELETE' }),

    createNote: async (folderId, title) =>
      request(`${base}/notes`, { method: 'POST', body: JSON.stringify({ folderId, title }) }),

    renameNote: async (noteId, title) =>
      request(`${base}/notes-ops?id=${encId(noteId)}`, { method: 'PATCH', body: JSON.stringify({ title }) }),

    deleteNote: async (noteId) =>
      request(`${base}/notes-ops?id=${encId(noteId)}`, { method: 'DELETE' }),

    getNote: async (noteId) => request(`${base}/notes-ops?id=${encId(noteId)}`),

    updateNote: async (noteId, title, content) =>
      request(`${base}/notes-ops?id=${encId(noteId)}`, { method: 'PATCH', body: JSON.stringify({ title, content }) }),

    searchNotes: async (query) =>
      request(`${base}/search?q=${encodeURIComponent(query)}`),

    moveFolder: async (folderId, parentId, targetFolderId = null, position = null) =>
      request(`${base}/folders-ops/move?id=${encId(folderId)}`, {
        method: 'POST',
        body: JSON.stringify({ parentId, targetFolderId, position }),
      }),

    moveNote: async (noteId, folderId, targetNoteId = null, position = null) =>
      request(`${base}/notes-ops/move?id=${encId(noteId)}`, {
        method: 'POST',
        body: JSON.stringify({ folderId, targetNoteId, position }),
      }),
  }
}

// ── Create stores ──

const notebookStore = createServerNotebookStore('notebook')
const knowledgeStore = createServerNotebookStore('knowledge')

// ── Export notebook API (backward-compatible) ──

export const listNotebookTree = notebookStore.listTree
export const createNotebookFolder = notebookStore.createFolder
export const renameNotebookFolder = notebookStore.renameFolder
export const deleteNotebookFolder = notebookStore.deleteFolder
export const createNotebookNote = notebookStore.createNote
export const renameNotebookNote = notebookStore.renameNote
export const deleteNotebookNote = notebookStore.deleteNote
export const getNotebookNote = notebookStore.getNote
export const updateNotebookNote = notebookStore.updateNote
export const searchNotebookNotes = notebookStore.searchNotes
export const moveNotebookFolder = notebookStore.moveFolder
export const moveNotebookNote = notebookStore.moveNote

// ── Export knowledge API ──

export const listKnowledgeTree = knowledgeStore.listTree
export const createKnowledgeFolder = knowledgeStore.createFolder
export const renameKnowledgeFolder = knowledgeStore.renameFolder
export const deleteKnowledgeFolder = knowledgeStore.deleteFolder
export const createKnowledgeNote = knowledgeStore.createNote
export const renameKnowledgeNote = knowledgeStore.renameNote
export const deleteKnowledgeNote = knowledgeStore.deleteNote
export const getKnowledgeNote = knowledgeStore.getNote
export const updateKnowledgeNote = knowledgeStore.updateNote
export const searchKnowledgeNotes = knowledgeStore.searchNotes
export const moveKnowledgeFolder = knowledgeStore.moveFolder
export const moveKnowledgeNote = knowledgeStore.moveNote
