// Copyright (c) 2026 MeeJoy
// Crazor business data — SQLite via Bun built-in

import { Database } from "bun:sqlite"
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
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    type TEXT DEFAULT '微信',
    content TEXT NOT NULL,
    outcome TEXT DEFAULT '',
    next_step TEXT DEFAULT '',
    next_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
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

function mapContact(row: any) {
  if (!row) return null
  return { ...row, tags: JSON.parse(row.tags || "[]"), deal: Number(row.deal) }
}

// ── Contacts ────────────────────────────────────────────────

export function listContacts(filter?: { status?: string; q?: string; stage?: string; level?: string }) {
  let sql = "SELECT * FROM contacts WHERE 1=1"
  const params: any[] = []
  if (filter?.status) { sql += " AND status = ?"; params.push(filter.status) }
  if (filter?.stage) { sql += " AND stage = ?"; params.push(filter.stage) }
  if (filter?.level) { sql += " AND level = ?"; params.push(filter.level) }
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
  const c = {
    id: id(), name: data.name || "", company: data.company || "", role: data.role || "",
    phone: data.phone || "", email: data.email || "", status: data.status || "potential",
    deal: data.deal || 0, tags: JSON.stringify(data.tags || []),
    last_contacted_at: data.last_contacted_at || null,
    stage: data.stage || "新线索", source: data.source || "", level: data.level || "",
    wechat: data.wechat || "", remark: data.remark || "",
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO contacts (id,name,company,role,phone,email,status,deal,tags,last_contacted_at,stage,source,level,wechat,remark,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(c.id, c.name, c.company, c.role, c.phone, c.email, c.status, c.deal, c.tags, c.last_contacted_at, c.stage, c.source, c.level, c.wechat, c.remark, c.created_at, c.updated_at)
  return getContact(c.id)
}

export function updateContact(id: string, data: Partial<any>) {
  const existing = getContact(id)
  if (!existing) return null
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["name", "company", "role", "phone", "email", "status", "deal", "last_contacted_at", "stage", "source", "level", "wechat", "remark"]) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); params.push(data[key]) }
  }
  if (data.tags !== undefined) { sets.push("tags = ?"); params.push(JSON.stringify(data.tags)) }
  if (sets.length === 0) return existing
  sets.push("updated_at = ?"); params.push(now())
  params.push(id)
  db.prepare(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return getContact(id)
}

export function deleteContact(id: string) {
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id)
}

// ── Transactions ────────────────────────────────────────────

export function listTransactions(filter?: { type?: string; month?: string; category?: string }) {
  let sql = "SELECT * FROM transactions WHERE 1=1"
  const params: any[] = []
  if (filter?.type) { sql += " AND type = ?"; params.push(filter.type) }
  if (filter?.month) { sql += " AND date LIKE ?"; params.push(`${filter.month}%`) }
  if (filter?.category) { sql += " AND category = ?"; params.push(filter.category) }
  sql += " ORDER BY date DESC"
  return db.prepare(sql).all(...params).map((r: any) => ({ ...r, amount: Number(r.amount), tax_amount: Number(r.tax_amount || 0) }))
}

export function createTransaction(data: Partial<any>) {
  const t = {
    id: id(), contact_id: data.contact_id || null, type: data.type, amount: data.amount,
    description: data.description || "", invoice_status: data.invoice_status || "none",
    date: data.date || now().slice(0, 10),
    category: data.category || "", subcategory: data.subcategory || "",
    invoice_number: data.invoice_number || "", tax_amount: data.tax_amount || 0,
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO transactions (id,contact_id,type,amount,description,invoice_status,date,category,subcategory,invoice_number,tax_amount,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t.id, t.contact_id, t.type, t.amount, t.description, t.invoice_status, t.date, t.category, t.subcategory, t.invoice_number, t.tax_amount, t.created_at, t.updated_at)
  return t
}

export function updateTransaction(id: string, data: Partial<any>) {
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["type", "amount", "description", "invoice_status", "date", "contact_id", "category", "subcategory", "invoice_number", "tax_amount"]) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); params.push(data[key]) }
  }
  if (sets.length === 0) return null
  sets.push("updated_at = ?"); params.push(now())
  params.push(id)
  db.prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(id)
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
    sort_order: data.sort_order ?? (db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM tasks WHERE project_id = ? AND status = ?").get(data.project_id, data.status || "todo") as {n:number}).n,
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
  const so = sortOrder ?? (db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM tasks WHERE status = ?").get(status) as {n:number}).n
  db.prepare("UPDATE tasks SET status = ?, sort_order = ?, updated_at = ? WHERE id = ?").run(status, so, now(), id)
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id)
}

// ── Analytics ───────────────────────────────────────────────

