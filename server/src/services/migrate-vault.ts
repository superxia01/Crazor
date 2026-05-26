// One-time migration: SQLite doc_folders/doc_notes → filesystem vault
// Idempotent — skips if vault already exists with content

import { resolve, dirname } from 'node:path'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { CRAZOR_VAULT_ROOT, VAULT_META_FILE } from './crazor-config'
import { CRAZOR_DOCS_ROOT } from './crazor-config'
import { db } from './crazor-db'

interface FolderRow {
  id: string
  scope: string
  parent_id: string | null
  name: string
  sort_order: number
  contact_id: string | null
}

interface NoteRow {
  id: string
  scope: string
  folder_id: string | null
  title: string
  sort_order: number
  contact_id: string | null
}

function readDirMeta(dirPath: string): Record<string, any> {
  const metaPath = resolve(dirPath, VAULT_META_FILE)
  if (!existsSync(metaPath)) return {}
  try { return JSON.parse(readFileSync(metaPath, 'utf-8')) }
  catch { return {} }
}

function writeDirMeta(dirPath: string, meta: Record<string, any>): void {
  writeFileSync(resolve(dirPath, VAULT_META_FILE), JSON.stringify(meta, null, 2), 'utf-8')
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim()
}

export function migrateVault(): { migrated: boolean; folders: number; notes: number } {
  const knowledgeDir = resolve(CRAZOR_VAULT_ROOT, 'knowledge')

  // Skip if vault already has content
  if (existsSync(knowledgeDir)) {
    try {
      const entries = readdirSync(knowledgeDir).filter(e => e !== '.DS_Store' && e !== '.obsidian' && e !== VAULT_META_FILE)
      if (entries.length > 0) return { migrated: false, folders: 0, notes: 0 }
    } catch { /* continue with migration */ }
  }

  // Check if there's SQLite data to migrate
  let folderCount = 0
  try {
    folderCount = (db.prepare("SELECT count(*) as c FROM doc_folders").get() as any).c
  } catch {
    // No tables — fresh install
    return { migrated: false, folders: 0, notes: 0 }
  }

  if (folderCount === 0) return { migrated: false, folders: 0, notes: 0 }

  console.log('[migrate] Migrating SQLite doc tree to filesystem vault...')

  // Load all folders and build parent map
  const folders = db.prepare("SELECT id, scope, parent_id, name, sort_order, contact_id FROM doc_folders").all() as FolderRow[]
  const folderMap = new Map<string, FolderRow>()
  for (const f of folders) folderMap.set(f.id, f)

  // Build path for each folder
  function folderPath(folder: FolderRow): string {
    const parts: string[] = [folder.name]
    let current = folder
    while (current.parent_id) {
      const parent = folderMap.get(current.parent_id)
      if (!parent) break
      parts.unshift(parent.name)
      current = parent
    }
    return resolve(CRAZOR_VAULT_ROOT, current.scope, ...parts)
  }

  // Group folders by parent
  const childrenOf = new Map<string | null, FolderRow[]>()
  for (const f of folders) {
    const key = f.parent_id || null
    if (!childrenOf.has(key)) childrenOf.set(key, [])
    childrenOf.get(key)!.push(f)
  }

  // Sort children by sort_order
  for (const [, children] of childrenOf) {
    children.sort((a, b) => a.sort_order - b.sort_order)
  }

  // Create directories and write _.json
  for (const folder of folders) {
    const dirPath = folderPath(folder)
    mkdirSync(dirPath, { recursive: true })

    const meta: Record<string, any> = {}
    if (folder.contact_id) meta.contact_id = folder.contact_id

    // Get children sorted
    const children = childrenOf.get(folder.id) || []
    // Also get notes for sort
    const notes = db.prepare("SELECT title, sort_order FROM doc_notes WHERE folder_id = ? ORDER BY sort_order")
      .all(folder.id) as { title: string; sort_order: number }[]

    if (children.length > 0 || notes.length > 0) {
      meta.sort = [
        ...children.map(c => c.name),
        ...notes.map(n => sanitizeFileName(n.title)),
      ]
    }

    if (Object.keys(meta).length > 0) {
      writeDirMeta(dirPath, meta)
    }
  }

  // Write root _.json for each scope
  const scopes = new Set(folders.map(f => f.scope))
  for (const scope of scopes) {
    const scopePath = resolve(CRAZOR_VAULT_ROOT, scope)
    mkdirSync(scopePath, { recursive: true })
    const rootChildren = childrenOf.get(null)!.filter(f => f.scope === scope)
    const rootNotes = db.prepare("SELECT title FROM doc_notes WHERE scope = ? AND folder_id IS NULL ORDER BY sort_order")
      .all(scope) as { title: string }[]
    if (rootChildren.length > 0 || rootNotes.length > 0) {
      writeDirMeta(scopePath, {
        sort: [
          ...rootChildren.map(c => c.name),
          ...rootNotes.map(n => sanitizeFileName(n.title)),
        ]
      })
    }
  }

  // Migrate notes
  const allNotes = db.prepare("SELECT id, scope, folder_id, title, sort_order, contact_id FROM doc_notes").all() as NoteRow[]
  let notesMigrated = 0

  for (const note of allNotes) {
    // Determine target directory
    let dirPath: string
    if (note.folder_id) {
      const folder = folderMap.get(note.folder_id)
      dirPath = folder ? folderPath(folder) : resolve(CRAZOR_VAULT_ROOT, note.scope)
    } else {
      dirPath = resolve(CRAZOR_VAULT_ROOT, note.scope)
    }
    mkdirSync(dirPath, { recursive: true })

    // Read content from old path
    const oldPath = resolve(CRAZOR_DOCS_ROOT, note.scope, `${note.id}.md`)
    let content = ''
    if (existsSync(oldPath)) {
      content = readFileSync(oldPath, 'utf-8')
    }

    // Write to new path with human-readable name
    const safeTitle = sanitizeFileName(note.title)
    const newPath = resolve(dirPath, `${safeTitle}.md`)

    // Handle filename conflicts
    let finalPath = newPath
    if (existsSync(finalPath) && finalPath !== newPath) {
      let i = 2
      while (existsSync(resolve(dirPath, `${safeTitle}-${i}.md`))) i++
      finalPath = resolve(dirPath, `${safeTitle}-${i}.md`)
    }

    writeFileSync(finalPath, content, 'utf-8')
    notesMigrated++
  }

  // Write root-level notes
  const rootNotes = db.prepare("SELECT id, scope, title FROM doc_notes WHERE folder_id IS NULL").all() as { id: string; scope: string; title: string }[]
  for (const note of rootNotes) {
    const scopePath = resolve(CRAZOR_VAULT_ROOT, note.scope)
    mkdirSync(scopePath, { recursive: true })
    const oldPath = resolve(CRAZOR_DOCS_ROOT, note.scope, `${note.id}.md`)
    let content = ''
    if (existsSync(oldPath)) content = readFileSync(oldPath, 'utf-8')
    const safeTitle = sanitizeFileName(note.title)
    writeFileSync(resolve(scopePath, `${safeTitle}.md`), content, 'utf-8')
  }

  console.log(`[migrate] Done: ${folders.length} folders, ${notesMigrated} notes migrated`)

  // Write marker
  writeFileSync(resolve(CRAZOR_VAULT_ROOT, '.migrated'), new Date().toISOString(), 'utf-8')

  return { migrated: true, folders: folders.length, notes: notesMigrated }
}
