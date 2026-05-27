// Seed vault templates & mock-data into filesystem vault
// Creates real directories and .md files instead of SQLite rows

import { resolve, join } from "path"
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs"
import { CRAZOR_VAULT_ROOT, VAULT_META_FILE } from "./crazor-config"

const VAULT_DATA = resolve(import.meta.dirname, "../../data/vault")

interface FolderDef {
  name: string
  children?: (string | FolderDef)[]
}

const VAULT_TREE: FolderDef[] = [
  { name: "00-关于我", children: ["10-定位与品牌", "20-产品与业务", "30-目标客户", "40-账号矩阵", "50-目标与节奏"] },
  { name: "10-百科", children: ["10-行业与市场", "20-产品知识", "30-客户洞察", "40-销售与转化", "50-内容与流量", "60-实战复盘"] },
  {
    name: "20-业务流程", children: [
      { name: "10-公域流量", children: [
          "10-选题池", "20-内容管理", "30-数据统计", "40-内容资产", "50-素材提炼",
          { name: "60-海外平台", children: ["YouTube", "Twitter", "Instagram"] },
          { name: "70-跨境电商", children: ["Amazon", "TikTok", "Shopify", "物流"] },
        ] },
      { name: "20-私域运营", children: ["10-朋友圈", "20-社群", "30-数据周报"] },
      { name: "30-客户管理", children: ["10-线索管理", "20-成交记录"] },
      "40-产品交付", "45-项目管理", "50-人事管理", "55-财务管理", "60-库存管理", "70-数据看板",
    ],
  },
  { name: "30-素材资产", children: ["10-品牌", "20-账号", "30-内容模板", "40-PPT模板", "50-报价方案", "60-合同"] },
  { name: "40-事件", children: ["10-公司", "20-AI"] },
  { name: "99-归档" },
]

// ── Helpers ──────────────────────────────────────────────────────────

function writeDirMeta(dirPath: string, meta: Record<string, any>): void {
  writeFileSync(resolve(dirPath, VAULT_META_FILE), JSON.stringify(meta, null, 2), 'utf-8')
}

function readMdFiles(dir: string): { filename: string; content: string }[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith(".md"))
    .map(f => ({ filename: f, content: readFileSync(join(dir, f), "utf-8") }))
}

function createDirTree(basePath: string, defs: (string | FolderDef)[]): void {
  const sort: string[] = []
  defs.forEach(def => {
    const name = typeof def === "string" ? def : def.name
    const dirPath = resolve(basePath, name)
    mkdirSync(dirPath, { recursive: true })
    sort.push(name)
    if (typeof def !== "string" && def.children) {
      createDirTree(dirPath, def.children)
    }
  })
  writeDirMeta(basePath, { sort })
}

function copyNote(dirPath: string, filename: string, content: string): void {
  mkdirSync(dirPath, { recursive: true })
  const title = filename.replace(/\.md$/, "")
  writeFileSync(resolve(dirPath, `${title}.md`), content, 'utf-8')
  // Update sort in target directory
  const metaPath = resolve(dirPath, VAULT_META_FILE)
  let meta: Record<string, any> = {}
  if (existsSync(metaPath)) {
    try { meta = JSON.parse(readFileSync(metaPath, 'utf-8')) } catch { /* ignore */ }
  }
  if (!meta.sort) meta.sort = []
  if (!meta.sort.includes(title)) meta.sort.push(title)
  writeDirMeta(dirPath, meta)
}

// ── Per-file folder mapping ──────────────────────────────────────────

const FLOW_FILE_MAP: Record<string, string[]> = {
  "CRM-填写指南.md": ["20-业务流程", "30-客户管理"],
  "_template-客户档案.md": ["20-业务流程", "30-客户管理", "10-线索管理"],
  "_template-跟进记录.md": ["20-业务流程", "30-客户管理", "10-线索管理"],
  "_template-渠道档案.md": ["20-业务流程", "30-客户管理"],
  "_template-月度业绩报表.md": ["20-业务流程", "30-客户管理", "20-成交记录"],
  "公域流量-填写指南.md": ["20-业务流程", "10-公域流量"],
  "内容资产-填写指南.md": ["20-业务流程", "10-公域流量", "40-内容资产"],
  "数据统计-填写指南.md": ["20-业务流程", "10-公域流量", "30-数据统计"],
  "素材提炼-填写指南.md": ["20-业务流程", "10-公域流量", "50-素材提炼"],
  "朋友圈-填写指南.md": ["20-业务流程", "20-私域运营", "10-朋友圈"],
  "社群-填写指南.md": ["20-业务流程", "20-私域运营", "20-社群"],
  "私域运营-填写指南.md": ["20-业务流程", "20-私域运营"],
  "数据周报模板.md": ["20-业务流程", "20-私域运营", "30-数据周报"],
  "产品交付-填写指南.md": ["20-业务流程", "40-产品交付"],
  "人事管理-填写指南.md": ["20-业务流程", "50-人事管理"],
  "财务管理-填写指南.md": ["20-业务流程", "55-财务管理"],
  "库存管理-填写指南.md": ["20-业务流程", "60-库存管理"],
  "数据看板-填写指南.md": ["20-业务流程", "70-数据看板"],
  "品牌填写指南.md": ["30-素材资产", "10-品牌"],
  "账号填写指南.md": ["30-素材资产", "20-账号"],
  "PPT模板填写指南.md": ["30-素材资产", "40-PPT模板"],
  "报价方案填写指南.md": ["30-素材资产", "50-报价方案"],
  "合同填写指南.md": ["30-素材资产", "60-合同"],
  "客户填写指南.md": ["20-业务流程", "30-客户管理"],
}

