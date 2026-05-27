// One-time migrations for filesystem vault
// 1. SQLite doc_folders/doc_notes → filesystem vault (legacy)
// 2. FS→FS rename: add numeric prefixes to folder names

import { resolve } from 'node:path'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs'
import { CRAZOR_VAULT_ROOT, VAULT_META_FILE } from './crazor-config'
import { CRAZOR_DOCS_ROOT } from './crazor-config'

// ── Shared helpers ────────────────────────────────────────────

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

// ── Migration 1: SQLite → FS (legacy) ────────────────────────

interface FolderRow { id: string; scope: string; parent_id: string | null; name: string; sort_order: number; contact_id: string | null }
interface NoteRow { id: string; scope: string; folder_id: string | null; title: string; sort_order: number; contact_id: string | null }

function migrateSqliteToFs(): boolean {
  const knowledgeDir = resolve(CRAZOR_VAULT_ROOT, 'knowledge')
  if (existsSync(knowledgeDir)) {
    try {
      const entries = readdirSync(knowledgeDir).filter(e => e !== '.DS_Store' && e !== '.obsidian' && e !== VAULT_META_FILE)
      if (entries.length > 0) return false
    } catch { /* continue */ }
  }

  let folderCount = 0
  try {
    const { db } = require('./crazor-db')
    folderCount = (db.prepare("SELECT count(*) as c FROM doc_folders").get() as any).c
    if (folderCount === 0) return false

    console.log('[migrate] Migrating SQLite doc tree to filesystem vault...')
    const folders = db.prepare("SELECT id, scope, parent_id, name, sort_order, contact_id FROM doc_folders").all() as FolderRow[]
    const folderMap = new Map<string, FolderRow>()
    for (const f of folders) folderMap.set(f.id, f)

    const folderPath = (folder: FolderRow): string => {
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

    const childrenOf = new Map<string | null, FolderRow[]>()
    for (const f of folders) {
      const key = f.parent_id || null
      if (!childrenOf.has(key)) childrenOf.set(key, [])
      childrenOf.get(key)!.push(f)
    }
    for (const [, ch] of childrenOf) ch.sort((a, b) => a.sort_order - b.sort_order)

    for (const folder of folders) {
      const dirPath = folderPath(folder)
      mkdirSync(dirPath, { recursive: true })
      const meta: Record<string, any> = {}
      if (folder.contact_id) meta.contact_id = folder.contact_id
      const ch = childrenOf.get(folder.id) || []
      const notes = db.prepare("SELECT title FROM doc_notes WHERE folder_id = ? ORDER BY sort_order").all(folder.id) as { title: string }[]
      if (ch.length > 0 || notes.length > 0) meta.sort = [...ch.map(c => c.name), ...notes.map(n => sanitizeFileName(n.title))]
      if (Object.keys(meta).length > 0) writeDirMeta(dirPath, meta)
    }

    const scopes = new Set(folders.map(f => f.scope))
    for (const scope of scopes) {
      const scopePath = resolve(CRAZOR_VAULT_ROOT, scope)
      mkdirSync(scopePath, { recursive: true })
      const rootCh = childrenOf.get(null)!.filter(f => f.scope === scope)
      const rootNotes = db.prepare("SELECT title FROM doc_notes WHERE scope = ? AND folder_id IS NULL ORDER BY sort_order").all(scope) as { title: string }[]
      if (rootCh.length > 0 || rootNotes.length > 0)
        writeDirMeta(scopePath, { sort: [...rootCh.map(c => c.name), ...rootNotes.map(n => sanitizeFileName(n.title))] })
    }

    const allNotes = db.prepare("SELECT id, scope, folder_id, title FROM doc_notes").all() as NoteRow[]
    for (const note of allNotes) {
      let dirPath: string
      if (note.folder_id) {
        const folder = folderMap.get(note.folder_id)
        dirPath = folder ? folderPath(folder) : resolve(CRAZOR_VAULT_ROOT, note.scope)
      } else dirPath = resolve(CRAZOR_VAULT_ROOT, note.scope)
      mkdirSync(dirPath, { recursive: true })
      const oldPath = resolve(CRAZOR_DOCS_ROOT, note.scope, `${note.id}.md`)
      let content = ''
      if (existsSync(oldPath)) content = readFileSync(oldPath, 'utf-8')
      writeFileSync(resolve(dirPath, `${sanitizeFileName(note.title)}.md`), content, 'utf-8')
    }

    writeFileSync(resolve(CRAZOR_VAULT_ROOT, '.migrated'), new Date().toISOString(), 'utf-8')
    return true
  } catch { return false }
}

// ── Migration 2: FS→FS rename (add numeric prefixes) ──────────

// Tree of old→new name mappings. Processed bottom-up (children before parent).
interface RenameNode { newName: string; children?: Record<string, RenameNode> }
const RENAME_TREE: Record<string, RenameNode> = {
  "关于我": { newName: "00-关于我", children: {
    "定位与品牌": { newName: "10-定位与品牌" },
    "产品与业务": { newName: "20-产品与业务" },
    "目标客户": { newName: "30-目标客户" },
    "账号矩阵": { newName: "40-账号矩阵" },
    "目标与节奏": { newName: "50-目标与节奏" },
  }},
  "百科": { newName: "10-百科", children: {
    "行业与市场": { newName: "10-行业与市场" },
    "产品知识": { newName: "20-产品知识" },
    "客户洞察": { newName: "30-客户洞察" },
    "销售与转化": { newName: "40-销售与转化" },
    "内容与流量": { newName: "50-内容与流量" },
    "实战复盘": { newName: "60-实战复盘" },
  }},
  "业务流程": { newName: "20-业务流程", children: {
    "公域流量": { newName: "10-公域流量", children: {
      "选题池": { newName: "10-选题池" },
      "内容管理": { newName: "20-内容管理" },
      "数据统计": { newName: "30-数据统计" },
      "内容资产": { newName: "40-内容资产" },
      "素材提炼": { newName: "50-素材提炼" },
    }},
    "私域运营": { newName: "20-私域运营", children: {
      "朋友圈": { newName: "10-朋友圈" },
      "社群": { newName: "20-社群" },
      "数据周报": { newName: "30-数据周报" },
    }},
    "客户管理": { newName: "30-客户管理", children: {
      "线索管理": { newName: "10-线索管理" },
      "成交记录": { newName: "20-成交记录" },
    }},
    "产品交付": { newName: "40-产品交付" },
    "项目管理": { newName: "45-项目管理" },
    "人事管理": { newName: "50-人事管理" },
    "财务管理": { newName: "55-财务管理" },
    "库存管理": { newName: "60-库存管理" },
    "数据看板": { newName: "70-数据看板" },
  }},
  "素材资产": { newName: "30-素材资产", children: {
    "品牌": { newName: "10-品牌" },
    "账号": { newName: "20-账号" },
    "内容模板": { newName: "30-内容模板" },
    "PPT模板": { newName: "40-PPT模板" },
    "报价方案": { newName: "50-报价方案" },
    "合同": { newName: "60-合同" },
  }},
  "事件": { newName: "40-事件", children: {
    "公司": { newName: "10-公司" },
    "AI": { newName: "20-AI" },
  }},
  "归档": { newName: "99-归档" },
}

// Recursively rename children first (bottom-up), then self
function renameRecursive(
  dirPath: string,
  mapping: Record<string, RenameNode>
): number {
  let count = 0

  for (const [oldName, spec] of Object.entries(mapping)) {
    const childPath = resolve(dirPath, oldName)
    if (!existsSync(childPath)) continue

    // Recurse into children first (bottom-up)
    if (spec.children) {
      count += renameRecursive(childPath, spec.children)
    }

    // Rename self
    if (spec.newName !== oldName) {
      const newPath = resolve(dirPath, spec.newName)
      if (!existsSync(newPath)) {
        try {
          renameSync(childPath, newPath)
          count++
          // Update parent _.json
          const meta = readDirMeta(dirPath)
          if (meta.sort) {
            const idx = meta.sort.indexOf(oldName)
            if (idx >= 0) {
              meta.sort[idx] = spec.newName
              writeDirMeta(dirPath, meta)
            }
          }
        } catch (e: any) {
          console.warn(`[migrate] Rename ${oldName} → ${spec.newName} failed: ${e.message}`)
        }
      }
    }
  }
  return count
}

function migrateRenamePrefixes(): number {
  const knowledgeDir = resolve(CRAZOR_VAULT_ROOT, 'knowledge')
  if (!existsSync(knowledgeDir)) return 0

  // Check if old-style names exist
  const rootEntries = readdirSync(knowledgeDir).filter(e => e !== '.DS_Store' && e !== '.obsidian' && e !== VAULT_META_FILE)
  const hasOldNames = Object.keys(RENAME_TREE).some(old => rootEntries.includes(old))
  if (!hasOldNames) return 0

  console.log('[migrate] Adding numeric prefixes to vault folders...')
  const count = renameRecursive(knowledgeDir, RENAME_TREE)
  if (count > 0) console.log(`[migrate] Renamed ${count} folders with numeric prefixes`)
  return count
}

// ── Main entry point ──────────────────────────────────────────

export function migrateVault(): { migrated: boolean; folders: number; notes: number } {
  migrateSqliteToFs()
  const renamed = migrateRenamePrefixes()
  return { migrated: renamed > 0, folders: renamed, notes: 0 }
}
