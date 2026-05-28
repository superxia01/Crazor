import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { HERMES_HOME } from './crazor-config'

const SKILLS_SRC_DIR = resolve(import.meta.dirname, '../../data/skills')
const TARGET_DIR = resolve(HERMES_HOME, 'skills/crazor')

// Display metadata — will be embedded into the converted SKILL.md frontmatter
// After migration, this data lives in the files themselves and this constant can be removed.
const CATALOG_META: Record<string, { name: string; category: string; tags: string[] }> = {
  'topic-scheduler': { name: '选题调度员', category: '新媒体运营部', tags: ['选题', '排期', '热点', '内容规划'] },
  'content-writer': { name: '内容写手', category: '新媒体运营部', tags: ['写作', '文章', '图文', '改写', '教程'] },
  'material-extractor': { name: '素材提炼员', category: '新媒体运营部', tags: ['素材', '提炼', '知识卡片', '笔记整理'] },
  'ai-news-analyst': { name: 'AI资讯分析师', category: '新媒体运营部', tags: ['AI资讯', '行业动态', '日报', '资讯采集'] },
  'wechat-publisher': { name: '公众号专员', category: '新媒体运营部', tags: ['公众号', '微信', '排版', '发布'] },
  'xiaohongshu-operator': { name: '小红书专员', category: '新媒体运营部', tags: ['小红书', '封面', '种草', '发布'] },
  'moments-operator': { name: '朋友圈运营', category: '销售部', tags: ['朋友圈', '私域', '排期', '周报'] },
  'customer-manager': { name: '客户管理员', category: '销售部', tags: ['客户', 'CRM', '档案', '分层', '线索'] },
  'sales-follower': { name: '销售跟单员', category: '销售部', tags: ['销售', '跟进', '成单', '转化', '漏斗'] },
  'finance-assistant': { name: '财务助手', category: '财务部', tags: ['财务', '收支', '发票', '报表'] },
  'project-assistant': { name: '项目助手', category: '项目部', tags: ['项目', '任务', '进度', '里程碑'] },
  'hr-assistant': { name: '人事助手', category: '人事部', tags: ['人事', '员工', '考勤', '绩效'] },
  'data-dashboard': { name: '数据看板', category: 'IT部', tags: ['数据', '报表', 'KPI', '复盘'] },
  'inventory-assistant': { name: '库存助手', category: '开放办公区', tags: ['库存', 'SKU', '订单', '物流'] },
  'amazon-operator': { name: 'Amazon运营专员', category: '跨境电商部', tags: ['Amazon', '亚马逊', 'FBA', 'Listing', '跨境', '广告'] },
  'tiktok-overseas-operator': { name: 'TikTok海外运营', category: '跨境电商部', tags: ['TikTok', 'TikTok Shop', '海外短视频', '跨境直播', '达人'] },
  'shopify-operator': { name: '独立站运营', category: '跨境电商部', tags: ['Shopify', '独立站', 'DTC', '建站', '品牌站', '转化率'] },
  'crossborder-logistics': { name: '跨境物流专员', category: '跨境电商部', tags: ['跨境物流', 'FBA头程', '海外仓', '报关', '清关', '运费'] },
  'youtube-operator': { name: 'YouTube运营', category: '海外社媒部', tags: ['YouTube', '油管', '视频SEO', 'Shorts', '订阅', '频道'] },
  'instagram-operator': { name: 'Instagram运营', category: '海外社媒部', tags: ['Instagram', 'IG', 'Reels', 'Stories', '海外社媒', '涨粉'] },
  'twitter-operator': { name: 'Twitter/X运营', category: '海外社媒部', tags: ['Twitter', 'X', '推特', '海外社媒', '舆情', '品牌声量'] },
}

