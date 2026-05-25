// Copyright (c) 2026 MeeJoy
// Field definitions — dynamic schema metadata for Crazor entities

import { db } from "./crazor-db"

// ── ID & timestamp helpers ──────────────────────────────────
function id(): string {
  return "mpjwsf" + Math.random().toString(36).slice(2, 8)
    + "-" + Math.random().toString(36).slice(2, 8)
}
function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

// ── Seed data: maps entity → field definitions ──────────────
// Derived from existing CONTACT_COLUMNS / CHANNEL_COLUMNS / TRANSACTION_COLUMNS
// and the known field types used in configs.

interface FieldSeed {
  field_key: string
  label: string
  field_type: string
  options?: string
  visible?: number
  sortable?: number
  filterable?: number
  width?: number
  sort_order?: number
  section?: string
  render_hint?: string
  relation_entity?: string
}

const SEEDS: Record<string, FieldSeed[]> = {
  contacts: [
    { field_key: "name", label: "姓名", field_type: "text", required: 1, width: 120, sort_order: 0, render_hint: "title" },
    { field_key: "company", label: "公司", field_type: "text", width: 160, sort_order: 1 },
    { field_key: "role", label: "职位", field_type: "text", width: 100, sort_order: 2 },
    { field_key: "phone", label: "电话", field_type: "text", width: 120, sort_order: 3 },
    { field_key: "wechat", label: "微信", field_type: "text", width: 120, sort_order: 4, section: "联系方式" },
    { field_key: "email", label: "邮箱", field_type: "text", width: 160, sort_order: 5, section: "联系方式" },
    { field_key: "stage", label: "阶段", field_type: "select", width: 100, sort_order: 6, filterable: 1, render_hint: "kanban_lane",
      options: JSON.stringify([
        { value: "新线索", label: "新线索", color: "bg-slate-100 text-slate-700" },
        { value: "跟进中", label: "跟进中", color: "bg-blue-100 text-blue-700" },
        { value: "意向确认", label: "意向确认", color: "bg-violet-100 text-violet-700" },
        { value: "报价中", label: "报价中", color: "bg-amber-100 text-amber-700" },
        { value: "谈判中", label: "谈判中", color: "bg-orange-100 text-orange-700" },
        { value: "已成交", label: "已成交", color: "bg-emerald-100 text-emerald-700" },
        { value: "已流失", label: "已流失", color: "bg-zinc-100 text-zinc-500" },
      ]) },
    { field_key: "source", label: "来源渠道", field_type: "relation", width: 120, sort_order: 7, filterable: 1, section: "业务", relation_entity: "channels" },
    { field_key: "level", label: "等级", field_type: "select", width: 80, sort_order: 8, filterable: 1, section: "业务",
      options: JSON.stringify([
        { value: "A", label: "A" }, { value: "B", label: "B" },
        { value: "C", label: "C" }, { value: "D", label: "D" },
        { value: "已合作", label: "已合作" },
      ]) },
    { field_key: "identity", label: "身份", field_type: "text", width: 80, sort_order: 9, section: "业务" },
    { field_key: "project_type", label: "项目类型", field_type: "select", width: 100, sort_order: 10, filterable: 1, section: "业务",
      options: JSON.stringify(["建站", "APP&小程序", "AI技术", "技术服务", "课程", "企业培训"].map(v => ({ value: v, label: v }))) },
    { field_key: "budget_range", label: "预算范围", field_type: "text", width: 100, sort_order: 11, section: "业务" },
    { field_key: "sales_person", label: "Sales", field_type: "text", width: 80, sort_order: 12, filterable: 1, section: "业务" },
    { field_key: "deal", label: "商机金额", field_type: "currency", width: 100, sort_order: 13, section: "财务", render_hint: "currency" },
    { field_key: "remark", label: "备注", field_type: "textarea", width: 200, sort_order: 14, visible: 0 },
    { field_key: "next_follow_up", label: "下次跟进", field_type: "date", width: 110, sort_order: 15, visible: 0 },
    { field_key: "status", label: "状态", field_type: "select", width: 80, sort_order: 16, visible: 0, filterable: 1,
      options: JSON.stringify([
        { value: "active", label: "活跃" }, { value: "potential", label: "潜在" }, { value: "silent", label: "沉默" },
      ]) },
  ],
  channels: [
    { field_key: "name", label: "名称", field_type: "text", required: 1, width: 120, sort_order: 0, render_hint: "title" },
    { field_key: "contact_person", label: "联系人", field_type: "text", width: 100, sort_order: 1 },
    { field_key: "wechat", label: "微信", field_type: "text", width: 120, sort_order: 2, section: "联系方式" },
    { field_key: "phone", label: "电话", field_type: "text", width: 120, sort_order: 3, section: "联系方式" },
    { field_key: "company_type", label: "类型", field_type: "select", width: 80, sort_order: 4, filterable: 1,
      options: JSON.stringify(["个人", "公司", "MCN", "培训机构", "代运营", "其他"].map(v => ({ value: v, label: v }))) },
    { field_key: "company_name", label: "公司名", field_type: "text", width: 140, sort_order: 5 },
    { field_key: "cooperation_mode", label: "合作模式", field_type: "select", width: 100, sort_order: 6, filterable: 1,
      options: JSON.stringify(["返佣", "分成", "互推", "一次性推荐", "代理", "课程分销", "其他"].map(v => ({ value: v, label: v }))) },
    { field_key: "status", label: "状态", field_type: "select", width: 80, sort_order: 7, filterable: 1, render_hint: "kanban_lane",
      options: JSON.stringify([
        { value: "活跃", label: "活跃", color: "bg-emerald-100 text-emerald-700" },
        { value: "休眠", label: "休眠", color: "bg-zinc-100 text-zinc-600" },
        { value: "已终止", label: "已终止", color: "bg-red-100 text-red-700" },
      ]) },
    { field_key: "rating", label: "评级", field_type: "select", width: 80, sort_order: 8, filterable: 1,
      options: JSON.stringify([
        { value: "核心", label: "核心", color: "bg-amber-100 text-amber-700" },
        { value: "一般", label: "一般", color: "bg-blue-100 text-blue-700" },
        { value: "潜力", label: "潜力", color: "bg-emerald-100 text-emerald-700" },
      ]) },
    { field_key: "total_customers", label: "客户数", field_type: "number", width: 80, sort_order: 9, section: "数据" },
    { field_key: "total_revenue", label: "收入", field_type: "currency", width: 100, sort_order: 10, section: "数据", render_hint: "currency" },
    { field_key: "main_products", label: "主要产品", field_type: "text", width: 120, sort_order: 11 },
    { field_key: "is_public", label: "公域", field_type: "checkbox", width: 60, sort_order: 12 },
    { field_key: "followers", label: "粉丝数", field_type: "number", width: 80, sort_order: 13, visible: 0 },
    { field_key: "remark", label: "备注", field_type: "textarea", width: 200, sort_order: 14, visible: 0 },
  ],
  transactions: [
    { field_key: "type", label: "类型", field_type: "select", required: 1, width: 80, sort_order: 0, filterable: 1,
      options: JSON.stringify([{ value: "income", label: "收入" }, { value: "expense", label: "支出" }]) },
    { field_key: "amount", label: "金额", field_type: "currency", required: 1, width: 110, sort_order: 1, render_hint: "currency" },
    { field_key: "date", label: "日期", field_type: "date", required: 1, width: 110, sort_order: 2, sortable: 1 },
    { field_key: "description", label: "描述", field_type: "text", width: 200, sort_order: 3 },
    { field_key: "contact_id", label: "关联客户", field_type: "relation", width: 120, sort_order: 4, relation_entity: "contacts" },
    { field_key: "category", label: "分类", field_type: "select", width: 80, sort_order: 5, filterable: 1,
      options: JSON.stringify(["服务", "产品", "运营", "人力", "市场", "差旅"].map(v => ({ value: v, label: v }))) },
    { field_key: "subcategory", label: "子分类", field_type: "text", width: 80, sort_order: 6 },
    { field_key: "product_type", label: "产品类型", field_type: "select", width: 100, sort_order: 7, filterable: 1,
      options: JSON.stringify(["建站", "APP&小程序", "AI技术", "技术服务", "课程"].map(v => ({ value: v, label: v }))) },
    { field_key: "payment_status", label: "回款状态", field_type: "select", width: 90, sort_order: 8, filterable: 1,
      options: JSON.stringify(["已回款", "部分回款", "未回款"].map(v => ({ value: v, label: v }))) },
    { field_key: "payment_channel", label: "支付渠道", field_type: "select", width: 90, sort_order: 9,
      options: JSON.stringify(["银行转账", "微信", "支付宝"].map(v => ({ value: v, label: v }))) },
    { field_key: "progress", label: "进度", field_type: "select", width: 80, sort_order: 10,
      options: JSON.stringify(["进行中", "开发中", "已完成"].map(v => ({ value: v, label: v }))) },
    { field_key: "invoice_status", label: "发票", field_type: "select", width: 80, sort_order: 11, visible: 0,
      options: JSON.stringify(["none", "pending", "overdue"].map(v => ({ value: v, label: v }))) },
  ],
}

