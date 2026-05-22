// Seed vault templates & mock-data into the knowledge base
import { resolve, join } from "path"
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { db, id, now } from "./crazor-db"
import { CRAZOR_DOCS_ROOT as DOCS_ROOT } from "./crazor-config"
const VAULT_DATA = resolve(import.meta.dirname, "../../data/vault")

// ── Vault folder hierarchy (no number prefixes) ────────────────────

interface FolderDef {
  name: string
  children?: (string | FolderDef)[]
}

const VAULT_TREE: FolderDef[] = [
  { name: "关于我", children: ["定位与品牌", "产品与业务", "目标客户", "账号矩阵", "目标与节奏"] },
  { name: "百科", children: ["行业与市场", "产品知识", "客户洞察", "销售与转化", "内容与流量", "实战复盘"] },
  {
    name: "业务流程", children: [
      { name: "公域流量", children: ["选题池", "内容管理", "数据统计", "内容资产", "素材提炼"] },
      { name: "私域运营", children: ["朋友圈", "社群", "数据周报"] },
      { name: "客户管理", children: ["线索管理", "成交记录"] },
      "产品交付", "项目管理", "人事管理", "财务管理", "库存管理", "数据看板",
    ],
  },
  { name: "素材资产", children: ["品牌", "账号", "内容模板", "PPT模板", "报价方案", "合同"] },
  { name: "事件", children: ["公司", "AI"] },
  { name: "归档" },
]

// ── Helpers ──────────────────────────────────────────────────────────

const seedFolders = new Map<string, string>() // name → folderId

function insertFolder(scope: string, parentId: string | null, name: string, order: number): string {
  const folderId = id()
  const ts = now()
  db.prepare(
    "INSERT INTO doc_folders (id, scope, parent_id, name, sort_order, contact_id, created_at, updated_at) VALUES (?,?,?,?,NULL,?,?,?)"
  ).run(folderId, scope, parentId, name, order, ts, ts)
  return folderId
}

