// Filesystem-driven document tree — real directories = folders, .md files = notes
// Each directory has a _.json for sort order and optional metadata (e.g. contact_id)
// IDs are derived from paths: "knowledge/20-业务流程/30-客户管理"

import { resolve, dirname, basename, join } from 'node:path'
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync,
  renameSync, rmSync, statSync,
} from 'node:fs'
import { CRAZOR_VAULT_ROOT, VAULT_META_FILE } from './crazor-config'

// ── Helpers ──────────────────────────────────────────────────

const INVALID_CHARS_RE = /[/\\:*?"<>|]/g

function sanitizeName(name: string): string {
  return name.replace(INVALID_CHARS_RE, '-').trim()
}

interface DirMeta {
  sort?: string[]
  contact_id?: string | null
  [key: string]: any
}

function scopeDir(scope: string): string {
  return resolve(CRAZOR_VAULT_ROOT, scope)
}

function readDirMeta(dirPath: string): DirMeta {
  const metaPath = resolve(dirPath, VAULT_META_FILE)
  if (!existsSync(metaPath)) return {}
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeDirMeta(dirPath: string, meta: DirMeta): void {
  const metaPath = resolve(dirPath, VAULT_META_FILE)
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

function getSortIndex(sortArr: string[] | undefined, name: string): number {
  if (!sortArr) return 999
  const idx = sortArr.indexOf(name)
  return idx >= 0 ? idx : 999
}

function fileTimestamp(filePath: string): string {
  try {
    const s = statSync(filePath)
    return s.mtimeMs.toString()
  } catch {
    return Date.now().toString()
  }
}

function birthTimestamp(filePath: string): string {
  try {
    const s = statSync(filePath)
    return (s.birthtimeMs || s.mtimeMs).toString()
  } catch {
    return Date.now().toString()
  }
}

// Derive parent folder ID from a folder ID
function parentFolderId(folderId: string): string | null {
  const idx = folderId.lastIndexOf('/')
  if (idx <= 0) return null
  return folderId.substring(0, idx)
}

// Derive folder ID from a note ID
function noteFolderId(noteId: string): string | null {
  const idx = noteId.lastIndexOf('/')
  if (idx <= 0) return null
  const parentId = noteId.substring(0, idx)
  return parentId.includes('/') ? parentId : null
}

// Convert folder ID to filesystem path
function folderIdToPath(folderId: string): string {
  return resolve(CRAZOR_VAULT_ROOT, folderId)
}

// Convert note ID to filesystem path (add .md)
function noteIdToPath(noteId: string): string {
  return resolve(CRAZOR_VAULT_ROOT, noteId + '.md')
}

interface ResolvedFolderRef {
  id: string
  dirPath: string
}

interface ResolvedNoteRef {
  id: string
  filePath: string
}

function stripOrderPrefix(name: string): string {
  return name.replace(/^\d+-/, '')
}

function splitVaultId(id: string | null | undefined): string[] | null {
  if (!id) return null
  const parts = id
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  if (parts.some(part => part === '.' || part === '..')) return null

  const safeParts = parts.map(sanitizeName).filter(Boolean)
  return safeParts.length === parts.length ? safeParts : null
}

function entryMatchesName(entryName: string, requestedName: string): boolean {
  const safeRequested = sanitizeName(requestedName)
  return (
    entryName === requestedName ||
    entryName === safeRequested ||
    stripOrderPrefix(entryName) === requestedName ||
    stripOrderPrefix(entryName) === safeRequested
  )
}

function findAliasedEntry(parentPath: string, requestedName: string, kind: 'directory' | 'note'): string | null {
  if (!existsSync(parentPath)) return null

  const entries = readdirSync(parentPath).filter(entry => !isIgnored(entry))
  const candidates: { entry: string; name: string }[] = []

  for (const entry of entries) {
    const fullPath = resolve(parentPath, entry)
    try {
      const stat = statSync(fullPath)
      if (kind === 'directory' && !stat.isDirectory()) continue
      if (kind === 'note' && (!stat.isFile() || !entry.endsWith('.md'))) continue
    } catch {
      continue
    }

    candidates.push({
      entry,
      name: kind === 'note' ? entry.replace(/\.md$/, '') : entry,
    })
  }

  const exact = candidates.find(candidate => candidate.name === requestedName)
  if (exact) return exact.entry

  const aliased = candidates.find(candidate => entryMatchesName(candidate.name, requestedName))
  return aliased?.entry ?? null
}

function appendSortIfMissing(dirPath: string, name: string): void {
  const meta = readDirMeta(dirPath)
  if (!meta.sort) meta.sort = []
  if (!meta.sort.includes(name)) {
    meta.sort.push(name)
    writeDirMeta(dirPath, meta)
  }
}

function resolveExistingFolderRef(folderId: string | null | undefined): ResolvedFolderRef | null {
  const parts = splitVaultId(folderId)
  if (!parts) return null

  const [scope, ...segments] = parts
  let dirPath = scopeDir(scope)
  if (!existsSync(dirPath)) return null

  const actualParts = [scope]
  for (const segment of segments) {
    const matchedEntry = findAliasedEntry(dirPath, segment, 'directory')
    if (!matchedEntry) return null
    dirPath = resolve(dirPath, matchedEntry)
    actualParts.push(matchedEntry)
  }

  return { id: actualParts.join('/'), dirPath }
}

function ensureFolderRef(folderId: string): ResolvedFolderRef | null {
  const parts = splitVaultId(folderId)
  if (!parts) return null

  const [scope, ...segments] = parts
  let dirPath = scopeDir(scope)
  mkdirSync(dirPath, { recursive: true })

  const actualParts = [scope]
  for (const segment of segments) {
    const matchedEntry = findAliasedEntry(dirPath, segment, 'directory')
    const dirName = matchedEntry || sanitizeName(segment)
    const nextPath = resolve(dirPath, dirName)

    if (!matchedEntry) {
      mkdirSync(nextPath, { recursive: true })
      appendSortIfMissing(dirPath, dirName)
    }

    dirPath = nextPath
    actualParts.push(dirName)
  }

  return { id: actualParts.join('/'), dirPath }
}

function resolveExistingNoteRef(noteId: string | null | undefined): ResolvedNoteRef | null {
  const parts = splitVaultId(noteId)
  if (!parts || parts.length < 2) return null

  const [scope, ...segments] = parts
  const folderSegments = segments.slice(0, -1)
  const noteName = segments[segments.length - 1]
  const folderId = [scope, ...folderSegments].join('/')
  const folderRef = resolveExistingFolderRef(folderId)
  if (!folderRef) return null

  const matchedFile = findAliasedEntry(folderRef.dirPath, noteName, 'note')
  if (!matchedFile) return null

  const title = matchedFile.replace(/\.md$/, '')
  return {
    id: `${folderRef.id}/${title}`,
    filePath: resolve(folderRef.dirPath, matchedFile),
  }
}

function ensureBlankNoteRef(noteId: string | null | undefined): ResolvedNoteRef | null {
  const parts = splitVaultId(noteId)
  if (!parts || parts.length < 2) return null

  const [scope, ...segments] = parts
  const folderSegments = segments.slice(0, -1)
  const requestedTitle = segments[segments.length - 1]
  const folderId = [scope, ...folderSegments].join('/')
  const folderRef = resolveExistingFolderRef(folderId) || ensureFolderRef(folderId)
  if (!folderRef) return null

  const matchedFile = findAliasedEntry(folderRef.dirPath, requestedTitle, 'note')
  if (matchedFile) {
    const title = matchedFile.replace(/\.md$/, '')
    return {
      id: `${folderRef.id}/${title}`,
      filePath: resolve(folderRef.dirPath, matchedFile),
    }
  }

  const safeTitle = sanitizeName(requestedTitle) || '未命名笔记'
  const uniqueTitle = uniqueName(folderRef.dirPath, safeTitle)
  const filePath = resolve(folderRef.dirPath, `${uniqueTitle}.md`)
  writeFileSync(filePath, '', 'utf-8')
  appendSortIfMissing(folderRef.dirPath, uniqueTitle)

  return {
    id: `${folderRef.id}/${uniqueTitle}`,
    filePath,
  }
}

// Check if a directory entry should be ignored
function isIgnored(name: string): boolean {
  return name === '.obsidian' || name === '.DS_Store' || name === VAULT_META_FILE
}

// Find unique filename in directory (handle conflicts)
function uniqueName(dirPath: string, baseName: string, ext: string = '.md'): string {
  if (!existsSync(resolve(dirPath, baseName + ext))) return baseName
  let i = 2
  while (existsSync(resolve(dirPath, `${baseName}-${i}${ext}`))) i++
  return `${baseName}-${i}`
}

// Update sort array in a directory's _.json: remove an item
function sortRemove(dirPath: string, name: string): void {
  const meta = readDirMeta(dirPath)
  if (meta.sort) {
    meta.sort = meta.sort.filter(n => n !== name)
    writeDirMeta(dirPath, meta)
  }
}

// Update sort array: insert item at position relative to target
function sortInsert(dirPath: string, name: string, targetName: string | null, position: string | null): void {
  const meta = readDirMeta(dirPath)
  if (!meta.sort) {
    // Build sort from current directory listing
    meta.sort = readdirSync(dirPath).filter(n => !isIgnored(n) && !n.endsWith('.md'))
    // Include .md files without extension
    readdirSync(dirPath).filter(n => n.endsWith('.md')).forEach(n => {
      meta.sort!.push(n.replace(/\.md$/, ''))
    })
  }
  meta.sort = meta.sort.filter(n => n !== name)
  if (targetName) {
    const idx = meta.sort.indexOf(targetName)
    const insertIdx = position === 'after' ? idx + 1 : idx
    meta.sort.splice(insertIdx >= 0 ? insertIdx : meta.sort.length, 0, name)
  } else {
    meta.sort.push(name)
  }
  writeDirMeta(dirPath, meta)
}

// ── Tree operations ─────────────────────────────────────────

export function listTree(scope: string): { folders: any[], notes: any[] } {
  const root = scopeDir(scope)
  if (!existsSync(root)) mkdirSync(root, { recursive: true })

  const folders: any[] = []
  const notes: any[] = []

  function walk(dirPath: string, scope: string, parentId: string | null) {
    if (!existsSync(dirPath)) return
    const meta = readDirMeta(dirPath)
    const entries = readdirSync(dirPath)

    for (const entry of entries) {
      if (isIgnored(entry)) continue
      // Skip legacy note .md files at root (handled as notes)
      if (entry.startsWith('note-') && entry.endsWith('.md')) continue

      const fullPath = resolve(dirPath, entry)
      let stat
      try { stat = statSync(fullPath) } catch { continue }

      if (stat.isDirectory()) {
        const name = entry
        const id = parentId ? `${parentId}/${name}` : `${scope}/${name}`
        const dirMeta = readDirMeta(fullPath)
        const sortIdx = getSortIndex(meta.sort, name)

        folders.push({
          id,
          scope,
          parent_id: parentId,
          name,
          sort_order: sortIdx,
          contact_id: dirMeta.contact_id || null,
          created_at: birthTimestamp(fullPath),
          updated_at: fileTimestamp(fullPath),
        })

        // Recurse into subdirectory
        walk(fullPath, scope, id)
      } else if (entry.endsWith('.md')) {
        const name = entry.replace(/\.md$/, '')
        const id = parentId ? `${parentId}/${name}` : `${scope}/${name}`
        const sortIdx = getSortIndex(meta.sort, name)
        const dirMeta = readDirMeta(dirPath)

        notes.push({
          id,
          scope,
          folder_id: parentId,
          title: name,
          sort_order: sortIdx,
          contact_id: dirMeta.contact_id || null,
          created_at: birthTimestamp(fullPath),
          updated_at: fileTimestamp(fullPath),
        })
      }
    }
  }

  walk(root, scope, null)

  // Sort by sort_order so frontend array order matches _.json ordering
  folders.sort((a, b) => a.sort_order - b.sort_order)
  notes.sort((a, b) => a.sort_order - b.sort_order)

  return { folders, notes }
}

export function ensureDefaultFolder(_scope: string): void {
  // No-op — filesystem directories don't need a default entry
}

// ── Folder CRUD ─────────────────────────────────────────────

export function createFolder(scope: string, parentId: string | null, name: string) {
  const safeName = sanitizeName(name)
  const parentPath = parentId ? folderIdToPath(parentId) : scopeDir(scope)
  mkdirSync(parentPath, { recursive: true })
  const dirPath = resolve(parentPath, safeName)
  mkdirSync(dirPath, { recursive: true })

  // Update parent's sort
  const parentMeta = readDirMeta(parentPath)
  if (!parentMeta.sort) parentMeta.sort = []
  parentMeta.sort.push(safeName)
  writeDirMeta(parentPath, parentMeta)

  const id = parentId ? `${parentId}/${safeName}` : `${scope}/${safeName}`
  const ts = Date.now().toString()
  return {
    id, scope, parent_id: parentId, name: safeName,
    sort_order: parentMeta.sort.length - 1, contact_id: null,
    created_at: ts, updated_at: ts,
  }
}

export function renameFolder(folderId: string, name: string): void {
  const safeName = sanitizeName(name)
  const dirPath = folderIdToPath(folderId)
  const parentPath = dirname(dirPath)
  const oldName = basename(dirPath)
  const newPath = resolve(parentPath, safeName)

  // Rename directory
  renameSync(dirPath, newPath)

  // Update parent's sort
  const parentMeta = readDirMeta(parentPath)
  if (parentMeta.sort) {
    const idx = parentMeta.sort.indexOf(oldName)
    if (idx >= 0) parentMeta.sort[idx] = safeName
    writeDirMeta(parentPath, parentMeta)
  }
}

export function deleteFolder(folderId: string): void {
  const dirPath = folderIdToPath(folderId)
  if (!existsSync(dirPath)) return

  // Check if empty (excluding _.json)
  const entries = readdirSync(dirPath).filter(e => !isIgnored(e))
  if (entries.length > 0) throw new Error("目录下存在内容，请先清除")

  rmSync(dirPath, { recursive: true })

  // Update parent's sort
  const parentPath = dirname(dirPath)
  sortRemove(parentPath, basename(dirPath))
}

// ── Note CRUD ───────────────────────────────────────────────

export function createNote(scope: string, folderId: string | null, title: string, content?: string, contactId?: string) {
  const safeTitle = sanitizeName(title)
  const folderRef = folderId ? (resolveExistingFolderRef(folderId) || ensureFolderRef(folderId)) : null
  const dirPath = folderRef ? folderRef.dirPath : scopeDir(scope)
  mkdirSync(dirPath, { recursive: true })

  const uniqueTitle = uniqueName(dirPath, safeTitle)
  const filePath = resolve(dirPath, `${uniqueTitle}.md`)
  writeFileSync(filePath, content || '', 'utf-8')

  // Update directory's sort
  const dirMeta = readDirMeta(dirPath)
  if (!dirMeta.sort) dirMeta.sort = []
  dirMeta.sort.push(uniqueTitle)
  if (contactId) dirMeta.contact_id = contactId
  writeDirMeta(dirPath, dirMeta)

  const id = folderRef ? `${folderRef.id}/${uniqueTitle}` : `${scope}/${uniqueTitle}`
  const ts = Date.now().toString()
  return {
    id, scope, folder_id: folderRef?.id || null, title: uniqueTitle,
    sort_order: dirMeta.sort.length - 1, contact_id: contactId || null,
    created_at: ts, updated_at: ts,
  }
}

export function getNote(noteId: string) {
  const noteRef = resolveExistingNoteRef(noteId) || ensureBlankNoteRef(noteId)
  if (!noteRef) return null

  const filePath = noteRef.filePath
  const content = readFileSync(filePath, 'utf-8')
  const title = basename(filePath, '.md')
  const folderId = noteFolderId(noteRef.id)
  // Extract scope from noteId (first path segment)
  const scope = noteRef.id.split('/')[0]

  return {
    id: noteRef.id, scope, folder_id: folderId, title,
    sort_order: 0, contact_id: null,
    created_at: birthTimestamp(filePath),
    updated_at: fileTimestamp(filePath),
    content,
  }
}

export function updateNote(noteId: string, title: string, content: string): void {
  const noteRef = resolveExistingNoteRef(noteId) || ensureBlankNoteRef(noteId)
  if (!noteRef) return

  const filePath = noteRef.filePath
  const dirPath = dirname(filePath)
  const oldTitle = basename(filePath, '.md')
  const safeTitle = sanitizeName(title)

  // Rename if title changed
  if (safeTitle && safeTitle !== oldTitle) {
    const newUnique = uniqueName(dirPath, safeTitle)
    const newPath = resolve(dirPath, `${newUnique}.md`)
    renameSync(filePath, newPath)
    // Update sort
    const dirMeta = readDirMeta(dirPath)
    if (dirMeta.sort) {
      const idx = dirMeta.sort.indexOf(oldTitle)
      if (idx >= 0) dirMeta.sort[idx] = newUnique
      writeDirMeta(dirPath, dirMeta)
    }
    // Write content to new file
    writeFileSync(newPath, content, 'utf-8')
  } else {
    writeFileSync(filePath, content, 'utf-8')
  }
}

export function deleteNote(noteId: string): void {
  const noteRef = resolveExistingNoteRef(noteId)
  if (!noteRef) return

  const filePath = noteRef.filePath
  const dirPath = dirname(filePath)
  const name = basename(filePath, '.md')
  rmSync(filePath)
  sortRemove(dirPath, name)
}

// ── Move / reorder ──────────────────────────────────────────

export function moveFolder(folderId: string, parentId: string | null, targetFolderId: string | null, position: string | null): void {
  const srcDir = folderIdToPath(folderId)
  if (!existsSync(srcDir)) return
  const oldParentDir = dirname(srcDir)
  const folderName = basename(srcDir)

  // Determine new parent directory
  const newParentDir = parentId ? folderIdToPath(parentId) : scopeDir(folderId.split('/')[0])
  mkdirSync(newParentDir, { recursive: true })
  const destDir = resolve(newParentDir, folderName)

  if (srcDir !== destDir) {
    renameSync(srcDir, destDir)
  }

  // Update sort in old parent
  if (oldParentDir !== newParentDir) {
    sortRemove(oldParentDir, folderName)
  }

  // Update sort in new parent
  const targetName = targetFolderId ? basename(folderIdToPath(targetFolderId)) : null
  sortInsert(newParentDir, folderName, targetName, position)
}

export function moveNote(noteId: string, folderId: string | null, targetNoteId: string | null, position: string | null): void {
  const noteRef = resolveExistingNoteRef(noteId)
  if (!noteRef) return

  const srcFile = noteRef.filePath
  const oldDir = dirname(srcFile)
  const noteName = basename(srcFile, '.md')

  // Determine target directory
  const folderRef = folderId ? (resolveExistingFolderRef(folderId) || ensureFolderRef(folderId)) : null
  const newDir = folderRef ? folderRef.dirPath : scopeDir(noteRef.id.split('/')[0])
  mkdirSync(newDir, { recursive: true })
  const destFile = resolve(newDir, `${noteName}.md`)

  if (srcFile !== destFile) {
    renameSync(srcFile, destFile)
  }

  // Update sort in old dir
  if (oldDir !== newDir) {
    sortRemove(oldDir, noteName)
  }

  // Update sort in new dir
  const targetRef = targetNoteId ? resolveExistingNoteRef(targetNoteId) : null
  const targetName = targetRef ? basename(targetRef.filePath, '.md') : null
  sortInsert(newDir, noteName, targetName, position)
}

// ── Search ──────────────────────────────────────────────────

export function searchNotes(scope: string, query: string): any[] {
  const root = scopeDir(scope)
  if (!existsSync(root)) return []
  const q = query.toLowerCase()
  const results: any[] = []

  function walk(dirPath: string, parentId: string | null) {
    if (!existsSync(dirPath)) return
    for (const entry of readdirSync(dirPath)) {
      if (isIgnored(entry)) continue
      const fullPath = resolve(dirPath, entry)
      let stat
      try { stat = statSync(fullPath) } catch { continue }

      if (stat.isDirectory()) {
        const name = entry
        const id = parentId ? `${parentId}/${name}` : `${scope}/${name}`
        walk(fullPath, id)
      } else if (entry.endsWith('.md')) {
        const name = entry.replace(/\.md$/, '')
        const id = parentId ? `${parentId}/${name}` : `${scope}/${name}`
        // Match by filename
        if (name.toLowerCase().includes(q)) {
          results.push({
            id, scope, folder_id: parentId, title: name,
            sort_order: 0, contact_id: null,
            created_at: birthTimestamp(fullPath), updated_at: fileTimestamp(fullPath),
          })
          continue
        }
        // Match by content
        try {
          const content = readFileSync(fullPath, 'utf-8')
          if (content.toLowerCase().includes(q)) {
            results.push({
              id, scope, folder_id: parentId, title: name,
              sort_order: 0, contact_id: null,
              created_at: birthTimestamp(fullPath), updated_at: fileTimestamp(fullPath),
            })
          }
        } catch { /* ignore */ }
      }
    }
  }

  walk(root, null)
  return results
}

// ── Contact folder integration ──────────────────────────────

// Find "20-业务流程/30-客户管理" folder
function getContactParentPath(scope: string = 'knowledge'): string | null {
  const root = scopeDir(scope)
  // Walk to find 20-业务流程/30-客户管理
  for (const entry of readdirSync(root)) {
    if (isIgnored(entry)) continue
    const flowDir = resolve(root, entry)
    try { if (!statSync(flowDir).isDirectory()) continue } catch { continue }
    if (entry !== '20-业务流程') continue
    const crmDir = resolve(flowDir, '30-客户管理')
    if (existsSync(crmDir)) return crmDir
  }
  return null
}

export function ensureContactFolder(contactId: string, contactName: string) {
  const crmDir = getContactParentPath()
  const safeName = sanitizeName(contactName)

  // Check if folder already exists (by contact_id in _.json)
  if (crmDir && existsSync(crmDir)) {
    for (const entry of readdirSync(crmDir)) {
      if (isIgnored(entry)) continue
      const subDir = resolve(crmDir, entry)
      try { if (!statSync(subDir).isDirectory()) continue } catch { continue }
      const meta = readDirMeta(subDir)
      if (meta.contact_id === contactId) {
        const id = `knowledge/20-业务流程/30-客户管理/${entry}`
        return { id }
      }
    }
  }

  // Create new folder
  const parentDir = crmDir || resolve(scopeDir('knowledge'), '20-业务流程', '30-客户管理')
  mkdirSync(parentDir, { recursive: true })
  const dirPath = resolve(parentDir, safeName)
  mkdirSync(dirPath, { recursive: true })

  // Write _.json with contact_id
  writeDirMeta(dirPath, { contact_id: contactId })

  // Update parent sort
  const parentMeta = readDirMeta(parentDir)
  if (!parentMeta.sort) parentMeta.sort = []
  if (!parentMeta.sort.includes(safeName)) parentMeta.sort.push(safeName)
  writeDirMeta(parentDir, parentMeta)

  const id = `knowledge/20-业务流程/30-客户管理/${safeName}`
  return { id }
}

export function createContactNote(contactId: string, filename: string, content: string = '') {
  // Find contact folder by contact_id
  const root = scopeDir('knowledge')
  if (!existsSync(root)) return null

  function findContactDir(dirPath: string): string | null {
    for (const entry of readdirSync(dirPath)) {
      if (isIgnored(entry)) continue
      const fullPath = resolve(dirPath, entry)
      try { if (!statSync(fullPath).isDirectory()) continue } catch { continue }
      const meta = readDirMeta(fullPath)
      if (meta.contact_id === contactId) return fullPath
      const found = findContactDir(fullPath)
      if (found) return found
    }
    return null
  }

  const contactDir = findContactDir(root)
  if (!contactDir) return null

  const safeName = sanitizeName(filename.endsWith('.md') ? filename.replace(/\.md$/, '') : filename)
  const unique = uniqueName(contactDir, safeName)
  const filePath = resolve(contactDir, `${unique}.md`)
  writeFileSync(filePath, content, 'utf-8')

  // Update sort
  const dirMeta = readDirMeta(contactDir)
  if (!dirMeta.sort) dirMeta.sort = []
  dirMeta.sort.push(unique)
  writeDirMeta(contactDir, dirMeta)

  // Build relative ID
  const relPath = contactDir.replace(resolve(CRAZOR_VAULT_ROOT) + '/', '')
  const noteId = `${relPath}/${unique}`

  return { id: noteId, title: unique, folder_id: relPath }
}

export function listNotesByContact(scope: string, contactId: string): any[] {
  const root = scopeDir(scope)
  if (!existsSync(root)) return []
  const results: any[] = []

  function walk(dirPath: string, parentId: string | null) {
    if (!existsSync(dirPath)) return
    for (const entry of readdirSync(dirPath)) {
      if (isIgnored(entry)) continue
      const fullPath = resolve(dirPath, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          const meta = readDirMeta(fullPath)
          const name = entry
          const id = parentId ? `${parentId}/${name}` : `${scope}/${name}`
          if (meta.contact_id === contactId) {
            // List all .md files in this directory
            for (const f of readdirSync(fullPath)) {
              if (f.endsWith('.md') && !isIgnored(f)) {
                const noteName = f.replace(/\.md$/, '')
                const notePath = resolve(fullPath, f)
                results.push({
                  id: `${id}/${noteName}`, scope, folder_id: id, title: noteName,
                  sort_order: 0, contact_id: contactId,
                  created_at: birthTimestamp(notePath), updated_at: fileTimestamp(notePath),
                })
              }
            }
          }
          walk(fullPath, id)
        }
      } catch { continue }
    }
  }

  walk(root, null)
  return results
}

export function readVaultFile(relativePath: string): string | null {
  const knowledgeRoot = resolve(CRAZOR_VAULT_ROOT, 'knowledge')
  const fullPath = resolve(knowledgeRoot, relativePath)
  if (!fullPath.startsWith(knowledgeRoot)) return null
  if (!existsSync(fullPath)) return null
  return readFileSync(fullPath, 'utf-8')
}