// ── Main seed function ───────────────────────────────────────────────

export function seedVault(): { folders: number; notes: number } {
  const knowledgeDir = resolve(CRAZOR_VAULT_ROOT, "knowledge")

  // Skip if vault already has content
  if (existsSync(knowledgeDir)) {
    const entries = readdirSync(knowledgeDir).filter(e => e !== ".DS_Store" && e !== ".obsidian" && e !== VAULT_META_FILE)
    if (entries.length > 5) return { folders: 0, notes: 0 }
  }

  mkdirSync(CRAZOR_VAULT_ROOT, { recursive: true })
  let noteCount = 0

  // 1. Create directory hierarchy
  createDirTree(knowledgeDir, VAULT_TREE)

  // 2. Root system guides
  const ROOT_FILE_MAP: Record<string, string[]> = {
    "20-raw-填写指南.md": [],
    "raw-cleaned-填写指南.md": [],
    "raw-tagged-填写指南.md": [],
    "60-events-填写指南.md": ["40-事件"],
    "99-archive-填写指南.md": ["99-归档"],
  }
  for (const f of readMdFiles(join(VAULT_DATA, "root"))) {
    if (ROOT_FILE_MAP.hasOwnProperty(f.filename)) {
      const target = ROOT_FILE_MAP[f.filename]
      if (target.length === 0) continue
      const dir = resolve(knowledgeDir, ...target)
      copyNote(dir, f.filename, f.content)
      noteCount++
    } else {
      copyNote(knowledgeDir, f.filename, f.content)
      noteCount++
    }
  }

  // 3. me templates → 00-关于我
  for (const f of readMdFiles(join(VAULT_DATA, "me"))) {
    copyNote(resolve(knowledgeDir, "00-关于我"), f.filename, f.content)
    noteCount++
  }

  // 4. wiki templates → 10-百科/{section}
  const wikiSubdirs = ["10-行业与市场", "20-产品知识", "30-客户洞察", "40-销售与转化", "50-内容与流量", "60-实战复盘"]
  for (const sub of wikiSubdirs) {
    for (const f of readMdFiles(join(VAULT_DATA, "wiki", sub))) {
      copyNote(resolve(knowledgeDir, "10-百科", sub), f.filename, f.content)
      noteCount++
    }
  }

  // 5. flow templates
  for (const f of readMdFiles(join(VAULT_DATA, "flow"))) {
    const target = FLOW_FILE_MAP[f.filename] || ["20-业务流程"]
    const dir = resolve(knowledgeDir, ...target)
    copyNote(dir, f.filename, f.content)
    noteCount++
  }

  // 6. Mock-data
  const MOCK_MAP = [
    { dir: "mock-data/00-me", folder: ["00-关于我"] },
    { dir: "mock-data/20-wiki", folder: ["10-百科"] },
    { dir: "mock-data/30-flow/10-公域流量", folder: ["20-业务流程", "10-公域流量"] },
    { dir: "mock-data/30-flow/20-私域运营/10-朋友圈", folder: ["20-业务流程", "20-私域运营", "10-朋友圈"] },
    { dir: "mock-data/30-flow/30-CRM", folder: ["20-业务流程", "30-客户管理"] },
    { dir: "mock-data/50-projects", folder: ["20-业务流程", "45-项目管理"] },
  ]
  for (const m of MOCK_MAP) {
    for (const f of readMdFiles(join(VAULT_DATA, m.dir))) {
      const dir = resolve(knowledgeDir, ...m.folder)
      copyNote(dir, f.filename, f.content)
      noteCount++
    }
  }

  // 7. Notebook: inbox
  const notebookDir = resolve(CRAZOR_VAULT_ROOT, "notebook", "inbox")
  mkdirSync(notebookDir, { recursive: true })
  writeDirMeta(resolve(CRAZOR_VAULT_ROOT, "notebook"), { sort: ["inbox"] })
  for (const f of readMdFiles(join(VAULT_DATA, "mock-data/10-raw/inbox"))) {
    copyNote(notebookDir, f.filename, f.content)
    noteCount++
  }
  // Raw guides → notebook inbox
  const RAW_GUIDES = ["20-raw-填写指南.md", "raw-cleaned-填写指南.md", "raw-tagged-填写指南.md"]
  for (const f of readMdFiles(join(VAULT_DATA, "root"))) {
    if (RAW_GUIDES.includes(f.filename)) {
      copyNote(notebookDir, f.filename, f.content)
      noteCount++
    }
  }

  // Count folders
  function countDirs(dir: string): number {
    let count = 0
    if (!existsSync(dir)) return 0
    for (const entry of readdirSync(dir)) {
      if (entry === ".DS_Store" || entry === ".obsidian" || entry === VAULT_META_FILE) continue
      const fullPath = resolve(dir, entry)
      try {
        if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
          count++
          count += countDirs(fullPath)
        }
      } catch { /* ignore */ }
    }
    return count
  }

  const folderTotal = countDirs(knowledgeDir) + countDirs(resolve(CRAZOR_VAULT_ROOT, "notebook"))

  console.log(`[seed] Vault seeded: ${folderTotal} folders, ${noteCount} notes`)
  return { folders: folderTotal, notes: noteCount }
}
