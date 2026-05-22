import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Skills data directory — contains .md files from crazy-agent
const SKILLS_DIR = resolve(import.meta.dirname, '../../data/skills')

export interface SkillEntry {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  trigger: string
  type: 'paid' | 'free'
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

// Manual catalog with display metadata for each skill
const CATALOG: SkillEntry[] = [
  {
    id: 'vault-rules',
    name: '系统规范',
    description: 'Crazor 知识库与数据操作规范',
    category: '通用',
    tags: ['知识库', '规范', '文件管理'],
    trigger: '被要求在Vault中创建、修改、管理文件时自动加载',
    type: 'paid',
  },
  {
    id: '客户管理助手',
    name: '客户管理助手',
    description: '管理客户全生命周期，从线索到成交',
    category: '客户',
    tags: ['客户管理', 'CRM', '线索', '跟进', '成交'],
    trigger: '用户说"管理客户"、"客户档案"、"客户分层"、"新客户"、"跟进"、"线索"时加载',
    type: 'paid',
  },
  {
    id: '素材提炼助手',
    name: '素材提炼助手',
    description: '将原始素材提炼为结构化知识卡片',
    category: '内容',
    tags: ['素材', '提炼', '知识卡片', '知识库'],
    trigger: '用户说"提炼素材"、"整理笔记"、"消化素材"、"整理raw"时加载',
    type: 'paid',
  },
  {
    id: '内容生产助手',
    name: '内容生产助手',
    description: '多平台内容创作、选题策划和发布管理',
    category: '运营',
    tags: ['内容', '选题', '多平台', '创作', '发布'],
    trigger: '用户说"写内容"、"生成文章"、"帮我出选题"、"做小红书"、"发抖音"时加载',
    type: 'paid',
  },
  {
    id: '朋友圈运营助手',
    name: '朋友圈运营助手',
    description: '朋友圈内容规划、社群运营和数据周报',
    category: '运营',
    tags: ['朋友圈', '私域', '社群', '排期', '周报'],
    trigger: '用户说"朋友圈"、"朋友圈运营"、"私域"、"社群"、"今天发什么"时加载',
    type: 'paid',
  },
  {
    id: 'finance',
    name: 'finance',
    description: '收支记录、发票管理和财务报表',
    category: '管理',
    tags: ['财务', '收支', '发票', '报表'],
    trigger: '用户提到"记账"、"收支"、"财务"、"利润"、"发票"时加载',
    type: 'paid',
  },
  {
    id: 'project',
    name: 'project',
    description: '项目创建、任务分解和进度追踪',
    category: '管理',
    tags: ['项目', '任务', '进度', '里程碑'],
    trigger: '用户提到"项目"、"任务"、"里程碑"、"排期"时加载',
    type: 'paid',
  },
  {
    id: 'hr',
    name: 'hr',
    description: '员工档案、考勤记录和绩效评估',
    category: '管理',
    tags: ['人事', '员工', '考勤', '绩效'],
    trigger: '用户提到"员工"、"招聘"、"薪资"、"考勤"、"绩效"时加载',
    type: 'paid',
  },
  {
    id: 'inventory',
    name: 'inventory',
    description: 'SKU管理、订单跟踪和库存预警',
    category: '管理',
    tags: ['库存', 'SKU', '订单', '物流'],
    trigger: '用户提到"库存"、"SKU"、"发货"、"订单"时加载',
    type: 'paid',
  },
  {
    id: 'dashboard',
    name: 'dashboard',
    description: '数据汇总、周报月报和KPI追踪',
    category: '管理',
    tags: ['数据', '报表', 'KPI', '复盘'],
    trigger: '用户提到"周报"、"月报"、"数据看板"、"汇总"时加载',
    type: 'paid',
  },
]

const catalogMap = new Map(CATALOG.map((s) => [s.id, s]))

// ── YAML frontmatter parser ────────────────────────────────

function parseFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const yaml = match[1]
  const result: Record<string, any> = {}
  let currentKey = ''
  let currentArr: string[] | null = null
  for (const line of yaml.split(/\r?\n/)) {
    // Array item: "  - value"
    if (/^\s+-\s+/.test(line) && currentArr !== null) {
      currentArr.push(line.replace(/^\s+-\s+/, '').trim())
      continue
    }
    // Key: value
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/)
    if (kvMatch) {
      const key = kvMatch[1]
      const val = kvMatch[2].trim()
      if (val === '') {
        // Could be start of array or empty
        currentArr = []
        result[key] = currentArr
        currentKey = key
      } else {
        // Remove quotes
        const cleaned = val.replace(/^["']|["']$/g, '')
        result[key] = cleaned
        currentArr = null
        currentKey = key
      }
    }
  }
  return result
}

// Cache for parsed metadata
const metaCache = new Map<string, SkillMeta | null>()

function parseSkillMeta(id: string): SkillMeta | null {
  if (metaCache.has(id)) return metaCache.get(id) ?? null
  const filePath = resolve(SKILLS_DIR, `${id}.md`)
  try {
    const content = readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    if (!fm) {
      metaCache.set(id, null)
      return null
    }
    const meta: SkillMeta = {
      id,
      name: fm.name || id,
      description: fm.description || '',
      trigger: fm.trigger || '',
      mcpTools: Array.isArray(fm.mcpTools) ? fm.mcpTools : [],
      apis: Array.isArray(fm.apis) ? fm.apis : [],
      dbTables: Array.isArray(fm.dbTables) ? fm.dbTables : [],
      externalApis: Array.isArray(fm.externalApis) ? fm.externalApis : [],
    }
    metaCache.set(id, meta)
    return meta
  } catch {
    metaCache.set(id, null)
    return null
  }
}

// ── Public API ─────────────────────────────────────────────

/** Return the skill catalog (display metadata only) */
export function getCatalog(): SkillEntry[] {
  return CATALOG
}

/** Return a single skill's display metadata */
export function getCatalogEntry(id: string): SkillEntry | undefined {
  return catalogMap.get(id)
}

/** Return enriched architecture metadata for a skill (parsed from frontmatter) */
export function getSkillMeta(id: string): SkillMeta | null {
  return parseSkillMeta(id)
}

/** Return enriched metadata for ALL skills */
export function getAllSkillMeta(): SkillMeta[] {
  const results: SkillMeta[] = []
  for (const entry of CATALOG) {
    const meta = parseSkillMeta(entry.id)
    if (meta) results.push(meta)
  }
  return results
}

/** Read and return the full .md file content for a skill */
export function getSkillContent(id: string): string | null {
  const filePath = resolve(SKILLS_DIR, `${id}.md`)
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}
