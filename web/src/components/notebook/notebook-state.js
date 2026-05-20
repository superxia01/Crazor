// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createNotebookFolder,
  createNotebookNote,
  deleteNotebookFolder,
  deleteNotebookNote,
  getNotebookNote,
  listNotebookTree,
  moveNotebookFolder,
  moveNotebookNote,
  renameNotebookFolder,
  renameNotebookNote,
  searchNotebookNotes,
  updateNotebookNote,
  createKnowledgeFolder,
  createKnowledgeNote,
  deleteKnowledgeFolder,
  deleteKnowledgeNote,
  getKnowledgeNote,
  listKnowledgeTree,
  moveKnowledgeFolder,
  moveKnowledgeNote,
  renameKnowledgeFolder,
  renameKnowledgeNote,
  searchKnowledgeNotes,
  updateKnowledgeNote,
} from "@/api"
import { toast } from "sonner"

// Global UI state per scope (survives remounts, not page reloads)
const UI_STATE = {
  notebook: { selectedNoteId: null, expandedFolderIds: new Set(), searchQuery: "", editorMode: "edit" },
  knowledge: { selectedNoteId: null, expandedFolderIds: new Set(), searchQuery: "", editorMode: "edit" },
}

function getApi(scope) {
  if (scope === "knowledge") {
    return {
      listTree: listKnowledgeTree,
      createFolder: createKnowledgeFolder,
      renameFolder: renameKnowledgeFolder,
      deleteFolder: deleteKnowledgeFolder,
      createNote: createKnowledgeNote,
      renameNote: renameKnowledgeNote,
      deleteNote: deleteKnowledgeNote,
      getNote: getKnowledgeNote,
      updateNote: updateKnowledgeNote,
      searchNotes: searchKnowledgeNotes,
      moveFolder: moveKnowledgeFolder,
      moveNote: moveKnowledgeNote,
    }
  }
  return {
    listTree: listNotebookTree,
    createFolder: createNotebookFolder,
    renameFolder: renameNotebookFolder,
    deleteFolder: deleteNotebookFolder,
    createNote: createNotebookNote,
    renameNote: renameNotebookNote,
    deleteNote: deleteNotebookNote,
    getNote: getNotebookNote,
    updateNote: updateNotebookNote,
    searchNotes: searchNotebookNotes,
    moveFolder: moveNotebookFolder,
    moveNote: moveNotebookNote,
  }
}

