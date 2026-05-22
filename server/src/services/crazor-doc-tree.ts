// Copyright (c) 2026 MeeJoy
// Document tree CRUD — SQLite metadata + filesystem .md content

import { resolve } from "path"
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs"
import { db, id, now } from "./crazor-db"
import { CRAZOR_DOCS_ROOT as DOCS_ROOT } from "./crazor-config"

function noteFilePath(scope: string, noteId: string) {
  return resolve(DOCS_ROOT, scope, `${noteId}.md`)
}

function ensureScopeDir(scope: string) {
  const dir = resolve(DOCS_ROOT, scope)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── Tree operations ─────────────────────────────────────────

export function listTree(scope: string) {
  ensureDefaultFolder(scope)
  const folders = db.prepare("SELECT id, scope, parent_id, name, sort_order, contact_id, created_at, updated_at FROM doc_folders WHERE scope = ? ORDER BY sort_order").all(scope)
  const notes = db.prepare("SELECT id, scope, folder_id, title, sort_order, contact_id, created_at, updated_at FROM doc_notes WHERE scope = ? ORDER BY sort_order").all(scope)
  return { folders, notes }
}

export function ensureDefaultFolder(scope: string) {
  const count = (db.prepare("SELECT count(*) as c FROM doc_folders WHERE scope = ?").get(scope) as any).c
  if (count === 0) {
    const ts = now()
    db.prepare("INSERT INTO doc_folders (id, scope, parent_id, name, sort_order, contact_id, created_at, updated_at) VALUES (?,?,NULL,?,0,NULL,?,?)")
      .run(`folder-default-${scope}`, scope, "默认目录", ts, ts)
  }
}

export function createFolder(scope: string, parentId: string | null, name: string) {
  const maxOrder = (db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM doc_folders WHERE scope = ? AND parent_id IS ?").get(scope, parentId) as any).n
  const f = {
    id: `folder-${id()}`, scope, parent_id: parentId || null, name,
    sort_order: maxOrder, contact_id: null as string | null,
    created_at: now(), updated_at: now(),
  }
  db.prepare("INSERT INTO doc_folders (id,scope,parent_id,name,sort_order,contact_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(f.id, f.scope, f.parent_id, f.name, f.sort_order, f.contact_id, f.created_at, f.updated_at)
  return f
}

export function renameFolder(folderId: string, name: string) {
  db.prepare("UPDATE doc_folders SET name = ?, updated_at = ? WHERE id = ?").run(name, now(), folderId)
}

export function deleteFolder(folderId: string) {
  const hasChildFolders = (db.prepare("SELECT count(*) as c FROM doc_folders WHERE parent_id = ?").get(folderId) as any).c
  if (hasChildFolders > 0) throw new Error("目录下存在子目录，请先清除")
  const hasChildNotes = (db.prepare("SELECT count(*) as c FROM doc_notes WHERE folder_id = ?").get(folderId) as any).c
  if (hasChildNotes > 0) throw new Error("目录下存在笔记，请先清除")
  db.prepare("DELETE FROM doc_folders WHERE id = ?").run(folderId)
}

export function createNote(scope: string, folderId: string | null, title: string, content?: string, contactId?: string) {
  ensureScopeDir(scope)
  const maxOrder = (db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM doc_notes WHERE scope = ? AND folder_id IS ?").get(scope, folderId) as any).n
  const noteId = `note-${id()}`
  const n = {
    id: noteId, scope, folder_id: folderId || null, title,
    sort_order: maxOrder, contact_id: contactId || null,
    created_at: now(), updated_at: now(),
  }
  db.prepare("INSERT INTO doc_notes (id,scope,folder_id,title,sort_order,contact_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(n.id, n.scope, n.folder_id, n.title, n.sort_order, n.contact_id, n.created_at, n.updated_at)
  // Create .md file with content (or empty)
  writeFileSync(noteFilePath(scope, noteId), content || "", "utf-8")
  return n
}

export function getNote(noteId: string) {
  const row = db.prepare("SELECT id, scope, folder_id, title, sort_order, contact_id, created_at, updated_at FROM doc_notes WHERE id = ?").get(noteId) as any
  if (!row) return null
  const filePath = noteFilePath(row.scope, noteId)
  const content = existsSync(filePath) ? readFileSync(filePath, "utf-8") : ""
  return { ...row, content }
}

export function updateNote(noteId: string, title: string, content: string) {
  const row = db.prepare("SELECT scope FROM doc_notes WHERE id = ?").get(noteId) as any
  if (!row) return
  ensureScopeDir(row.scope)
  db.prepare("UPDATE doc_notes SET title = ?, updated_at = ? WHERE id = ?").run(title, now(), noteId)
  writeFileSync(noteFilePath(row.scope, noteId), content, "utf-8")
}

export function deleteNote(noteId: string) {
  const row = db.prepare("SELECT scope FROM doc_notes WHERE id = ?").get(noteId) as any
  if (!row) return
  db.prepare("DELETE FROM doc_notes WHERE id = ?").run(noteId)
  const filePath = noteFilePath(row.scope, noteId)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function searchNotes(scope: string, query: string) {
  const q = `%${query}%`
  const byTitle = db.prepare("SELECT id, scope, folder_id, title, sort_order, contact_id, created_at, updated_at FROM doc_notes WHERE scope = ? AND title LIKE ?").all(scope, q) as any[]
  // Also search file content
  const scopeDir = resolve(DOCS_ROOT, scope)
  const contentMatches: any[] = []
  if (existsSync(scopeDir)) {
    const allNotes = db.prepare("SELECT id, scope, folder_id, title, sort_order, contact_id, created_at, updated_at FROM doc_notes WHERE scope = ?").all(scope) as any[]
    const foundIds = new Set(byTitle.map((n: any) => n.id))
    for (const note of allNotes) {
      if (foundIds.has(note.id)) continue
      const filePath = noteFilePath(scope, note.id)
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8")
        if (content.toLowerCase().includes(query.toLowerCase())) {
          contentMatches.push(note)
        }
      }
    }
  }
  return [...byTitle, ...contentMatches]
}

// ── Move / reorder ──────────────────────────────────────────

export function moveFolder(folderId: string, parentId: string | null, targetFolderId: string | null, position: string | null) {
  // Get the scope of the moved folder
  const folder = db.prepare("SELECT scope, sort_order as old_order FROM doc_folders WHERE id = ?").get(folderId) as any
  if (!folder) return

  // Update parent
  db.prepare("UPDATE doc_folders SET parent_id = ?, updated_at = ? WHERE id = ?").run(parentId || null, now(), folderId)

  // Reorder siblings
  if (targetFolderId) {
    const siblings = db.prepare("SELECT id FROM doc_folders WHERE scope = ? AND parent_id IS ? AND id != ? ORDER BY sort_order")
      .all(folder.scope, parentId || null, folderId) as any[]
    const idx = siblings.findIndex((s: any) => s.id === targetFolderId)
    const insertIdx = position === "after" ? idx + 1 : idx
    siblings.splice(insertIdx, 0, { id: folderId })
    const stmt = db.prepare("UPDATE doc_folders SET sort_order = ? WHERE id = ?")
    for (let i = 0; i < siblings.length; i++) {
      stmt.run(i, siblings[i].id)
    }
  }
}

export function moveNote(noteId: string, folderId: string | null, targetNoteId: string | null, position: string | null) {
  const note = db.prepare("SELECT scope FROM doc_notes WHERE id = ?").get(noteId) as any
  if (!note) return

  db.prepare("UPDATE doc_notes SET folder_id = ?, updated_at = ? WHERE id = ?").run(folderId || null, now(), noteId)

  if (targetNoteId) {
    const siblings = db.prepare("SELECT id FROM doc_notes WHERE scope = ? AND folder_id IS ? AND id != ? ORDER BY sort_order")
      .all(note.scope, folderId || null, noteId) as any[]
    const idx = siblings.findIndex((s: any) => s.id === targetNoteId)
    const insertIdx = position === "after" ? idx + 1 : idx
    siblings.splice(insertIdx, 0, { id: noteId })
    const stmt = db.prepare("UPDATE doc_notes SET sort_order = ? WHERE id = ?")
    for (let i = 0; i < siblings.length; i++) {
      stmt.run(i, siblings[i].id)
    }
  }
}

// ── Contact folder integration ──────────────────────────────

export function ensureContactFolder(contactId: string, contactName: string) {
  const existing = db.prepare("SELECT id FROM doc_folders WHERE scope = 'knowledge' AND contact_id = ?").get(contactId) as any
  if (existing) return existing
  const maxOrder = (db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM doc_folders WHERE scope = 'knowledge' AND parent_id IS NULL").get() as any).n
  const ts = now()
  const folderId = `contact-${id()}`
  db.prepare("INSERT INTO doc_folders (id,scope,parent_id,name,sort_order,contact_id,created_at,updated_at) VALUES (?,'knowledge',NULL,?,?,?,?,?)")
    .run(folderId, contactName, maxOrder, contactId, ts, ts)
  return { id: folderId }
}

export function createContactNote(contactId: string, filename: string, content: string = "") {
  // Ensure contact folder exists
  const folder = db.prepare("SELECT id FROM doc_folders WHERE scope = 'knowledge' AND contact_id = ?").get(contactId) as any
  const folderId = folder?.id || null
  if (!folderId) return null

  const noteId = `note-${id()}`
  const maxOrder = (db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM doc_notes WHERE folder_id = ?").get(folderId) as any).n
  const ts = now()
  db.prepare("INSERT INTO doc_notes (id,scope,folder_id,title,sort_order,contact_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(noteId, "knowledge", folderId, filename, maxOrder, contactId, ts, ts)

  // Write .md file to contacts dir (existing path for compatibility)
  const contactsDir = resolve(DOCS_ROOT, "knowledge", "contacts", contactId)
  mkdirSync(contactsDir, { recursive: true })
  const mdName = filename.endsWith(".md") ? filename : `${filename}.md`
  writeFileSync(resolve(contactsDir, mdName), content, "utf-8")

  return { id: noteId, title: filename, folder_id: folderId }
}

// ── MCP helper functions ─────────────────────────────────────

export function listNotesByContact(scope: string, contactId: string) {
  const notes = db.prepare("SELECT id, scope, folder_id, title, sort_order, contact_id, created_at, updated_at FROM doc_notes WHERE scope = ? AND contact_id = ? ORDER BY updated_at DESC")
    .all(scope, contactId) as any[]
  return notes
}

export function readVaultFile(relativePath: string): string | null {
  // Resolve relative to knowledge scope root, prevent path traversal
  const knowledgeRoot = resolve(DOCS_ROOT, "knowledge")
  const fullPath = resolve(knowledgeRoot, relativePath)
  if (!fullPath.startsWith(knowledgeRoot)) return null
  if (!existsSync(fullPath)) return null
  return readFileSync(fullPath, "utf-8")
}