// ── Seed: auto-populate field_definitions from SEEDS ─────────
export function seedFieldDefinitions() {
  for (const [entity, fields] of Object.entries(SEEDS)) {
    const existing = db.prepare("SELECT count(*) as c FROM field_definitions WHERE entity = ?").get(entity) as any
    if (existing.c > 0) continue
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]
      db.prepare(
        `INSERT INTO field_definitions (id, entity, field_key, label, field_type, options, visible, sortable, filterable, required, width, sort_order, section, is_custom, relation_entity, render_hint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
      ).run(
        id(), entity, f.field_key, f.label, f.field_type,
        f.options || "[]",
        f.visible ?? 1, f.sortable ?? 1, f.filterable ?? 1, f.required ?? 0,
        f.width || 150, f.sort_order ?? i, f.section || "",
        f.relation_entity || "", f.render_hint || "",
        now(), now()
      )
    }
    console.log(`  📋 Schema: ${entity} → ${fields.length} fields`)
  }
}

// ── Discover custom fields from custom_data ─────────────────
export function discoverCustomFields(entity: string) {
  try {
    const rows = db.prepare(`SELECT custom_data FROM ${entity} WHERE custom_data IS NOT NULL AND custom_data != '{}'`).all() as any[]
    const knownKeys = new Set(
      (db.prepare("SELECT field_key FROM field_definitions WHERE entity = ?").all(entity) as any[]).map(r => r.field_key)
    )
    for (const row of rows) {
      try {
        const data = JSON.parse(row.custom_data || "{}")
        for (const key of Object.keys(data)) {
          if (!knownKeys.has(key) && !["id", "created_at", "updated_at"].includes(key)) {
            db.prepare(
              `INSERT OR IGNORE INTO field_definitions (id, entity, field_key, label, field_type, options, visible, sortable, filterable, required, width, sort_order, section, is_custom, relation_entity, render_hint, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'text', '[]', 1, 1, 1, 0, 150, 999, '', 1, '', '', ?, ?)`
            ).run(id(), entity, key, key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), now(), now())
            knownKeys.add(key)
          }
        }
      } catch { /* skip malformed JSON */ }
    }
  } catch { /* table might not have custom_data */ }
}

// ── CRUD ────────────────────────────────────────────────────

export function listFieldDefinitions(entity: string) {
  return db.prepare("SELECT * FROM field_definitions WHERE entity = ? ORDER BY sort_order, field_key").all(entity)
    .map(mapFieldDef)
}

export function getFieldDefinition(entity: string, fieldKey: string) {
  const row = db.prepare("SELECT * FROM field_definitions WHERE entity = ? AND field_key = ?").get(entity, fieldKey)
  return row ? mapFieldDef(row) : null
}

export function createFieldDefinition(data: { entity: string; field_key: string; label: string; field_type: string; options?: string; visible?: number; sortable?: number; filterable?: number; required?: number; width?: number; sort_order?: number; section?: string; relation_entity?: string; render_hint?: string }) {
  const existing = db.prepare("SELECT id FROM field_definitions WHERE entity = ? AND field_key = ?").get(data.entity, data.field_key) as any
  if (existing) return null
  const row = {
    id: id(), entity: data.entity, field_key: data.field_key, label: data.label,
    field_type: data.field_type || "text", options: data.options || "[]",
    visible: data.visible ?? 1, sortable: data.sortable ?? 1, filterable: data.filterable ?? 1,
    required: data.required ?? 0, width: data.width || 150,
    sort_order: data.sort_order ?? 999, section: data.section || "",
    is_custom: 1, relation_entity: data.relation_entity || "", render_hint: data.render_hint || "",
    created_at: now(), updated_at: now(),
  }
  db.prepare(
    `INSERT INTO field_definitions (id,entity,field_key,label,field_type,options,visible,sortable,filterable,required,width,sort_order,section,is_custom,relation_entity,render_hint,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(...Object.values(row))
  return row
}

export function updateFieldDefinition(entity: string, fieldKey: string, data: Record<string, any>) {
  const allowed = ["label", "field_type", "options", "visible", "sortable", "filterable", "required", "width", "sort_order", "section", "relation_entity", "render_hint"]
  const sets: string[] = []
  const vals: any[] = []
  for (const k of allowed) {
    if (data[k] !== undefined) { sets.push(`${k} = ?`); vals.push(data[k]) }
  }
  if (sets.length === 0) return null
  sets.push("updated_at = ?"); vals.push(now())
  vals.push(entity, fieldKey)
  const result = db.prepare(`UPDATE field_definitions SET ${sets.join(", ")} WHERE entity = ? AND field_key = ?`).run(...vals)
  return result.changes > 0 ? getFieldDefinition(entity, fieldKey) : null
}

export function deleteFieldDefinition(entity: string, fieldKey: string) {
  return db.prepare("DELETE FROM field_definitions WHERE entity = ? AND field_key = ? AND is_custom = 1").run(entity, fieldKey).changes > 0
}

export function reorderFieldDefinitions(entity: string, orderedKeys: string[]) {
  const stmt = db.prepare("UPDATE field_definitions SET sort_order = ?, updated_at = ? WHERE entity = ? AND field_key = ?")
  const t = now()
  for (let i = 0; i < orderedKeys.length; i++) {
    stmt.run(i, t, entity, orderedKeys[i])
  }
  return true
}

function mapFieldDef(row: any) {
  return {
    ...row,
    visible: Number(row.visible),
    sortable: Number(row.sortable),
    filterable: Number(row.filterable),
    required: Number(row.required),
    is_custom: Number(row.is_custom),
    options: JSON.parse(row.options || "[]"),
  }
}