export function useNotebookState(scope = "notebook") {
  const api = getApi(scope)
  const ui = UI_STATE[scope]

  const [tree, setTree] = useState({ folders: [], notes: [] })
  const [selectedNoteId, setSelectedNoteId] = useState(() => ui.selectedNoteId)
  const [selectedNote, setSelectedNote] = useState(null)
  const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set(ui.expandedFolderIds))
  const [searchQuery, setSearchQuery] = useState(() => ui.searchQuery)
  const [editorMode, setEditorMode] = useState(() => ui.editorMode)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftContent, setDraftContent] = useState("")
  const [saveStatus, setSaveStatus] = useState("idle")
  const [loadingTree, setLoadingTree] = useState(true)
  const [isDirty, setIsDirty] = useState(false)

  const buildSearchScopedTree = useCallback((baseTree, matchedNotes) => {
    const folderById = new Map(baseTree.folders.map((folder) => [folder.id, folder]))
    const visibleFolderIds = new Set()

    for (const note of matchedNotes) {
      let currentFolderId = note.folder_id || null
      while (currentFolderId) {
        if (visibleFolderIds.has(currentFolderId)) break
        visibleFolderIds.add(currentFolderId)
        currentFolderId = folderById.get(currentFolderId)?.parent_id || null
      }
    }

    return {
      folders: baseTree.folders.filter((folder) => visibleFolderIds.has(folder.id)),
      notes: matchedNotes,
      expandedFolderIds: visibleFolderIds,
    }
  }, [])

  const refreshTree = useCallback(async () => {
    setLoadingTree(true)
    try {
      const baseTree = await api.listTree()
      if (searchQuery.trim()) {
        const matchedNotes = await api.searchNotes(searchQuery)
        const scopedTree = buildSearchScopedTree(baseTree, matchedNotes)
        setTree({ folders: scopedTree.folders, notes: scopedTree.notes })
        setExpandedFolderIds(scopedTree.expandedFolderIds)
      } else {
        setTree(baseTree)
      }
    } finally {
      setLoadingTree(false)
    }
  }, [api, buildSearchScopedTree, searchQuery])

  useEffect(() => {
    void refreshTree()
  }, [refreshTree])

  useEffect(() => { ui.selectedNoteId = selectedNoteId }, [selectedNoteId, ui])
  useEffect(() => { ui.expandedFolderIds = new Set(expandedFolderIds) }, [expandedFolderIds, ui])
  useEffect(() => { ui.searchQuery = searchQuery }, [searchQuery, ui])
  useEffect(() => { ui.editorMode = editorMode }, [editorMode, ui])

  useEffect(() => {
    if (!selectedNoteId) {
      setSelectedNote(null)
      setDraftTitle("")
      setDraftContent("")
      setIsDirty(false)
      return
    }

    let active = true
    void api.getNote(selectedNoteId).then((note) => {
      if (!active || !note) return
      setSelectedNote(note)
      setDraftTitle(note.title)
      setDraftContent(note.content)
      setIsDirty(false)
    })

    return () => { active = false }
  }, [selectedNoteId, api])

  useEffect(() => {
    if (!selectedNoteId || !selectedNote || !isDirty) return
    const normalizedTitle = draftTitle.trim() || "未命名笔记"
    const unchanged =
      normalizedTitle === (selectedNote.title || "未命名笔记") &&
      draftContent === (selectedNote.content || "")

    if (unchanged) {
      if (saveStatus !== "saved") setSaveStatus("saved")
      return
    }

    setSaveStatus("saving")
    const timer = window.setTimeout(() => {
      void api.updateNote(selectedNoteId, normalizedTitle, draftContent).then(() => {
        setSaveStatus("saved")
        setSelectedNote((current) =>
          current
            ? { ...current, title: normalizedTitle, content: draftContent }
            : current
        )
        setTree((current) => ({
          ...current,
          notes: current.notes.map((note) =>
            note.id === selectedNoteId
              ? { ...note, title: normalizedTitle, updated_at: new Date().toISOString() }
              : note
          ),
        }))
        setIsDirty(false)
      })
    }, 600)

    return () => { window.clearTimeout(timer) }
  }, [draftContent, draftTitle, isDirty, saveStatus, selectedNote, selectedNoteId, api])

  const toggleFolder = useCallback((folderId) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }, [])

  const expandFolder = useCallback((folderId) => {
    if (!folderId) return
    setExpandedFolderIds((current) => {
      if (current.has(folderId)) return current
      return new Set([...current, folderId])
    })
  }, [])

  const createFolder = useCallback(async (parentId = null) => {
    await api.createFolder(parentId, "新建目录")
    await refreshTree()
    if (parentId) {
      setExpandedFolderIds((current) => new Set([...current, parentId]))
    }
  }, [refreshTree, api])

  const createNote = useCallback(async (folderId = null) => {
    const note = await api.createNote(folderId, "未命名笔记")
    await refreshTree()
    setSelectedNoteId(note.id)
    if (folderId) {
      setExpandedFolderIds((current) => new Set([...current, folderId]))
    }
  }, [refreshTree, api])

  const renameFolder = useCallback(async (folderId, name) => {
    await api.renameFolder(folderId, name)
    await refreshTree()
  }, [refreshTree, api])

  const renameNote = useCallback(async (noteId, title) => {
    await api.renameNote(noteId, title)
    await refreshTree()
    if (selectedNoteId === noteId) {
      setDraftTitle(title)
    }
  }, [refreshTree, selectedNoteId, api])

  const removeFolder = useCallback(async (folderId) => {
    try {
      await api.deleteFolder(folderId)
      await refreshTree()
      if (selectedNote?.folder_id === folderId) {
        setSelectedNoteId(null)
      }
    } catch (error) {
      toast.error(String(error?.message || error) || "删除目录失败")
    }
  }, [refreshTree, selectedNote, api])

  const removeNote = useCallback(async (noteId) => {
    await api.deleteNote(noteId)
    await refreshTree()
    if (selectedNoteId === noteId) {
      setSelectedNoteId(null)
    }
  }, [refreshTree, selectedNoteId, api])

  const moveFolder = useCallback(async (folderId, parentId, targetFolderId = null, position = null) => {
    await api.moveFolder(folderId, parentId, targetFolderId, position)
    await refreshTree()
    if (parentId) {
      setExpandedFolderIds((current) => new Set([...current, parentId]))
    }
  }, [refreshTree, api])

  const moveNote = useCallback(async (noteId, folderId, targetNoteId = null, position = null) => {
    await api.moveNote(noteId, folderId, targetNoteId, position)
    await refreshTree()
    if (folderId) {
      setExpandedFolderIds((current) => new Set([...current, folderId]))
    }
  }, [refreshTree, api])

  const treeMap = useMemo(() => {
    const foldersByParent = new Map()
    const notesByFolder = new Map()
    const foldersById = new Map()

    for (const folder of tree.folders) {
      const key = folder.parent_id || "root"
      const list = foldersByParent.get(key) || []
      list.push(folder)
      foldersByParent.set(key, list)
      foldersById.set(folder.id, folder)
    }

    for (const note of tree.notes) {
      const key = note.folder_id || "root"
      const list = notesByFolder.get(key) || []
      list.push(note)
      notesByFolder.set(key, list)
    }

    return { foldersByParent, notesByFolder, foldersById }
  }, [tree])

  return {
    tree,
    treeMap,
    loadingTree,
    selectedNoteId,
    selectedNote,
    expandedFolderIds,
    searchQuery,
    editorMode,
    draftTitle,
    draftContent,
    saveStatus,
    setSelectedNoteId,
    setSearchQuery,
    setEditorMode,
    setDraftTitle: (value) => {
      setDraftTitle(value)
      setIsDirty(true)
    },
    setDraftContent: (value) => {
      setDraftContent(value)
      setIsDirty(true)
    },
    toggleFolder,
    expandFolder,
    createFolder,
    createNote,
    renameFolder,
    renameNote,
    removeFolder,
    removeNote,
    moveFolder,
    moveNote,
    refreshTree,
  }
}