function insertNote(scope: string, folderId: string | null, title: string, content: string, order: number): string {
  const noteId = id()
  const ts = now()
  db.prepare(
    "INSERT INTO doc_notes (id, scope, folder_id, title, sort_order, contact_id, created_at, updated_at) VALUES (?,?,?,?,NULL,?,?,?)"
  ).run(noteId, scope, folderId, title, order, ts, ts)
  const dir = resolve(DOCS_ROOT, scope)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${noteId}.md`), content)
  return noteId
}

function createFolderTree(scope: string, parentId: string | null, defs: (string | FolderDef)[], startOrder = 0) {
  defs.forEach((def, i) => {
    const name = typeof def === "string" ? def : def.name
    const folderId = insertFolder(scope, parentId, name, startOrder + i)
    seedFolders.set(name, folderId)
    if (typeof def !== "string" && def.children) {
      createFolderTree(scope, folderId, def.children)
    }
  })
}

function folderId(...parts: string[]): string | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    const found = seedFolders.get(parts[i])
    if (found) return found
  }
  return null
}

function readMdFiles(dir: string): { filename: string; content: string }[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ filename: f, content: readFileSync(join(dir, f), "utf-8") }))
}

function seedNote(scope: string, folderParts: string[], filename: string, content: string, order: number) {
  const title = filename.replace(/\.md$/, "")
  const fid = folderParts.length > 0 ? folderId(...folderParts) : null
  insertNote(scope, fid, title, content, order)
}

// ── Per-file folder mapping ──────────────────────────────────────────

const FLOW_FILE_MAP: Record<string, string[]> = {
  "CRM-填写指南.md": ["业务流程", "客户管理"],
  "_template-客户档案.md": ["业务流程", "客户管理", "线索管理"],
  "_template-跟进记录.md": ["业务流程", "客户管理", "线索管理"],
  "_template-渠道档案.md": ["业务流程", "客户管理"],
  "_template-月度业绩报表.md": ["业务流程", "客户管理", "成交记录"],
  "公域流量-填写指南.md": ["业务流程", "公域流量"],
  "内容资产-填写指南.md": ["业务流程", "公域流量", "内容资产"],
  "数据统计-填写指南.md": ["业务流程", "公域流量", "数据统计"],
  "素材提炼-填写指南.md": ["业务流程", "公域流量", "素材提炼"],
  "朋友圈-填写指南.md": ["业务流程", "私域运营", "朋友圈"],
  "社群-填写指南.md": ["业务流程", "私域运营", "社群"],
  "私域运营-填写指南.md": ["业务流程", "私域运营"],
  "数据周报模板.md": ["业务流程", "私域运营", "数据周报"],
  "产品交付-填写指南.md": ["业务流程", "产品交付"],
  "人事管理-填写指南.md": ["业务流程", "人事管理"],
  "财务管理-填写指南.md": ["业务流程", "财务管理"],
  "库存管理-填写指南.md": ["业务流程", "库存管理"],
  "数据看板-填写指南.md": ["业务流程", "数据看板"],
  "品牌填写指南.md": ["素材资产", "品牌"],
  "账号填写指南.md": ["素材资产", "账号"],
  "PPT模板填写指南.md": ["素材资产", "PPT模板"],
  "报价方案填写指南.md": ["素材资产", "报价方案"],
  "合同填写指南.md": ["素材资产", "合同"],
  "客户填写指南.md": ["业务流程", "客户管理"],
}

// ── Main seed function ───────────────────────────────────────────────

export function seedVault(): { folders: number; notes: number } {
  const existing = (db.prepare("SELECT count(*) as c FROM doc_folders WHERE scope = 'knowledge'").get() as any).c
  if (existing > 10) return { folders: 0, notes: 0 }

  let noteCount = 0

  db.prepare("DELETE FROM doc_folders WHERE scope = 'knowledge' AND name = '默认目录'").run()
  db.prepare("DELETE FROM doc_folders WHERE scope = 'notebook' AND name = '默认目录'").run()

  // 1. Create folder hierarchy
  createFolderTree("knowledge", null, VAULT_TREE)

  // 2. Root system guides — only system-level ones at root, others go to subfolders
  const ROOT_FILE_MAP: Record<string, string[]> = {
    "20-raw-填写指南.md": [],         // raw 对应 AI笔记，不放入知识库
    "raw-cleaned-填写指南.md": [],     // 同上
    "raw-tagged-填写指南.md": [],      // 同上
    "60-events-填写指南.md": ["事件"],
    "99-archive-填写指南.md": ["归档"],
  }
  for (const f of readMdFiles(join(VAULT_DATA, "root"))) {
    if (ROOT_FILE_MAP.hasOwnProperty(f.filename)) {
      const target = ROOT_FILE_MAP[f.filename]
      if (target.length === 0) continue // skip raw-related guides
      seedNote("knowledge", target, f.filename, f.content, noteCount++)
    } else {
      // 系统使用指南, 骨架设计说明 → root
      seedNote("knowledge", [], f.filename, f.content, noteCount++)
    }
  }

  // 3. me templates
  for (const f of readMdFiles(join(VAULT_DATA, "me"))) {
    seedNote("knowledge", ["关于我"], f.filename, f.content, noteCount++)
  }

  // 4. wiki templates
  const wikiSubdirs = ["10-行业与市场", "20-产品知识", "30-客户洞察", "40-销售与转化", "50-内容与流量", "60-实战复盘"]
  for (const sub of wikiSubdirs) {
    const cleanName = sub.replace(/^\d+-/, "")
    for (const f of readMdFiles(join(VAULT_DATA, "wiki", sub))) {
      seedNote("knowledge", ["百科", cleanName], f.filename, f.content, noteCount++)
    }
  }

  // 5. flow templates
  for (const f of readMdFiles(join(VAULT_DATA, "flow"))) {
    const target = FLOW_FILE_MAP[f.filename] || ["业务流程"]
    seedNote("knowledge", target, f.filename, f.content, noteCount++)
  }

  // 7. Mock-data
  const MOCK_MAP = [
    { dir: "mock-data/00-me", folder: ["关于我"] },
    { dir: "mock-data/20-wiki", folder: ["百科"] },
    { dir: "mock-data/30-flow/10-公域流量", folder: ["业务流程", "公域流量"] },
    { dir: "mock-data/30-flow/20-私域运营/10-朋友圈", folder: ["业务流程", "私域运营", "朋友圈"] },
    { dir: "mock-data/30-flow/30-CRM", folder: ["业务流程", "客户管理"] },
    { dir: "mock-data/50-projects", folder: ["业务流程", "项目管理"] },
  ]
  for (const m of MOCK_MAP) {
    for (const f of readMdFiles(join(VAULT_DATA, m.dir))) {
      seedNote("knowledge", m.folder, f.filename, f.content, noteCount++)
    }
  }

  // 8. Notebook: raw inbox + raw guides
  const nbFolderId = insertFolder("notebook", null, "inbox", 0)
  for (const f of readMdFiles(join(VAULT_DATA, "mock-data/10-raw/inbox"))) {
    const title = f.filename.replace(/\.md$/, "")
    insertNote("notebook", nbFolderId, title, f.content, noteCount++)
    noteCount++
  }
  // Raw guides → notebook inbox
  const RAW_GUIDES = ["20-raw-填写指南.md", "raw-cleaned-填写指南.md", "raw-tagged-填写指南.md"]
  for (const f of readMdFiles(join(VAULT_DATA, "root"))) {
    if (RAW_GUIDES.includes(f.filename)) {
      const title = f.filename.replace(/\.md$/, "")
      insertNote("notebook", nbFolderId, title, f.content, noteCount++)
      noteCount++
    }
  }

  return { folders: seedFolders.size + 1, notes: noteCount }
}
