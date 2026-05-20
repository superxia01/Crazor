// Copyright (c) 2026 MeeJoy
// Notebook uses localStorage for now — will migrate to SQLite via REST API later.

// ── Factory: creates an isolated notebook store backed by a localStorage key ──

function createNotebookStore(storageKey, defaultFolderName = '默认目录') {
  const DEFAULT_FOLDERS = [
    {
      id: 'folder-default',
      parent_id: null,
      name: defaultFolderName,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
  const DEFAULT_NOTES = []

  function canUseStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  }

  function loadState() {
    if (!canUseStorage()) {
      return { folders: [...DEFAULT_FOLDERS], notes: [...DEFAULT_NOTES] }
    }
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return { folders: [...DEFAULT_FOLDERS], notes: [...DEFAULT_NOTES] }
      const parsed = JSON.parse(raw)
      return {
        folders: Array.isArray(parsed?.folders) ? parsed.folders : [...DEFAULT_FOLDERS],
        notes: Array.isArray(parsed?.notes) ? parsed.notes : [...DEFAULT_NOTES],
      }
    } catch {
      return { folders: [...DEFAULT_FOLDERS], notes: [...DEFAULT_NOTES] }
    }
  }

  let { folders, notes } = loadState()

  function persist() {
    if (!canUseStorage()) return
    window.localStorage.setItem(storageKey, JSON.stringify({ folders, notes }))
  }

  function toTree() {
    return {
      folders: [...folders],
      notes: notes.map(({ content: _content, ...meta }) => meta),
    }
  }

  function reorderIds(ids, movingId, targetId = null, position = null) {
    const next = ids.filter((id) => id !== movingId)
    if (targetId && position) {
      const targetIndex = next.indexOf(targetId)
      const insertIndex = targetIndex < 0 ? next.length : position === 'after' ? targetIndex + 1 : targetIndex
      next.splice(insertIndex, 0, movingId)
      return next
    }
    next.push(movingId)
    return next
  }

  function rewriteFolderOrder(parentId, orderedIds) {
    folders = folders.map((folder) => {
      const index = orderedIds.indexOf(folder.id)
      if (index < 0) return folder
      return { ...folder, parent_id: parentId, sort_order: index, updated_at: new Date().toISOString() }
    })
  }

  function rewriteNoteOrder(folderId, orderedIds) {
    notes = notes.map((note) => {
      const index = orderedIds.indexOf(note.id)
      if (index < 0) return note
      return { ...note, folder_id: folderId, sort_order: index, updated_at: new Date().toISOString() }
    })
  }

  return {
    listTree: async () => toTree(),

    createFolder: async (parentId, name) => {
      const folder = {
        id: `folder-${Date.now()}`,
        parent_id: parentId || null,
        name,
        sort_order: folders.filter((item) => item.parent_id === (parentId || null)).length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      folders.push(folder)
      persist()
      return folder
    },

    renameFolder: async (folderId, name) => {
      folders = folders.map((folder) =>
        folder.id === folderId ? { ...folder, name, updated_at: new Date().toISOString() } : folder,
      )
      persist()
    },

    deleteFolder: async (folderId) => {
      const hasChildFolder = folders.some((folder) => folder.parent_id === folderId)
      const hasChildNote = notes.some((note) => note.folder_id === folderId)
      if (hasChildFolder || hasChildNote) {
        throw new Error('目录下存在目录或笔记，请清除')
      }
      folders = folders.filter((folder) => folder.id !== folderId)
      persist()
    },

    createNote: async (folderId, title) => {
      const note = {
        id: `note-${Date.now()}`,
        folder_id: folderId || null,
        title,
        content: '',
        sort_order: notes.filter((item) => item.folder_id === (folderId || null)).length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      notes.push(note)
      persist()
      return note
    },

    renameNote: async (noteId, title) => {
      notes = notes.map((note) =>
        note.id === noteId ? { ...note, title, updated_at: new Date().toISOString() } : note,
      )
      persist()
    },

    deleteNote: async (noteId) => {
      notes = notes.filter((note) => note.id !== noteId)
      persist()
    },

    getNote: async (noteId) => notes.find((note) => note.id === noteId) || null,

    updateNote: async (noteId, title, content) => {
      notes = notes.map((note) =>
        note.id === noteId
          ? { ...note, title, content, updated_at: new Date().toISOString() }
          : note,
      )
      persist()
    },

    searchNotes: async (query) => {
      const normalized = String(query || '').trim().toLowerCase()
      return notes
        .filter(
          (note) =>
            note.title.toLowerCase().includes(normalized) ||
            note.content.toLowerCase().includes(normalized),
        )
        .map(({ content: _content, ...meta }) => meta)
    },

    moveFolder: async (folderId, parentId, targetFolderId = null, position = null) => {
      const moving = folders.find((folder) => folder.id === folderId)
      const sourceParentId = moving?.parent_id || null
      const targetParentId = parentId || null
      const sourceIds = folders
        .filter((folder) => (folder.parent_id || null) === sourceParentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((folder) => folder.id)
      const targetIds = sourceParentId === targetParentId
        ? sourceIds
        : folders
            .filter((folder) => (folder.parent_id || null) === targetParentId)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((folder) => folder.id)

      const reorderedTargetIds = reorderIds(targetIds, folderId, targetFolderId, position)
      rewriteFolderOrder(targetParentId, reorderedTargetIds)
      if (sourceParentId !== targetParentId) {
        rewriteFolderOrder(sourceParentId, sourceIds.filter((id) => id !== folderId))
      }
      persist()
    },

    moveNote: async (noteId, folderId, targetNoteId = null, position = null) => {
      const moving = notes.find((note) => note.id === noteId)
      const sourceFolderId = moving?.folder_id || null
      const targetFolderId = folderId || null
      const sourceIds = notes
        .filter((note) => (note.folder_id || null) === sourceFolderId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((note) => note.id)
      const targetIds = sourceFolderId === targetFolderId
        ? sourceIds
        : notes
            .filter((note) => (note.folder_id || null) === targetFolderId)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((note) => note.id)

      const reorderedTargetIds = reorderIds(targetIds, noteId, targetNoteId, position)
      rewriteNoteOrder(targetFolderId, reorderedTargetIds)
      if (sourceFolderId !== targetFolderId) {
        rewriteNoteOrder(sourceFolderId, sourceIds.filter((id) => id !== noteId))
      }
      persist()
    },
  }
}

// ── Create stores ──

const notebookStore = createNotebookStore('hermes-browser-notebook', '默认目录')
const knowledgeStore = createNotebookStore('hermes-browser-knowledge', '默认目录')

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
