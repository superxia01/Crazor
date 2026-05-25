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
// 21 employees across 10 departments — each with focused skill set for LLM accuracy
const CATALOG: SkillEntry[] = [
  // ── 新媒体运营部（内容+平台） ──────────────────────────────
  {
    id: 'topic-scheduler',
    name: '选题调度员',
    description: '负责选题策划、内容排期和热点追踪',
    category: '新媒体运营部',
    tags: ['选题', '排期', '热点', '内容规划'],
    trigger: '用户说"选题"、"排什么内容"、"内容规划"、"今天发什么选题"时加载',
  },
  {
    id: 'content-writer',
    name: '内容写手',
    description: '负责文章撰写、图文创作和内容改写',
    category: '新媒体运营部',
    tags: ['写作', '文章', '图文', '改写', '教程'],
    trigger: '用户说"写文章"、"帮我写"、"改写"、"内容创作"时加载',
  },
  {
    id: 'material-extractor',
    name: '素材提炼员',
    description: '将原始素材提炼为结构化知识卡片',
    category: '新媒体运营部',
    tags: ['素材', '提炼', '知识卡片', '笔记整理'],
    trigger: '用户说"提炼素材"、"整理笔记"、"消化素材"、"整理raw"时加载',
  },
  {
    id: 'ai-news-analyst',
    name: 'AI资讯分析师',
    description: '每日AI资讯采集、行业动态分析和日报生成',
    category: '新媒体运营部',
    tags: ['AI资讯', '行业动态', '日报', '资讯采集'],
    trigger: '用户说"AI资讯"、"行业新闻"、"今日动态"、"资讯日报"时加载',
  },

  // ── 新媒体运营部（平台） ──────────────────────────────
  {
    id: 'wechat-publisher',
    name: '公众号专员',
    description: '公众号文章排版、发布管理和数据追踪',
    category: '新媒体运营部',
    tags: ['公众号', '微信', '排版', '发布'],
    trigger: '用户说"公众号"、"微信文章"、"发公众号"时加载',
  },
  {
    id: 'xiaohongshu-operator',
    name: '小红书专员',
    description: '小红书封面设计、内容发布和数据运营',
    category: '新媒体运营部',
    tags: ['小红书', '封面', '种草', '发布'],
    trigger: '用户说"小红书"、"做封面"、"发小红书"时加载',
  },

  // ── 私域运营部 ──────────────────────────────────────────
  {
    id: 'moments-operator',
    name: '朋友圈运营',
    description: '朋友圈内容规划、排期发布和数据周报',
    category: '销售部',
    tags: ['朋友圈', '私域', '排期', '周报'],
    trigger: '用户说"朋友圈"、"朋友圈运营"、"私域"时加载',
  },
  {
    id: 'customer-manager',
    name: '客户管理员',
    description: '客户档案管理、客户分层和跟进记录',
    category: '销售部',
    tags: ['客户', 'CRM', '档案', '分层', '线索'],
    trigger: '用户说"管理客户"、"客户档案"、"客户分层"、"新客户"时加载',
  },
  {
    id: 'sales-follower',
    name: '销售跟单员',
    description: '销售跟进、成单辅助和转化漏斗管理',
    category: '销售部',
    tags: ['销售', '跟进', '成单', '转化', '漏斗'],
    trigger: '用户说"跟进客户"、"销售"、"成单"、"转化率"时加载',
  },

  // ── 财务部 ──────────────────────────────────────────────
  {
    id: 'finance-assistant',
    name: '财务助手',
    description: '收支记录、发票管理和财务报表',
    category: '财务部',
    tags: ['财务', '收支', '发票', '报表'],
    trigger: '用户提到"记账"、"收支"、"财务"、"利润"、"发票"时加载',
  },

  // ── 项目部 ──────────────────────────────────────────────
  {
    id: 'project-assistant',
    name: '项目助手',
    description: '项目创建、任务分解和进度追踪',
    category: '项目部',
    tags: ['项目', '任务', '进度', '里程碑'],
    trigger: '用户提到"项目"、"任务"、"里程碑"、"排期"时加载',
  },

  // ── 人事部 ──────────────────────────────────────────────
  {
    id: 'hr-assistant',
    name: '人事助手',
    description: '员工档案、考勤记录和绩效评估',
    category: '人事部',
    tags: ['人事', '员工', '考勤', '绩效'],
    trigger: '用户提到"员工"、"招聘"、"薪资"、"考勤"、"绩效"时加载',
  },

  // ── IT/数据部 ───────────────────────────────────────────
  {
    id: 'data-dashboard',
    name: '数据看板',
    description: '数据汇总、周报月报和KPI追踪',
    category: 'IT部',
    tags: ['数据', '报表', 'KPI', '复盘'],
    trigger: '用户提到"周报"、"月报"、"数据看板"、"汇总"时加载',
  },

  // ── 开放办公区 ─────────────────────────────────────────
  {
    id: 'inventory-assistant',
    name: '库存助手',
    description: 'SKU管理、订单跟踪和库存预警',
    category: '开放办公区',
    tags: ['库存', 'SKU', '订单', '物流'],
    trigger: '用户提到"库存"、"SKU"、"发货"、"订单"时加载',
  },

  // ── 跨境电商部 ─────────────────────────────────────────
  {
    id: 'amazon-operator',
    name: 'Amazon运营专员',
    description: 'Amazon店铺运营、Listing优化、广告投放和FBA管理',
    category: '跨境电商部',
    tags: ['Amazon', '亚马逊', 'FBA', 'Listing', '跨境', '广告'],
    trigger: '用户说"Amazon"、"亚马逊"、"FBA"、"Listing优化"、"亚马逊广告"时加载',
  },
  {
    id: 'tiktok-overseas-operator',
    name: 'TikTok海外运营',
    description: 'TikTok海外版内容运营、TikTok Shop管理和直播策划',
    category: '跨境电商部',
    tags: ['TikTok', 'TikTok Shop', '海外短视频', '跨境直播', '达人'],
    trigger: '用户说"TikTok海外"、"TikTok Shop"、"海外短视频"、"TikTok运营"时加载',
  },
  {
    id: 'shopify-operator',
    name: '独立站运营',
    description: 'Shopify独立站搭建、主题优化、流量转化和DTC品牌运营',
    category: '跨境电商部',
    tags: ['Shopify', '独立站', 'DTC', '建站', '品牌站', '转化率'],
    trigger: '用户说"独立站"、"Shopify"、"DTC"、"自建站"、"品牌站"时加载',
  },
  {
    id: 'crossborder-logistics',
    name: '跨境物流专员',
    description: '跨境物流方案、FBA头程、海外仓管理和报关清关',
    category: '跨境电商部',
    tags: ['跨境物流', 'FBA头程', '海外仓', '报关', '清关', '运费'],
    trigger: '用户说"跨境物流"、"FBA头程"、"海外仓"、"报关"、"运费计算"时加载',
  },

  // ── 海外社媒部 ─────────────────────────────────────────
  {
    id: 'youtube-operator',
    name: 'YouTube运营',
    description: 'YouTube频道运营、视频SEO、Shorts短视频和订阅增长',
    category: '海外社媒部',
    tags: ['YouTube', '油管', '视频SEO', 'Shorts', '订阅', '频道'],
    trigger: '用户说"YouTube"、"油管"、"YouTube Shorts"、"视频频道"时加载',
  },
  {
    id: 'instagram-operator',
    name: 'Instagram运营',
    description: 'Instagram账号运营、Reels短视频、Stories互动和海外社媒增长',
    category: '海外社媒部',
    tags: ['Instagram', 'IG', 'Reels', 'Stories', '海外社媒', '涨粉'],
    trigger: '用户说"Instagram"、"IG运营"、"Reels"、"海外社媒运营"时加载',
  },
  {
    id: 'twitter-operator',
    name: 'Twitter/X运营',
    description: 'Twitter/X账号运营、海外舆情监测和品牌声量管理',
    category: '海外社媒部',
    tags: ['Twitter', 'X', '推特', '海外社媒', '舆情', '品牌声量'],
    trigger: '用户说"Twitter"、"X平台"、"推特"、"海外舆情"时加载',
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