/** Parse the simple YAML frontmatter from source .md files */
function parseSourceFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const yaml = match[1]
  const result: Record<string, any> = {}
  let currentArr: string[] | null = null
  for (const line of yaml.split(/\r?\n/)) {
    if (/^\s+-\s+/.test(line) && currentArr !== null) {
      currentArr.push(line.replace(/^\s+-\s+/, '').trim())
      continue
    }
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

/** Extract body (everything after the second ---) */
function extractBody(content: string): string {
  const match = content.match(/^---[\s\S]*?---\r?\n([\s\S]*)$/)
  return match ? match[1].trim() : content.trim()
}

/** Convert a single source .md file to Hermes SKILL.md format */
function convertToHermesFormat(id: string, sourceContent: string): string {
  const fm = parseSourceFrontmatter(sourceContent) || {}
  const body = extractBody(sourceContent)
  const meta = CATALOG_META[id]

  const isSystem = id === 'vault-rules'
  const category = isSystem ? 'system' : (meta?.category || '')
  const tags = meta?.tags || []
  const employeeName = meta?.name || (fm as any).name || id

  // Build YAML frontmatter — flat structure so simple YAML parser can read it back
  const mcpTools = Array.isArray(fm.mcpTools) ? fm.mcpTools : []
  const apis = Array.isArray(fm.apis) ? fm.apis : []
  const dbTables = Array.isArray(fm.dbTables) ? fm.dbTables : []
  const externalApis = Array.isArray(fm.externalApis) ? fm.externalApis : []
  const trigger = fm.trigger || ''

  const yamlParts: string[] = [
    `name: ${id}`,
    `description: "${(fm.description || '').replace(/"/g, '\\"')}"`,
    `category: "${category}"`,
    `employeeName: "${employeeName}"`,
  ]
  if (trigger) {
    yamlParts.push(`trigger: "${(trigger as string).replace(/"/g, '\\"')}"`)
  }
  yamlParts.push(`tags:`)
  if (tags.length > 0) {
    yamlParts.push(...tags.map(t => `  - "${t}"`))
  } else {
    yamlParts.push(`  []`)
  }
  yamlParts.push(`mcpTools:`)
  if (mcpTools.length > 0) {
    yamlParts.push(...mcpTools.map((t: string) => `  - ${t}`))
  } else {
    yamlParts.push(`  []`)
  }
  yamlParts.push(`apis:`)
  if (apis.length > 0) {
    yamlParts.push(...apis.map((a: string) => `  - ${a}`))
  } else {
    yamlParts.push(`  []`)
  }
  yamlParts.push(`dbTables:`)
  if (dbTables.length > 0) {
    yamlParts.push(...dbTables.map((t: string) => `  - ${t}`))
  } else {
    yamlParts.push(`  []`)
  }
  yamlParts.push(`externalApis:`)
  if (externalApis.length > 0) {
    yamlParts.push(...externalApis.map((a: string) => `  - ${a}`))
  } else {
    yamlParts.push(`  []`)
  }

  const frontmatter = `---\n${yamlParts.join('\n')}\n---`

  // Build Hermes-standard body sections
  let hermesBody = ''

  if (trigger) {
    hermesBody += `\n\n## When to Use\n\n${trigger}。`
  }

  hermesBody += '\n\n## Prerequisites\n\n- MCP Server: crazor (已注册于 ~/.hermes/config.yaml)'

  if (mcpTools.length > 0) {
    hermesBody += '\n\n### MCP Tools\n\n' + mcpTools.map((t: string) => `- \`${t}\``).join('\n')
  }
  if (apis.length > 0) {
    hermesBody += '\n\n### Internal APIs\n\n' + apis.map((a: string) => `- \`${a}\``).join('\n')
  }
  if (dbTables.length > 0) {
    hermesBody += '\n\n### Database Tables\n\n' + dbTables.map((t: string) => `- \`${t}\``).join('\n')
  }
  if (externalApis.length > 0) {
    hermesBody += '\n\n### External APIs\n\n' + externalApis.map((a: string) => `- \`${a}\``).join('\n')
  }

  hermesBody += '\n\n## Procedure\n\n' + body

  return frontmatter + hermesBody
}

/** Seed all skills to ~/.hermes/skills/crazor/ */
export function seedSkills(): { converted: number; skipped: number } {
  let converted = 0
  let skipped = 0

  if (!existsSync(SKILLS_SRC_DIR)) {
    console.log('[seed-skills] No source skills directory found, skipping')
    return { converted, skipped }
  }

  mkdirSync(TARGET_DIR, { recursive: true })

  const sourceFiles = readdirSync(SKILLS_SRC_DIR).filter((f: string) => f.endsWith('.md'))

  for (const file of sourceFiles) {
    const id = file.replace(/\.md$/, '')
    const sourcePath = resolve(SKILLS_SRC_DIR, file)
    const targetDir = resolve(TARGET_DIR, id)
    const targetPath = resolve(targetDir, 'SKILL.md')

    const sourceContent = readFileSync(sourcePath, 'utf-8')
    const convertedContent = convertToHermesFormat(id, sourceContent)

    // Idempotent: skip if content is identical
    if (existsSync(targetPath)) {
      const existing = readFileSync(targetPath, 'utf-8')
      if (existing === convertedContent) {
        skipped++
        continue
      }
    }

    mkdirSync(targetDir, { recursive: true })
    writeFileSync(targetPath, convertedContent, 'utf-8')
    converted++
  }

  return { converted, skipped }
}