export function getContactStats() {
  const total = (db.prepare("SELECT count(*) as c FROM contacts").get() as any).c
  const active = (db.prepare("SELECT count(*) as c FROM contacts WHERE status = 'active'").get() as any).c
  const potential = (db.prepare("SELECT count(*) as c FROM contacts WHERE status = 'potential'").get() as any).c
  const revenue = db.prepare("SELECT COALESCE(SUM(deal),0) as s FROM contacts").get() as any
  const byStage = db.prepare("SELECT stage, count(*) as c FROM contacts GROUP BY stage").all() as any[]
  const byLevel = db.prepare("SELECT level, count(*) as c FROM contacts WHERE level != '' GROUP BY level").all() as any[]
  return {
    total, active, potential, totalDeal: Number(revenue.s),
    byStage: Object.fromEntries(byStage.map(r => [r.stage, r.c])),
    byLevel: Object.fromEntries(byLevel.map(r => [r.level, r.c])),
  }
}

export function getFinanceStats() {
  const income = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE type = 'income'").get() as any
  const expense = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE type = 'expense'").get() as any
  const pending = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE invoice_status = 'pending'").get() as any
  const overdue = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE invoice_status = 'overdue'").get() as any
  return {
    totalIncome: Number(income.s), totalExpense: Number(expense.s),
    net: Number(income.s) - Number(expense.s),
    pendingInvoice: Number(pending.s), overdueInvoice: Number(overdue.s),
  }
}

export function getProjectStats() {
  const total = (db.prepare("SELECT count(*) as c FROM projects WHERE status = 'active'").get() as any).c
  const todo = (db.prepare("SELECT count(*) as c FROM tasks WHERE status = 'todo'").get() as any).c
  const doing = (db.prepare("SELECT count(*) as c FROM tasks WHERE status = 'doing'").get() as any).c
  const done = (db.prepare("SELECT count(*) as c FROM tasks WHERE status = 'done'").get() as any).c
  return { totalProjects: total, todoTasks: todo, doingTasks: doing, doneTasks: done }
}

// ── Hermes sessions analytics (read-only from state.db) ─────

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

// ── Follow-ups (跟进记录) ──────────────────────────────────

export function listFollowUps(filter?: { contact_id?: string; project_id?: string; status?: string }) {
  let sql = "SELECT f.*, c.name as contact_name FROM follow_ups f LEFT JOIN contacts c ON f.contact_id = c.id WHERE 1=1"
  const params: any[] = []
  if (filter?.contact_id) { sql += " AND f.contact_id = ?"; params.push(filter.contact_id) }
  if (filter?.project_id) { sql += " AND f.project_id = ?"; params.push(filter.project_id) }
  if (filter?.status) { sql += " AND f.status = ?"; params.push(filter.status) }
  sql += " ORDER BY f.created_at DESC"
  return db.prepare(sql).all(...params).map((r: any) => ({ ...r, next_date: r.next_date || null }))
}

export function getFollowUp(id: string) {
  return db.prepare(`
    SELECT f.*, c.name as contact_name FROM follow_ups f LEFT JOIN contacts c ON f.contact_id = c.id WHERE f.id = ?
  `).get(id)
}

export function createFollowUp(data: Partial<any>) {
  const f = {
    id: id(), contact_id: data.contact_id, project_id: data.project_id || null,
    type: data.type || "微信", content: data.content || "",
    outcome: data.outcome || "", next_step: data.next_step || "",
    next_date: data.next_date || null, status: data.status || "pending",
    created_at: now(), updated_at: now(),
  }
  db.prepare(`INSERT INTO follow_ups (id,contact_id,project_id,type,content,outcome,next_step,next_date,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(f.id, f.contact_id, f.project_id, f.type, f.content, f.outcome, f.next_step, f.next_date, f.status, f.created_at, f.updated_at)
  // Update contact's last_contacted_at
  if (f.contact_id) {
    db.prepare("UPDATE contacts SET last_contacted_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), f.contact_id)
  }
  return getFollowUp(f.id)
}

export function updateFollowUp(id: string, data: Partial<any>) {
  const existing = getFollowUp(id)
  if (!existing) return null
  const sets: string[] = []
  const params: any[] = []
  for (const key of ["contact_id", "project_id", "type", "content", "outcome", "next_step", "next_date", "status"]) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); params.push(data[key]) }
  }
  if (sets.length === 0) return existing
  sets.push("updated_at = ?"); params.push(now()); params.push(id)
  db.prepare(`UPDATE follow_ups SET ${sets.join(", ")} WHERE id = ?`).run(...params)
  return getFollowUp(id)
}

export function deleteFollowUp(id: string) {
  db.prepare("DELETE FROM follow_ups WHERE id = ?").run(id)
}

// ── Exports for doc-tree service ─────────────────────────────

export { db, id, now }
