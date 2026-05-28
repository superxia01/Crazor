// Copyright (c) 2026 MeeJoy
// Crazor business data — SQLite via Bun built-in

import { Database } from "bun:sqlite"
import { createHash, randomBytes } from "node:crypto"
import { resolve } from "path"
import { CRAZOR_DB_PATH, HERMES_HOME } from "./crazor-config"

const db = new Database(CRAZOR_DB_PATH)
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA foreign_keys = ON")

// ── Schema ──────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT DEFAULT '',
    role TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    status TEXT DEFAULT 'potential',
    deal REAL DEFAULT 0,
    tags TEXT DEFAULT '[]',
    last_contacted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    invoice_status TEXT DEFAULT 'none',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'todo',
    assignee TEXT DEFAULT '',
    due_date TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS doc_folders (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    contact_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS doc_notes (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    folder_id TEXT,
    title TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    contact_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS follow_ups (
    id TEXT PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    method TEXT DEFAULT '',
    content TEXT DEFAULT '',
    next_step TEXT DEFAULT '',
    status TEXT DEFAULT '待跟进',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT DEFAULT '',
    wechat TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    company_type TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    cooperation_mode TEXT DEFAULT '',
    commission_rate TEXT DEFAULT '',
    settlement_method TEXT DEFAULT '',
    status TEXT DEFAULT '活跃',
    rating TEXT DEFAULT '潜力',
    total_customers INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    main_products TEXT DEFAULT '',
    last_brought_customer_at TEXT,
    is_public INTEGER DEFAULT 0,
    account_name TEXT DEFAULT '',
    platform_id TEXT DEFAULT '',
    followers INTEGER DEFAULT 0,
    remark TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_pieces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    platform TEXT DEFAULT '',
    form TEXT DEFAULT '',
    status TEXT DEFAULT '选题中',
    published_at TEXT DEFAULT '',
    topic_source TEXT DEFAULT '',
    doc_id TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    custom_data TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channel_referrals (
    id TEXT PRIMARY KEY,
    channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    product_type TEXT DEFAULT '',
    deal_amount REAL DEFAULT 0,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS field_definitions (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    options TEXT DEFAULT '[]',
    visible INTEGER DEFAULT 1,
    sortable INTEGER DEFAULT 1,
    filterable INTEGER DEFAULT 1,
    required INTEGER DEFAULT 0,
    width INTEGER DEFAULT 150,
    sort_order INTEGER DEFAULT 0,
    section TEXT DEFAULT '',
    is_custom INTEGER DEFAULT 0,
    relation_entity TEXT DEFAULT '',
    render_hint TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(entity, field_key)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_type TEXT NOT NULL DEFAULT 'unknown',
    actor_id TEXT NOT NULL DEFAULT 'unknown',
    source TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT DEFAULT '',
    payload_hash TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type, actor_id, created_at);

  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'human',
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS actor_tokens (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    token_type TEXT NOT NULL DEFAULT 'api',
    status TEXT NOT NULL DEFAULT 'active',
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_actor_tokens_member ON actor_tokens(member_id, status);
`)

// ── Schema migrations (idempotent) ──────────────────────────

const migrations = [
  "ALTER TABLE contacts ADD COLUMN stage TEXT DEFAULT '新线索'",
  "ALTER TABLE contacts ADD COLUMN source TEXT DEFAULT ''",
  "ALTER TABLE contacts ADD COLUMN level TEXT DEFAULT ''",
  "ALTER TABLE contacts ADD COLUMN wechat TEXT DEFAULT ''",
  "ALTER TABLE contacts ADD COLUMN remark TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN category TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN subcategory TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN invoice_number TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN tax_amount REAL DEFAULT 0",
  "ALTER TABLE projects ADD COLUMN contact_id TEXT",
  "ALTER TABLE projects ADD COLUMN budget REAL DEFAULT 0",
  "ALTER TABLE projects ADD COLUMN team TEXT DEFAULT ''",
  "ALTER TABLE projects ADD COLUMN start_date TEXT",
  "ALTER TABLE projects ADD COLUMN deadline TEXT",
  "ALTER TABLE tasks ADD COLUMN estimated_hours REAL DEFAULT 0",
  "ALTER TABLE tasks ADD COLUMN actual_hours REAL DEFAULT 0",
  // CRM enhancement: contacts
  "ALTER TABLE contacts ADD COLUMN sales_person TEXT DEFAULT ''",
  "ALTER TABLE contacts ADD COLUMN project_type TEXT DEFAULT ''",
  "ALTER TABLE contacts ADD COLUMN budget_range TEXT DEFAULT ''",
  "ALTER TABLE contacts ADD COLUMN next_follow_up TEXT",
  "ALTER TABLE contacts ADD COLUMN identity TEXT DEFAULT ''",
  "ALTER TABLE contacts ADD COLUMN situation TEXT DEFAULT ''",
  // CRM enhancement: transactions (业绩流水)
  "ALTER TABLE transactions ADD COLUMN quote REAL DEFAULT 0",
  "ALTER TABLE transactions ADD COLUMN product_type TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN progress TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN payment_status TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN payment_channel TEXT DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN channel_id TEXT DEFAULT ''",
  // Dynamic custom_data JSON column for flexible fields
  "ALTER TABLE contacts ADD COLUMN custom_data TEXT DEFAULT '{}'",
  "ALTER TABLE transactions ADD COLUMN custom_data TEXT DEFAULT '{}'",
  "ALTER TABLE channels ADD COLUMN custom_data TEXT DEFAULT '{}'",
]
for (const sql of migrations) {
  try { db.exec(sql) } catch { /* column already exists */ }
}

// ── Helpers ─────────────────────────────────────────────────

function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function now(): string {
  return new Date().toISOString()
}

function hashPayload(payload: unknown): string {
  if (payload === undefined || payload === null || payload === "") return ""
  const text = typeof payload === "string" ? payload : JSON.stringify(payload)
  return createHash("sha256").update(text).digest("hex")
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function tokenPrefix(token: string): string {
  return token.slice(0, 12)
}

function mapContact(row: any) {
  if (!row) return null
  const { custom_data, tags, deal, ...rest } = row
  return { ...rest, tags: JSON.parse(tags || "[]"), deal: Number(deal), ...JSON.parse(custom_data || "{}") }
}

function mapTransaction(row: any) {
  if (!row) return null
  const { custom_data, amount, tax_amount, quote, ...rest } = row
  return { ...rest, amount: Number(amount), tax_amount: Number(tax_amount || 0), quote: Number(quote || 0), ...JSON.parse(custom_data || "{}") }
}

function mapChannel(row: any) {
  if (!row) return null
  const { custom_data, total_revenue, followers, is_public, ...rest } = row
  return { ...rest, total_revenue: Number(total_revenue || 0), followers: Number(followers || 0), is_public: Number(is_public || 0), ...JSON.parse(custom_data || "{}") }
}

function mapContentPiece(row: any) {
  if (!row) return null
  const { custom_data, tags, ...rest } = row
  return { ...rest, tags: JSON.parse(tags || "[]"), ...JSON.parse(custom_data || "{}") }
}

// Known column names per table (used to separate known vs custom fields)
const CONTACT_COLUMNS = new Set(["id","name","company","role","phone","email","status","deal","tags","last_contacted_at","stage","source","level","wechat","remark","sales_person","project_type","budget_range","next_follow_up","identity","situation","custom_data","created_at","updated_at"])
const TRANSACTION_COLUMNS = new Set(["id","contact_id","type","amount","description","invoice_status","date","category","subcategory","invoice_number","tax_amount","quote","product_type","progress","payment_status","payment_channel","channel_id","custom_data","created_at","updated_at"])
const CHANNEL_COLUMNS = new Set(["id","name","contact_person","wechat","phone","company_type","company_name","cooperation_mode","commission_rate","settlement_method","status","rating","total_customers","total_revenue","main_products","last_brought_customer_at","is_public","account_name","platform_id","followers","remark","custom_data","created_at","updated_at"])
const CONTENT_PIECE_COLUMNS = new Set(["id","title","platform","form","status","published_at","topic_source","doc_id","views","likes","comments","shares","tags","custom_data","created_at","updated_at"])

function splitKnownCustom(data: Record<string, any>, known: Set<string>) {
  const known_: Record<string, any> = {}
  const custom: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === "custom_data" || k === "created_at" || k === "updated_at" || k === "id") continue
    if (known.has(k)) known_[k] = v
    else custom[k] = v
  }
  return { known: known_, custom }
}

// ── Contacts ────────────────────────────────────────────────

export function listContacts(filter?: { status?: string; q?: string; stage?: string; level?: string; project_type?: string; sales_person?: string }) {
  let sql = "SELECT * FROM contacts WHERE 1=1"
  const params: any[] = []
  if (filter?.status) { sql += " AND status = ?"; params.push(filter.status) }
  if (filter?.stage) { sql += " AND stage = ?"; params.push(filter.stage) }
  if (filter?.level) { sql += " AND level = ?"; params.push(filter.level) }
  if (filter?.project_type) { sql += " AND project_type = ?"; params.push(filter.project_type) }
  if (filter?.sales_person) { sql += " AND sales_person = ?"; params.push(filter.sales_person) }
  if (filter?.q) {
    sql += " AND (name LIKE ? OR company LIKE ? OR role LIKE ?)"
    const q = `%${filter.q}%`
    params.push(q, q, q)
  }
  sql += " ORDER BY updated_at DESC"
  return db.prepare(sql).all(...params).map(mapContact)
}

export function getContact(id: string) {
  return mapContact(db.prepare("SELECT * FROM contacts WHERE id = ?").get(id))
}

export function createContact(data: Partial<any>) {
  const { known, custom } = splitKnownCustom(data, CONTACT_COLUMNS)
  const c = {
    id: id(), name: known.name || "", company: known.company || "", role: known.role || "",
    phone: known.phone || "", email: known.email || "", status: known.status || "potential",
    deal: known.deal || 0, tags: JSON.stringify(known.tags || []),
    last_contacted_at: known.last_contacted_at || null,
    stage: known.stage || "新线索", source: known.source || "", level: known.level || "",
    wechat: known.wechat || "", remark: known.remark || "",
    sales_person: known.sales_person || "", project_type: known.project_type || "",
    budget_range: known.budget_range || "", next_follow_up: known.next_follow_up || null,
    identity: known.identity || "", situation: known.situation || "",
    custom_data: JSON.stringify(custom),
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO contacts (id,name,company,role,phone,email,status,deal,tags,last_contacted_at,stage,source,level,wechat,remark,sales_person,project_type,budget_range,next_follow_up,identity,situation,custom_data,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(c.id, c.name, c.company, c.role, c.phone, c.email, c.status, c.deal, c.tags, c.last_contacted_at, c.stage, c.source, c.level, c.wechat, c.remark, c.sales_person, c.project_type, c.budget_range, c.next_follow_up, c.identity, c.situation, c.custom_data, c.created_at, c.updated_at)
  return getContact(c.id)
}

export function updateContact(id: string, data: Partial<any>) {
  const existing = getContact(id)
  if (!existing) return null
  const { known, custom } = splitKnownCustom(data, CONTACT_COLUMNS)
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["name", "company", "role", "phone", "email", "status", "deal", "last_contacted_at", "stage", "source", "level", "wechat", "remark", "sales_person", "project_type", "budget_range", "next_follow_up", "identity", "situation"]) {
    if (known[key] !== undefined) { sets.push(`${key} = ?`); params.push(known[key]) }
  }
  if (known.tags !== undefined) { sets.push("tags = ?"); params.push(JSON.stringify(known.tags)) }
  // Merge custom_data: existing custom fields + new ones
  if (Object.keys(custom).length > 0) {
    const existingCustom = JSON.parse((db.prepare("SELECT custom_data FROM contacts WHERE id = ?").get(id) as any)?.custom_data || "{}")
    sets.push("custom_data = ?")
    params.push(JSON.stringify({ ...existingCustom, ...custom }))
  }
  if (sets.length === 0) return existing
  sets.push("updated_at = ?"); params.push(now())
  params.push(id)
  db.prepare(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return getContact(id)
}

export function deleteContact(id: string) {
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id)
}

// ── Content Pieces ───────────────────────────────────────────

export function listContentPieces(filter?: { platform?: string; form?: string; status?: string; q?: string }) {
  let sql = "SELECT * FROM content_pieces WHERE 1=1"
  const params: any[] = []
  if (filter?.platform) { sql += " AND platform = ?"; params.push(filter.platform) }
  if (filter?.form) { sql += " AND form = ?"; params.push(filter.form) }
  if (filter?.status) { sql += " AND status = ?"; params.push(filter.status) }
  if (filter?.q) {
    sql += " AND title LIKE ?"
    params.push(`%${filter.q}%`)
  }
  sql += " ORDER BY updated_at DESC"
  return db.prepare(sql).all(...params).map(mapContentPiece)
}

export function getContentPiece(id: string) {
  return mapContentPiece(db.prepare("SELECT * FROM content_pieces WHERE id = ?").get(id))
}

export function createContentPiece(data: Record<string, any>) {
  const { known, custom } = splitKnownCustom(data, CONTENT_PIECE_COLUMNS)
  const c = {
    id: id(), title: known.title || "", platform: known.platform || "",
    form: known.form || "", status: known.status || "选题中",
    published_at: known.published_at || "", topic_source: known.topic_source || "",
    doc_id: known.doc_id || "",
    views: known.views || 0, likes: known.likes || 0,
    comments: known.comments || 0, shares: known.shares || 0,
    tags: JSON.stringify(known.tags || []),
    custom_data: JSON.stringify(custom),
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO content_pieces (id,title,platform,form,status,published_at,topic_source,doc_id,views,likes,comments,shares,tags,custom_data,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(c.id, c.title, c.platform, c.form, c.status, c.published_at, c.topic_source, c.doc_id, c.views, c.likes, c.comments, c.shares, c.tags, c.custom_data, c.created_at, c.updated_at)
  return getContentPiece(c.id)
}

export function updateContentPiece(id: string, data: Record<string, any>) {
  const existing = getContentPiece(id)
  if (!existing) return null
  const { known, custom } = splitKnownCustom(data, CONTENT_PIECE_COLUMNS)
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["title", "platform", "form", "status", "published_at", "topic_source", "doc_id"]) {
    if (known[key] !== undefined) { sets.push(`${key} = ?`); params.push(known[key]) }
  }
  for (const key of ["views", "likes", "comments", "shares"]) {
    if (known[key] !== undefined) { sets.push(`${key} = ?`); params.push(Number(known[key])) }
  }
  if (known.tags !== undefined) { sets.push("tags = ?"); params.push(JSON.stringify(known.tags)) }
  if (Object.keys(custom).length > 0) {
    const existingCustom = JSON.parse((db.prepare("SELECT custom_data FROM content_pieces WHERE id = ?").get(id) as any)?.custom_data || "{}")
    sets.push("custom_data = ?")
    params.push(JSON.stringify({ ...existingCustom, ...custom }))
  }
  if (sets.length === 0) return existing
  sets.push("updated_at = ?"); params.push(now())
  params.push(id)
  db.prepare(`UPDATE content_pieces SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return getContentPiece(id)
}

export function deleteContentPiece(id: string) {
  db.prepare("DELETE FROM content_pieces WHERE id = ?").run(id)
}

export function seedContentPieces() {
  const count = (db.prepare("SELECT count(*) as c FROM content_pieces").get() as any).c
  if (count > 0) return 0

  const mockItems = [
    // 国内平台
    { title: "AI工具选型指南：中小企业如何避坑", platform: "公众号", form: "文章", status: "已发布", published_at: "2026-05-20", views: 2340, likes: 89, comments: 23, shares: 45, topic_source: "选题池" },
    { title: "制造厂用AI报价，效率提升3倍", platform: "小红书", form: "图文", status: "已发布", published_at: "2026-05-18", views: 8900, likes: 312, comments: 67, shares: 128, topic_source: "选题池" },
    { title: "30家企业AI内训真相调查", platform: "公众号", form: "文章", status: "草稿", topic_source: "选题池" },
    { title: "AI写文案prompt模板大全", platform: "抖音", form: "口播稿", status: "拍摄中", topic_source: "选题池" },
    { title: "制造业AI提效案例分享", platform: "视频号", form: "图文", status: "选题中", topic_source: "客户反馈" },
    { title: "周末测评5款AI办公工具", platform: "朋友圈", form: "图文", status: "已发布", published_at: "2026-05-15", views: 560, likes: 34, comments: 12, shares: 8, topic_source: "日常" },
    { title: "行业观点：别等了，AI不会等你", platform: "知识星球", form: "文章", status: "已发布", published_at: "2026-05-12", views: 1200, likes: 56, comments: 18, shares: 22, topic_source: "行业观察" },
    // 海外平台
    { title: "How SMEs Can Leverage AI Tools in 2026", platform: "YouTube", form: "Talk", status: "已发布", published_at: "2026-05-22", views: 15600, likes: 890, comments: 134, shares: 267, topic_source: "海外选题" },
    { title: "AI Automation for Small Business - Full Guide", platform: "YouTube", form: "Talk", status: "已发布", published_at: "2026-05-10", views: 32400, likes: 1820, comments: 256, shares: 534, topic_source: "海外选题" },
    { title: "Just shipped our AI workflow tool for SMEs 🚀", platform: "Twitter", form: "图文", status: "已发布", published_at: "2026-05-24", views: 28900, likes: 456, comments: 38, shares: 128, topic_source: "产品推广" },
    { title: "AI tools comparison thread 🧵", platform: "Twitter", form: "图文", status: "已发布", published_at: "2026-05-19", views: 45000, likes: 1120, comments: 89, shares: 340, topic_source: "海外选题" },
    { title: "Behind the scenes: Building AI solutions for manufacturing", platform: "Instagram", form: "图文", status: "已发布", published_at: "2026-05-21", views: 8700, likes: 620, comments: 45, shares: 89, topic_source: "品牌建设" },
    { title: "5 AI tools every entrepreneur needs", platform: "Instagram", form: "图文", status: "草稿", topic_source: "海外选题" },
    // 跨境电商
    { title: "AI Training Toolkit - Enterprise Edition", platform: "Amazon", form: "文章", status: "已发布", published_at: "2026-05-16", views: 340, likes: 28, comments: 5, shares: 12, topic_source: "产品上架" },
    { title: "AI Prompt Engineering Guide (English Edition)", platform: "Amazon", form: "文章", status: "待发布", topic_source: "产品上架" },
    { title: "Day 1: 从0开始做TikTok AI内容", platform: "TikTok", form: "口播稿", status: "已发布", published_at: "2026-05-23", views: 128000, likes: 5600, comments: 342, shares: 1200, topic_source: "跨境选题" },
    { title: "AI makes this $0 to $10K challenge easy", platform: "TikTok", form: "口播稿", status: "拍摄中", topic_source: "跨境选题" },
    { title: "AI SaaS Dashboard Template Launch", platform: "Shopify", form: "文章", status: "已发布", published_at: "2026-05-14", views: 180, likes: 12, comments: 3, shares: 5, topic_source: "产品推广" },
  ]

  for (const item of mockItems) {
    createContentPiece(item)
  }
  return mockItems.length
}

export function getContentPieceStats() {
  const total = (db.prepare("SELECT count(*) as c FROM content_pieces").get() as any).c
  const published = (db.prepare("SELECT count(*) as c FROM content_pieces WHERE status = '已发布'").get() as any).c
  const byPlatform = db.prepare("SELECT platform, count(*) as c FROM content_pieces WHERE platform != '' GROUP BY platform").all() as any[]
  const byStatus = db.prepare("SELECT status, count(*) as c FROM content_pieces GROUP BY status").all() as any[]
  const byForm = db.prepare("SELECT form, count(*) as c FROM content_pieces WHERE form != '' GROUP BY form").all() as any[]
  const views = db.prepare("SELECT COALESCE(SUM(views),0) as s, COALESCE(AVG(views),0) as a FROM content_pieces WHERE status = '已发布'").get() as any
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const thisWeek = (db.prepare("SELECT count(*) as c FROM content_pieces WHERE published_at >= ?").get(weekAgo) as any).c
  return {
    total, published, thisWeek,
    byPlatform: Object.fromEntries(byPlatform.map(r => [r.platform, r.c])),
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.c])),
    byForm: Object.fromEntries(byForm.map(r => [r.form, r.c])),
    totalViews: Number(views.s), avgViews: Math.round(Number(views.a)),
  }
}

// ── Transactions ────────────────────────────────────────────

export function listTransactions(filter?: { type?: string; month?: string; category?: string; product_type?: string }) {
  let sql = "SELECT * FROM transactions WHERE 1=1"
  const params: any[] = []
  if (filter?.type) { sql += " AND type = ?"; params.push(filter.type) }
  if (filter?.month) { sql += " AND date LIKE ?"; params.push(`${filter.month}%`) }
  if (filter?.category) { sql += " AND category = ?"; params.push(filter.category) }
  if (filter?.product_type) { sql += " AND product_type = ?"; params.push(filter.product_type) }
  sql += " ORDER BY date DESC"
  return db.prepare(sql).all(...params).map(mapTransaction)
}

export function createTransaction(data: Partial<any>) {
  const { known, custom } = splitKnownCustom(data, TRANSACTION_COLUMNS)
  const t = {
    id: id(), contact_id: known.contact_id || null, type: known.type, amount: known.amount,
    description: known.description || "", invoice_status: known.invoice_status || "none",
    date: known.date || now().slice(0, 10),
    category: known.category || "", subcategory: known.subcategory || "",
    invoice_number: known.invoice_number || "", tax_amount: known.tax_amount || 0,
    quote: known.quote || 0, product_type: known.product_type || "",
    progress: known.progress || "", payment_status: known.payment_status || "",
    payment_channel: known.payment_channel || "", channel_id: known.channel_id || "",
    custom_data: JSON.stringify(custom),
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO transactions (id,contact_id,type,amount,description,invoice_status,date,category,subcategory,invoice_number,tax_amount,quote,product_type,progress,payment_status,payment_channel,channel_id,custom_data,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t.id, t.contact_id, t.type, t.amount, t.description, t.invoice_status, t.date, t.category, t.subcategory, t.invoice_number, t.tax_amount, t.quote, t.product_type, t.progress, t.payment_status, t.payment_channel, t.channel_id, t.custom_data, t.created_at, t.updated_at)
  return t
}

export function updateTransaction(id: string, data: Partial<any>) {
  const { known, custom } = splitKnownCustom(data, TRANSACTION_COLUMNS)
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["type", "amount", "description", "invoice_status", "date", "contact_id", "category", "subcategory", "invoice_number", "tax_amount", "quote", "product_type", "progress", "payment_status", "payment_channel", "channel_id"]) {
    if (known[key] !== undefined) { sets.push(`${key} = ?`); params.push(known[key]) }
  }
  if (Object.keys(custom).length > 0) {
    const existingCustom = JSON.parse((db.prepare("SELECT custom_data FROM transactions WHERE id = ?").get(id) as any)?.custom_data || "{}")
    sets.push("custom_data = ?")
    params.push(JSON.stringify({ ...existingCustom, ...custom }))
  }
  if (sets.length === 0) return null
  sets.push("updated_at = ?"); params.push(now())
  params.push(id)
  db.prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as any
}

export function deleteTransaction(id: string) {
  db.prepare("DELETE FROM transactions WHERE id = ?").run(id)
}

// ── Revenue aggregation ─────────────────────────────────────

export function getMonthlyRevenue(months: number = 6) {
  return db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
    FROM transactions
    GROUP BY month ORDER BY month DESC LIMIT ?
  `).all(months).reverse().map((r: any) => ({ ...r, income: Number(r.income), expense: Number(r.expense) }))
}

// ── Projects ────────────────────────────────────────────────

export function listProjects(status?: string) {
  if (status) return db.prepare("SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC").all(status)
  return db.prepare("SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC").all()
}

export function createProject(data: Partial<any>) {
  const p = {
    id: id(), name: data.name || "", description: data.description || "", status: "active",
    contact_id: data.contact_id || null, budget: data.budget || 0, team: data.team || "",
    start_date: data.start_date || null, deadline: data.deadline || null,
    created_at: now(), updated_at: now(),
  }
  db.prepare("INSERT INTO projects (id,name,description,status,contact_id,budget,team,start_date,deadline,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(p.id, p.name, p.description, p.status, p.contact_id, p.budget, p.team, p.start_date, p.deadline, p.created_at, p.updated_at)
  return p
}

export function updateProject(id: string, data: Partial<any>) {
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["name", "description", "status", "contact_id", "budget", "team", "start_date", "deadline"]) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); params.push(data[key]) }
  }
  if (sets.length === 0) return null
  sets.push("updated_at = ?"); params.push(now()); params.push(id)
  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id)
}

export function deleteProject(id: string) {
  db.prepare("DELETE FROM tasks WHERE project_id = ?").run(id)
  db.prepare("DELETE FROM projects WHERE id = ?").run(id)
}

// ── Tasks ───────────────────────────────────────────────────

export function listTasks(projectId?: string) {
  if (projectId) return db.prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY status, sort_order").all(projectId)
  return db.prepare("SELECT * FROM tasks ORDER BY project_id, status, sort_order").all()
}

export function createTask(data: Partial<any>) {
  const t = {
    id: id(), project_id: data.project_id, title: data.title || "", description: data.description || "",
    priority: data.priority || "medium", status: data.status || "todo", assignee: data.assignee || "",
    due_date: data.due_date || null, estimated_hours: data.estimated_hours || 0,
    sort_order: data.sort_order ?? db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM tasks WHERE project_id = ? AND status = ?").get(data.project_id, data.status || "todo").n,
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO tasks (id,project_id,title,description,priority,status,assignee,due_date,estimated_hours,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(t.id, t.project_id, t.title, t.description, t.priority, t.status, t.assignee, t.due_date, t.estimated_hours, t.sort_order, t.created_at, t.updated_at)
  return t
}

export function updateTask(id: string, data: Partial<any>) {
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["title", "description", "priority", "status", "assignee", "due_date", "sort_order", "project_id", "estimated_hours", "actual_hours"]) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); params.push(data[key]) }
  }
  if (sets.length === 0) return null
  sets.push("updated_at = ?"); params.push(now()); params.push(id)
  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id)
}

export function deleteTask(id: string) {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id)
}

export function moveTask(id: string, status: string, sortOrder?: number) {
  const so = sortOrder ?? db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM tasks WHERE status = ?").get(status).n
  db.prepare("UPDATE tasks SET status = ?, sort_order = ?, updated_at = ? WHERE id = ?").run(status, so, now(), id)
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id)
}

// ── Follow-ups ──────────────────────────────────────────────

export function listFollowUps(filter?: { contact_id?: string; status?: string; date_from?: string; date_to?: string }) {
  let sql = "SELECT * FROM follow_ups WHERE 1=1"
  const params: any[] = []
  if (filter?.contact_id) { sql += " AND contact_id = ?"; params.push(filter.contact_id) }
  if (filter?.status) { sql += " AND status = ?"; params.push(filter.status) }
  if (filter?.date_from) { sql += " AND date >= ?"; params.push(filter.date_from) }
  if (filter?.date_to) { sql += " AND date <= ?"; params.push(filter.date_to) }
  sql += " ORDER BY date DESC"
  return db.prepare(sql).all(...params)
}

export function getFollowUp(id: string) {
  return db.prepare("SELECT * FROM follow_ups WHERE id = ?").get(id)
}

export function createFollowUp(data: Partial<any>) {
  const f = {
    id: id(), contact_id: data.contact_id, date: data.date || now().slice(0, 10),
    method: data.method || "", content: data.content || "", next_step: data.next_step || "",
    status: data.status || "待跟进",
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO follow_ups (id,contact_id,date,method,content,next_step,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(f.id, f.contact_id, f.date, f.method, f.content, f.next_step, f.status, f.created_at, f.updated_at)
  return f
}

export function updateFollowUp(id: string, data: Partial<any>) {
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["date", "method", "content", "next_step", "status"]) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); params.push(data[key]) }
  }
  if (sets.length === 0) return null
  sets.push("updated_at = ?"); params.push(now()); params.push(id)
  db.prepare(`UPDATE follow_ups SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return db.prepare("SELECT * FROM follow_ups WHERE id = ?").get(id)
}

export function deleteFollowUp(id: string) {
  db.prepare("DELETE FROM follow_ups WHERE id = ?").run(id)
}

export function getFollowUpReminders() {
  const today = now().slice(0, 10)
  return db.prepare(`
    SELECT f.*, c.name as contact_name
    FROM follow_ups f
    JOIN contacts c ON c.id = f.contact_id
    WHERE f.status = '待跟进' AND f.date <= ?
    ORDER BY f.date ASC
  `).all(today)
}

// ── Channels ────────────────────────────────────────────────

export function listChannels(filter?: { status?: string; rating?: string; is_public?: number }) {
  let sql = `SELECT ch.*,
    COALESCE(ref.cnt, 0) as total_customers,
    COALESCE(ref.rev, 0) as total_revenue
    FROM channels ch
    LEFT JOIN (SELECT channel_id, count(*) as cnt, SUM(deal_amount) as rev FROM channel_referrals GROUP BY channel_id) ref ON ref.channel_id = ch.id
    WHERE 1=1`
  const params: any[] = []
  if (filter?.status) { sql += " AND ch.status = ?"; params.push(filter.status) }
  if (filter?.rating) { sql += " AND ch.rating = ?"; params.push(filter.rating) }
  if (filter?.is_public !== undefined) { sql += " AND ch.is_public = ?"; params.push(filter.is_public) }
  sql += " ORDER BY ch.updated_at DESC"
  return db.prepare(sql).all(...params).map(mapChannel)
}

export function getChannel(id: string) {
  return mapChannel(db.prepare(`
    SELECT ch.*,
    COALESCE(ref.cnt, 0) as total_customers,
    COALESCE(ref.rev, 0) as total_revenue
    FROM channels ch
    LEFT JOIN (SELECT channel_id, count(*) as cnt, SUM(deal_amount) as rev FROM channel_referrals GROUP BY channel_id) ref ON ref.channel_id = ch.id
    WHERE ch.id = ?
  `).get(id))
}

export function createChannel(data: Partial<any>) {
  const { known, custom } = splitKnownCustom(data, CHANNEL_COLUMNS)
  const ch = {
    id: id(), name: known.name || "", contact_person: known.contact_person || "",
    wechat: known.wechat || "", phone: known.phone || "",
    company_type: known.company_type || "", company_name: known.company_name || "",
    cooperation_mode: known.cooperation_mode || "", commission_rate: known.commission_rate || "",
    settlement_method: known.settlement_method || "", status: known.status || "活跃",
    rating: known.rating || "潜力", total_customers: known.total_customers || 0,
    total_revenue: known.total_revenue || 0, main_products: known.main_products || "",
    last_brought_customer_at: known.last_brought_customer_at || null,
    is_public: known.is_public || 0, account_name: known.account_name || "",
    platform_id: known.platform_id || "", followers: known.followers || 0,
    remark: known.remark || "",
    custom_data: JSON.stringify(custom),
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO channels (id,name,contact_person,wechat,phone,company_type,company_name,cooperation_mode,commission_rate,settlement_method,status,rating,total_customers,total_revenue,main_products,last_brought_customer_at,is_public,account_name,platform_id,followers,remark,custom_data,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(ch.id, ch.name, ch.contact_person, ch.wechat, ch.phone, ch.company_type, ch.company_name, ch.cooperation_mode, ch.commission_rate, ch.settlement_method, ch.status, ch.rating, ch.total_customers, ch.total_revenue, ch.main_products, ch.last_brought_customer_at, ch.is_public, ch.account_name, ch.platform_id, ch.followers, ch.remark, ch.custom_data, ch.created_at, ch.updated_at)
  return getChannel(ch.id)
}

export function updateChannel(id: string, data: Partial<any>) {
  const { known, custom } = splitKnownCustom(data, CHANNEL_COLUMNS)
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["name", "contact_person", "wechat", "phone", "company_type", "company_name", "cooperation_mode", "commission_rate", "settlement_method", "status", "rating", "total_customers", "total_revenue", "main_products", "last_brought_customer_at", "is_public", "account_name", "platform_id", "followers", "remark"]) {
    if (known[key] !== undefined) { sets.push(`${key} = ?`); params.push(known[key]) }
  }
  if (Object.keys(custom).length > 0) {
    const existingCustom = JSON.parse((db.prepare("SELECT custom_data FROM channels WHERE id = ?").get(id) as any)?.custom_data || "{}")
    sets.push("custom_data = ?")
    params.push(JSON.stringify({ ...existingCustom, ...custom }))
  }
  if (sets.length === 0) return null
  sets.push("updated_at = ?"); params.push(now()); params.push(id)
  db.prepare(`UPDATE channels SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return getChannel(id)
}

export function deleteChannel(id: string) {
  db.prepare("DELETE FROM channel_referrals WHERE channel_id = ?").run(id)
  db.prepare("DELETE FROM channels WHERE id = ?").run(id)
}

export function getChannelStats() {
  const total = (db.prepare("SELECT count(*) as c FROM channels").get() as any).c
  const active = (db.prepare("SELECT count(*) as c FROM channels WHERE status = '活跃'").get() as any).c
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_revenue),0) as s FROM channels").get() as any
  const totalCustomers = db.prepare("SELECT COALESCE(SUM(total_customers),0) as s FROM channels").get() as any
  const byRating = db.prepare("SELECT rating, count(*) as c FROM channels GROUP BY rating").all() as any[]
  const byType = db.prepare("SELECT company_type, count(*) as c FROM channels WHERE company_type != '' GROUP BY company_type").all() as any[]
  return {
    total, active, totalRevenue: Number(totalRevenue.s), totalCustomers: Number(totalCustomers.s),
    byRating: Object.fromEntries(byRating.map(r => [r.rating, r.c])),
    byType: Object.fromEntries(byType.map(r => [r.company_type, r.c])),
  }
}

// ── Channel referrals ───────────────────────────────────────

export function listChannelReferrals(channelId: string) {
  return db.prepare(
    "SELECT r.*, c.name as contact_name FROM channel_referrals r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.channel_id = ? ORDER BY r.date DESC"
  ).all(channelId)
}

export function listContactChannels(contactId: string) {
  return db.prepare(
    "SELECT r.*, ch.name as channel_name, ch.rating as channel_rating FROM channel_referrals r LEFT JOIN channels ch ON ch.id = r.channel_id WHERE r.contact_id = ? ORDER BY r.date DESC"
  ).all(contactId)
}

export function createChannelReferral(data: Partial<any>) {
  const r = {
    id: id(), channel_id: data.channel_id, contact_id: data.contact_id || null,
    product_type: data.product_type || "", deal_amount: data.deal_amount || 0,
    date: data.date || now().slice(0, 10),
  }
  db.prepare("INSERT INTO channel_referrals (id,channel_id,contact_id,product_type,deal_amount,date) VALUES (?,?,?,?,?,?)")
    .run(r.id, r.channel_id, r.contact_id, r.product_type, r.deal_amount, r.date)
  if (r.deal_amount > 0) {
    db.prepare("UPDATE channels SET total_customers = total_customers + 1, total_revenue = total_revenue + ?, last_brought_customer_at = ? WHERE id = ?")
      .run(r.deal_amount, r.date, r.channel_id)
  }
  return r
}

// ── Analytics ───────────────────────────────────────────────

export function getContactStats() {
  const total = (db.prepare("SELECT count(*) as c FROM contacts").get() as any).c
  const active = (db.prepare("SELECT count(*) as c FROM contacts WHERE status = 'active'").get() as any).c
  const potential = (db.prepare("SELECT count(*) as c FROM contacts WHERE status = 'potential'").get() as any).c
  const revenue = db.prepare("SELECT COALESCE(SUM(deal),0) as s FROM contacts").get() as any
  const byStage = db.prepare("SELECT stage, count(*) as c FROM contacts GROUP BY stage").all() as any[]
  const byLevel = db.prepare("SELECT level, count(*) as c FROM contacts WHERE level != '' GROUP BY level").all() as any[]
  const followUpsDue = (db.prepare("SELECT count(*) as c FROM follow_ups WHERE status = '待跟进' AND date <= ?").get(now().slice(0, 10)) as any).c
  const byProjectType = db.prepare("SELECT project_type, count(*) as c FROM contacts WHERE project_type != '' GROUP BY project_type").all() as any[]
  return {
    total, active, potential, totalDeal: Number(revenue.s),
    byStage: Object.fromEntries(byStage.map(r => [r.stage, r.c])),
    byLevel: Object.fromEntries(byLevel.map(r => [r.level, r.c])),
    followUpsDue,
    byProjectType: Object.fromEntries(byProjectType.map(r => [r.project_type, r.c])),
  }
}

export function getFinanceStats() {
  const income = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE type = 'income'").get() as any
  const expense = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE type = 'expense'").get() as any
  const pending = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE invoice_status = 'pending'").get() as any
  const overdue = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE invoice_status = 'overdue'").get() as any
  const channelRevenue = db.prepare("SELECT COALESCE(SUM(total_revenue),0) as s FROM channels").get() as any
  const byProductType = db.prepare("SELECT product_type, COALESCE(SUM(amount),0) as s FROM transactions WHERE type = 'income' AND product_type != '' GROUP BY product_type").all() as any[]
  return {
    totalIncome: Number(income.s), totalExpense: Number(expense.s),
    net: Number(income.s) - Number(expense.s),
    pendingInvoice: Number(pending.s), overdueInvoice: Number(overdue.s),
    channelRevenue: Number(channelRevenue.s),
    byProductType: Object.fromEntries(byProductType.map(r => [r.product_type, Number(r.s)])),
  }
}

// ── Content Composite Functions ─────────────────────────────

export function contentPublish(idOrTitle: string) {
  // Find by ID or title
  let piece = getContentPiece(idOrTitle)
  if (!piece) {
    const list = listContentPieces({ q: idOrTitle })
    piece = list.length > 0 ? list[0] : null
  }
  if (!piece) throw new Error(`内容不存在: ${idOrTitle}`)

  const updated = updateContentPiece(piece.id, {
    status: "已发布",
    published_at: now().slice(0, 10),
  })
  return { piece: updated, stats: getContentPieceStats() }
}

export function contentUpdateMetrics(idOrTitle: string, metrics: { views?: number; likes?: number; comments?: number; shares?: number }) {
  let piece = getContentPiece(idOrTitle)
  if (!piece) {
    const list = listContentPieces({ q: idOrTitle })
    piece = list.length > 0 ? list[0] : null
  }
  if (!piece) throw new Error(`内容不存在: ${idOrTitle}`)

  const updated = updateContentPiece(piece.id, metrics)
  return { piece: updated, stats: getContentPieceStats() }
}

export function contentCheckDaily() {
  const today = now().slice(0, 10)
  const stats = getContentPieceStats()
  const published = listContentPieces({ status: "已发布" })
  const todayPublished = published.filter((p: any) => p.published_at === today)

  // Check daily targets
  const targets: Record<string, number> = { "公众号": 1, "小红书": 1, "知识星球": 1 }
  const results: Record<string, { target: number; actual: number; met: boolean }> = {}
  for (const [platform, target] of Object.entries(targets)) {
    const actual = todayPublished.filter((p: any) => p.platform === platform).length
    results[platform] = { target, actual, met: actual >= target }
  }

  return { date: today, stats, todayPublished, dailyCheck: results }
}

// ── Getbiji Stubs ────────────────────────────────────────────

const getbijiState = { lastSync: "", status: "未连接", totalNotes: 0 }

export function getbijiSync() {
  // TODO: integrate with actual getbiji API
  getbijiState.lastSync = now()
  getbijiState.status = "已同步（占位）"
  return { ...getbijiState, message: "getbiji 同步功能待接入，当前为占位返回" }
}

export function getbijiStatus() {
  return getbijiState
}

export function getbijiForceFull() {
  getbijiState.lastSync = now()
  getbijiState.status = "全量同步（占位）"
  return { ...getbijiState, message: "getbiji 全量同步功能待接入，当前为占位返回" }
}

// ── CRM Composite Functions ─────────────────────────────────

export function crmGetClient(nameOrId: string) {
  // Try by ID first, then by name
  let contact = getContact(nameOrId)
  if (!contact) {
    const byName = listContacts({ q: nameOrId })
    contact = byName.length > 0 ? byName[0] : null
  }
  if (!contact) return null
  // Attach follow-ups
  const followUps = listFollowUps({ contact_id: contact.id })
  return { ...contact, follow_ups: followUps }
}

export function crmAddClient(data: Record<string, any>) {
  const contact = createContact(data)
  // If channel specified, create referral link
  if (data.channel && contact) {
    const channels = listChannels()
    const ch = channels.find((c: any) => c.name === data.channel || c.id === data.channel)
    if (ch) {
      createChannelReferral({ channel_id: ch.id, contact_id: contact.id, product_type: data.project_type || "", date: now().slice(0, 10) })
    }
  }
  return contact
}

export function crmAddFollowup(contactNameOrId: string, data: { method?: string; content: string; next_step?: string; date?: string }) {
  const contact = crmGetClient(contactNameOrId)
  if (!contact) throw new Error(`客户不存在: ${contactNameOrId}`)

  // 1. Create follow-up record
  const followUp = createFollowUp({
    contact_id: contact.id,
    date: data.date || now().slice(0, 10),
    method: data.method || "微信",
    content: data.content,
    next_step: data.next_step || "",
    status: "已跟进",
  })

  // 2. Update contact's next_follow_up if next_step provided
  if (data.next_step) {
    updateContact(contact.id, { next_follow_up: data.next_step })
  }

  // 3. Auto-advance stage if appropriate
  const stageOrder = ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交"]
  const currentIdx = stageOrder.indexOf(contact.stage)
  if (contact.stage === "新线索" && currentIdx >= 0) {
    updateContact(contact.id, { stage: "跟进中" })
  }

  return { follow_up: followUp, contact: crmGetClient(contact.id) }
}

export function crmUpdateStage(contactNameOrId: string, stage: string) {
  const contact = crmGetClient(contactNameOrId)
  if (!contact) throw new Error(`客户不存在: ${contactNameOrId}`)

  const updated = updateContact(contact.id, { stage })
  return { contact: updated, pipeline: getContactStats() }
}

export function crmRecordDeal(contactNameOrId: string, data: { amount: number; description?: string; product_type?: string; payment_status?: string }) {
  const contact = crmGetClient(contactNameOrId)
  if (!contact) throw new Error(`客户不存在: ${contactNameOrId}`)

  // 1. Create transaction
  const tx = createTransaction({
    contact_id: contact.id,
    type: "income",
    amount: data.amount,
    description: data.description || `${contact.name} 成交`,
    date: now().slice(0, 10),
    product_type: data.product_type || "",
    payment_status: data.payment_status || "未回款",
  })

  // 2. Update contact stage + deal
  updateContact(contact.id, { stage: "已成交", deal: (contact.deal || 0) + data.amount })

  return { transaction: tx, contact: crmGetClient(contact.id) }
}

export function crmListOverdue() {
  const today = now().slice(0, 10)
  return getFollowUpReminders()
}

export function crmGetPipeline() {
  const stats = getContactStats()
  const finance = getFinanceStats()
  const byStage = stats.byStage || {}
  const stages = ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交", "已流失"]
  const pipeline = stages.map((s) => ({ stage: s, count: byStage[s] || 0 }))
  return {
    pipeline,
    totalContacts: stats.total,
    activeContacts: stats.active,
    totalDeal: stats.totalDeal,
    totalIncome: finance.totalIncome,
    followUpsDue: stats.followUpsDue,
  }
}

export function crmSearch(query: string) {
  return listContacts({ q: query })
}

export function getProjectStats() {
  const total = (db.prepare("SELECT count(*) as c FROM projects WHERE status = 'active'").get() as any).c
  const todo = (db.prepare("SELECT count(*) as c FROM tasks WHERE status = 'todo'").get() as any).c
  const doing = (db.prepare("SELECT count(*) as c FROM tasks WHERE status = 'doing'").get() as any).c
  const done = (db.prepare("SELECT count(*) as c FROM tasks WHERE status = 'done'").get() as any).c
  return { totalProjects: total, todoTasks: todo, doingTasks: doing, doneTasks: done }
}

// ── Audit logs ───────────────────────────────────────────────

type AuditLogInput = {
  actor_type?: string
  actor_id?: string
  source?: string
  action: string
  entity: string
  entity_id?: string
  payload?: unknown
  payload_hash?: string
  summary?: string
}

export function createAuditLog(data: AuditLogInput) {
  const row = {
    id: id(),
    actor_type: data.actor_type || "unknown",
    actor_id: data.actor_id || "unknown",
    source: data.source || "",
    action: data.action,
    entity: data.entity,
    entity_id: data.entity_id || "",
    payload_hash: data.payload_hash || hashPayload(data.payload),
    summary: data.summary || "",
    created_at: now(),
  }

  db.prepare(`INSERT INTO audit_logs (id,actor_type,actor_id,source,action,entity,entity_id,payload_hash,summary,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.actor_type, row.actor_id, row.source, row.action, row.entity, row.entity_id, row.payload_hash, row.summary, row.created_at)
  return row
}

export function listAuditLogs(filter?: { entity?: string; entity_id?: string; actor_id?: string; limit?: number }) {
  let sql = "SELECT * FROM audit_logs WHERE 1=1"
  const params: any[] = []
  if (filter?.entity) { sql += " AND entity = ?"; params.push(filter.entity) }
  if (filter?.entity_id) { sql += " AND entity_id = ?"; params.push(filter.entity_id) }
  if (filter?.actor_id) { sql += " AND actor_id = ?"; params.push(filter.actor_id) }
  const limit = Math.max(1, Math.min(Number(filter?.limit || 100), 500))
  sql += " ORDER BY created_at DESC LIMIT ?"
  params.push(limit)
  return db.prepare(sql).all(...params)
}

// ── Identity / actor tokens ─────────────────────────────────

export function createTeamMember(data: { name: string; actor_type?: string; role?: string; status?: string }) {
  const row = {
    id: id(),
    name: data.name,
    actor_type: data.actor_type || "human",
    role: data.role || "member",
    status: data.status || "active",
    created_at: now(),
    updated_at: now(),
  }
  db.prepare("INSERT INTO team_members (id,name,actor_type,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .run(row.id, row.name, row.actor_type, row.role, row.status, row.created_at, row.updated_at)
  return row
}

export function listTeamMembers() {
  return db.prepare("SELECT * FROM team_members ORDER BY created_at DESC").all()
}

export function getTeamMember(id: string) {
  return db.prepare("SELECT * FROM team_members WHERE id = ?").get(id) as any
}

export function updateTeamMember(id: string, data: Partial<{ name: string; actor_type: string; role: string; status: string }>) {
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["name", "actor_type", "role", "status"]) {
    if ((data as any)[key] !== undefined) { sets.push(`${key} = ?`); params.push((data as any)[key]) }
  }
  if (sets.length === 0) return getTeamMember(id)
  sets.push("updated_at = ?"); params.push(now()); params.push(id)
  db.prepare(`UPDATE team_members SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return getTeamMember(id)
}

export function deleteTeamMember(id: string) {
  db.prepare("DELETE FROM team_members WHERE id = ?").run(id)
}

export function createActorToken(data: { member_id: string; label?: string; token_type?: string }) {
  const member = getTeamMember(data.member_id)
  if (!member) throw new Error(`成员不存在: ${data.member_id}`)

  const tokenType = data.token_type === "agent" || member.actor_type === "agent" ? "agent" : "api"
  const token = `czr_${tokenType}_${randomBytes(24).toString("base64url")}`
  const row = {
    id: id(),
    member_id: data.member_id,
    token_hash: hashToken(token),
    token_prefix: tokenPrefix(token),
    label: data.label || "",
    token_type: tokenType,
    status: "active",
    last_used_at: null as string | null,
    created_at: now(),
    updated_at: now(),
  }
  db.prepare(`INSERT INTO actor_tokens (id,member_id,token_hash,token_prefix,label,token_type,status,last_used_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.member_id, row.token_hash, row.token_prefix, row.label, row.token_type, row.status, row.last_used_at, row.created_at, row.updated_at)
  return { ...sanitizeActorToken(row), token }
}

export function listActorTokens(filter?: { member_id?: string; status?: string }) {
  let sql = `SELECT t.id,t.member_id,t.token_prefix,t.label,t.token_type,t.status,t.last_used_at,t.created_at,t.updated_at,
    m.name as member_name,m.actor_type,m.role as member_role,m.status as member_status
    FROM actor_tokens t LEFT JOIN team_members m ON m.id = t.member_id WHERE 1=1`
  const params: any[] = []
  if (filter?.member_id) { sql += " AND t.member_id = ?"; params.push(filter.member_id) }
  if (filter?.status) { sql += " AND t.status = ?"; params.push(filter.status) }
  sql += " ORDER BY t.created_at DESC"
  return db.prepare(sql).all(...params)
}

export function revokeActorToken(id: string) {
  db.prepare("UPDATE actor_tokens SET status = 'revoked', updated_at = ? WHERE id = ?").run(now(), id)
  return db.prepare("SELECT id,member_id,token_prefix,label,token_type,status,last_used_at,created_at,updated_at FROM actor_tokens WHERE id = ?").get(id)
}

export function resolveActorToken(token: string) {
  if (!token) return null
  const tokenHash = hashToken(token.trim())
  const row = db.prepare(`SELECT t.id as token_id,t.member_id,t.token_prefix,t.label,t.token_type,t.status as token_status,
      m.name as actor_name,m.actor_type,m.role,m.status as member_status
    FROM actor_tokens t JOIN team_members m ON m.id = t.member_id
    WHERE t.token_hash = ?`).get(tokenHash) as any
  if (!row || row.token_status !== "active" || row.member_status !== "active") return null
  db.prepare("UPDATE actor_tokens SET last_used_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), row.token_id)
  return {
    actor_type: row.actor_type || (row.token_type === "agent" ? "agent" : "human"),
    actor_id: row.member_id,
    actor_name: row.actor_name,
    role: row.role,
    source: row.token_type === "agent" ? "agent-token" : "api-token",
    token_id: row.token_id,
    token_label: row.label,
  }
}

function sanitizeActorToken(row: any) {
  const safe = { ...row }
  delete safe.token_hash
  return safe
}

// ── Agent sessions analytics (Hermes-compatible state.db) ────

export function getHermesSessionStats() {
  try {
    const stateDbPath = resolve(HERMES_HOME, "state.db")
    const sdb = new Database(stateDbPath, { readonly: true })
    const today = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const todayCount = (sdb.prepare("SELECT count(*) as c FROM sessions WHERE started_at >= ?").get(today + "T00:00:00") as any).c
    const weekCount = (sdb.prepare("SELECT count(*) as c FROM sessions WHERE started_at >= ?").get(weekAgo) as any).c
    const toolCalls = (sdb.prepare("SELECT count(*) as c FROM messages WHERE tool_calls IS NOT NULL AND tool_calls != '' AND tool_calls != '[]'").get() as any).c
    const daily = sdb.prepare(`
      SELECT strftime('%m-%d', started_at) as date, count(*) as conversations
      FROM sessions WHERE started_at >= ? GROUP BY date ORDER BY date
    `).all(weekAgo)
    sdb.close()
    return { todayConversations: todayCount, weekConversations: weekCount, toolCalls, dailyTrend: daily }
  } catch {
    return { todayConversations: 0, weekConversations: 0, toolCalls: 0, dailyTrend: [] }
  }
}

// ── Exports for doc-tree service ─────────────────────────────

export { db, id, now }
