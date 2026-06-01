import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { CRAZOR_SKILLS_DIR } from './crazor-config'

export interface SkillEntry {
  id: string
  name: string
  description: string
  source: string  // "crazor" = AI digital employee, others = Hermes auto-generated
  category: string
  tags: string[]
  trigger: string
}

/** Enriched skill metadata parsed from YAML frontmatter */
export interface SkillMeta {
  id: string
  name: string
  description: string
  trigger: string
  mcpTools: string[]
  apis: string[]
  dbTables: string[]
  externalApis: string[]
}

// ── YAML frontmatter parser (flat key/value + arrays) ──────────

function parseFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const yaml = match[1]
  const result: Record<string, any> = {}
  let currentArr: string[] | null = null
  for (const line of yaml.split(/\r?\n/)) {
    // Array item: "  - value"
    if (/^\s+-\s+/.test(line) && currentArr !== null) {
      const val = line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '')
      currentArr.push(val)
      continue
    }
    // Key: value
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/)
    if (kvMatch) {
      const key = kvMatch[1]
      const val = kvMatch[2].trim()
      if (val === '') {
        currentArr = []
        result[key] = currentArr
      } else {
        result[key] = val.replace(/^["']|["']$/g, '')
        currentArr = null
      }
    }
  }
  return result
}

// ── Cache ──────────────────────────────────────────────────────

let _catalogCache: { data: SkillEntry[]; ts: number } | null = null
let _metaCache: Map<string, { data: SkillMeta | null; ts: number }> = new Map()
const CACHE_TTL = 30_000 // 30 seconds

function scanSkillDirs(): string[] {
  if (!existsSync(CRAZOR_SKILLS_DIR)) return []
  return readdirSync(CRAZOR_SKILLS_DIR).filter((d) => {
    const p = join(CRAZOR_SKILLS_DIR, d)
    try {
      return statSync(p).isDirectory() && existsSync(join(p, 'SKILL.md'))
    } catch {
      return false
    }
  })
}

/** Parse a SKILL.md into SkillEntry + SkillMeta */
function parseSkillFile(id: string): { entry: SkillEntry; meta: SkillMeta } | null {
  const filePath = resolve(CRAZOR_SKILLS_DIR, id, 'SKILL.md')
  try {
    const content = readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    if (!fm) return null

    // Extract body for trigger fallback from "When to Use" section
    const bodyMatch = content.match(/^---[\s\S]*?---\r?\n([\s\S]*)$/)
    const body = bodyMatch ? bodyMatch[1].trim() : ''
    const whenMatch = body.match(/## When to Use\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    const triggerSection = whenMatch ? whenMatch[1].trim() : ''

    const employeeName = fm.employeeName || fm.name || id
    const trigger = fm.trigger || triggerSection || ''

    const entry: SkillEntry = {
      id,
      name: employeeName,
      description: fm.description || '',
      source: fm.source || '',
      category: fm.category || '',
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      trigger,
    }

    const meta: SkillMeta = {
      id,
      name: employeeName,
      description: fm.description || '',
      trigger,
      mcpTools: Array.isArray(fm.mcpTools) ? fm.mcpTools : [],
      apis: Array.isArray(fm.apis) ? fm.apis : [],
      dbTables: Array.isArray(fm.dbTables) ? fm.dbTables : [],
      externalApis: Array.isArray(fm.externalApis) ? fm.externalApis : [],
    }

    return { entry, meta }
  } catch {
    return null
  }
}

// ── Public API ─────────────────────────────────────────────────

/** Return the skill catalog, optionally filtered by source */
export function getCatalog(filter?: { source?: string }): SkillEntry[] {
  if (_catalogCache && Date.now() - _catalogCache.ts < CACHE_TTL) {
    return filter?.source
      ? _catalogCache.data.filter((e) => e.source === filter.source)
      : _catalogCache.data
  }
  const dirs = scanSkillDirs()
  const entries: SkillEntry[] = []
  for (const id of dirs) {
    const parsed = parseSkillFile(id)
    if (parsed) entries.push(parsed.entry)
  }
  _catalogCache = { data: entries, ts: Date.now() }
  return filter?.source
    ? entries.filter((e) => e.source === filter.source)
    : entries
}

/** Return a single skill's display metadata */
export function getCatalogEntry(id: string): SkillEntry | undefined {
  return getCatalog().find((e) => e.id === id)
}

/** Return enriched architecture metadata for a skill */
export function getSkillMeta(id: string): SkillMeta | null {
  const cached = _metaCache.get(id)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data
  const parsed = parseSkillFile(id)
  const meta = parsed?.meta ?? null
  _metaCache.set(id, { data: meta, ts: Date.now() })
  return meta
}

/** Return enriched metadata for ALL skills */
export function getAllSkillMeta(): SkillMeta[] {
  const results: SkillMeta[] = []
  for (const entry of getCatalog()) {
    const meta = getSkillMeta(entry.id)
    if (meta) results.push(meta)
  }
  return results
}

/** Read and return the full SKILL.md file content for a skill */
export function getSkillContent(id: string): string | null {
  const filePath = resolve(CRAZOR_SKILLS_DIR, id, 'SKILL.md')
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}
