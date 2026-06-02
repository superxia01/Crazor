// Copyright (c) 2026 MeeJoy
// Unified Context Layer MVP — read-only aggregation over existing Crazor assets.

import {
  listContacts,
  listProjects,
  listTasks,
  listTasksByContact,
  listDeliveries,
  listFollowUps,
  listContentPieces,
  listChannels,
  listTransactions,
  listAuditLogs,
} from './crazor-db'
import { listNotesByContact, listTree, searchNotes } from './crazor-doc-tree'

const DEFAULT_TYPES = [
  'contact',
  'project',
  'task',
  'delivery',
  'follow_up',
  'content_piece',
  'channel',
  'transaction',
  'doc_note',
  'audit_log',
]

const TYPE_ALIASES: Record<string, string> = {
  contacts: 'contact',
  contact: 'contact',
  projects: 'project',
  project: 'project',
  tasks: 'task',
  task: 'task',
  deliveries: 'delivery',
  delivery: 'delivery',
  followups: 'follow_up',
  'follow-ups': 'follow_up',
  follow_up: 'follow_up',
  followup: 'follow_up',
  contents: 'content_piece',
  content: 'content_piece',
  'content-pieces': 'content_piece',
  content_piece: 'content_piece',
  channels: 'channel',
  channel: 'channel',
  transactions: 'transaction',
  transaction: 'transaction',
  docs: 'doc_note',
  doc: 'doc_note',
  notes: 'doc_note',
  note: 'doc_note',
  doc_note: 'doc_note',
  audits: 'audit_log',
  audit: 'audit_log',
  audit_log: 'audit_log',
}

export type UnifiedContextOptions = {
  q?: string
  types?: string | string[]
  contact_id?: string
  limit?: number | string
}

type ContextItem = {
  type: string
  id: string
  title: string
  subtitle: string
  summary: string
  status: string
  updated_at: string
  source: string
  url: string
  relations: Record<string, string>
  metadata: Record<string, unknown>
}

export function getUnifiedContext(options: UnifiedContextOptions = {}) {
  const q = clean(options.q)
  const contactId = clean(options.contact_id)
  const types = normalizeTypes(options.types)
  const limit = clamp(Number(options.limit || 50), 1, 200)
  const perTypeLimit = clamp(limit, 10, 200)

  const collected: ContextItem[] = []
  const add = (items: ContextItem[]) => {
    collected.push(...items.slice(0, perTypeLimit))
  }

  if (types.has('contact')) {
    const contacts = contactId
      ? [listContacts().find((item: any) => item.id === contactId)].filter(Boolean)
      : listContacts(q ? { q } : undefined)
    add(contacts.map(mapContact))
  }

  if (types.has('project')) {
    const projects = listProjects()
      .filter((item: any) => !contactId || item.contact_id === contactId)
      .filter((item: any) => matchesQuery(q, [item.name, item.description, item.status]))
    add(projects.map(mapProject))
  }

  if (types.has('task')) {
    const tasks = contactId ? listTasksByContact(contactId) : listTasks()
    add(tasks
      .filter((item: any) => matchesQuery(q, [item.title, item.description, item.status, item.assignee, item.project_name]))
      .map(mapTask))
  }

  if (types.has('delivery')) {
    add(listDeliveries(contactId ? { contact_id: contactId, q } : (q ? { q } : undefined))
      .filter((item: any) => matchesQuery(q, [
        item.title,
        item.delivery_type,
        item.stage,
        item.acceptance_status,
        item.owner,
        item.customer_owner,
        item.contact_name,
        item.project_name,
        ...(Array.isArray(item.deliverables) ? item.deliverables : []),
        ...(Array.isArray(item.risks) ? item.risks : []),
      ]))
      .map(mapDelivery))
  }

  if (types.has('follow_up')) {
    add(listFollowUps(contactId ? { contact_id: contactId } : undefined)
      .filter((item: any) => matchesQuery(q, [item.method, item.content, item.next_step, item.status]))
      .map(mapFollowUp))
  }

  if (types.has('content_piece')) {
    add(listContentPieces(q ? { q } : undefined).map(mapContentPiece))
  }

  if (types.has('channel')) {
    add(listChannels()
      .filter((item: any) => matchesQuery(q, [item.name, item.contact_person, item.company_name, item.status, item.rating]))
      .map(mapChannel))
  }

  if (types.has('transaction')) {
    add(listTransactions()
      .filter((item: any) => !contactId || item.contact_id === contactId)
      .filter((item: any) => matchesQuery(q, [item.description, item.type, item.category, item.product_type, item.progress]))
      .map(mapTransaction))
  }

  if (types.has('doc_note')) {
    const notes = contactId
      ? listNotesByContact('knowledge', contactId)
      : listDocs(q)
    add(notes.map(mapDocNote))
  }

  if (types.has('audit_log')) {
    add(listAuditLogs({ entity_id: contactId || undefined, limit: perTypeLimit })
      .filter((item: any) => contactId || matchesQuery(q, [item.action, item.entity, item.summary, item.source, item.actor_id]))
      .map(mapAuditLog))
  }

  const items = collected
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, limit)

  return {
    generated_at: new Date().toISOString(),
    filters: {
      q,
      contact_id: contactId,
      types: Array.from(types),
      limit,
    },
    counts: countByType(items),
    items,
  }
}

function listDocs(q: string) {
  if (q) {
    return [
      ...searchNotes('knowledge', q),
      ...searchNotes('notebook', q),
    ]
  }
  return [
    ...listTree('knowledge').notes,
    ...listTree('notebook').notes,
  ]
}

function mapContact(item: any): ContextItem {
  return baseItem({
    type: 'contact',
    id: item.id,
    title: item.name,
    subtitle: item.company || item.role || '',
    summary: [item.stage, item.level, item.project_type, item.next_follow_up].filter(Boolean).join(' / '),
    status: item.stage || item.status,
    updated_at: item.updated_at || item.created_at,
    url: `/contacts/${item.id}`,
    metadata: {
      company: item.company,
      level: item.level,
      source: item.source,
      deal: item.deal,
    },
  })
}

function mapProject(item: any): ContextItem {
  return baseItem({
    type: 'project',
    id: item.id,
    title: item.name,
    subtitle: item.status || '',
    summary: item.description || '',
    status: item.status,
    updated_at: item.updated_at || item.created_at,
    url: `/projects/${item.id}`,
    relations: { contact_id: item.contact_id || '' },
    metadata: {
      budget: item.budget,
      deadline: item.deadline,
      team: item.team,
    },
  })
}

function mapTask(item: any): ContextItem {
  return baseItem({
    type: 'task',
    id: item.id,
    title: item.title,
    subtitle: item.project_name || item.assignee || '',
    summary: item.description || '',
    status: item.status,
    updated_at: item.updated_at || item.created_at,
    url: `/tasks/${item.id}`,
    relations: {
      project_id: item.project_id || '',
      contact_id: item.contact_id || '',
    },
    metadata: {
      priority: item.priority,
      due_date: item.due_date,
      assignee: item.assignee,
    },
  })
}

function mapDelivery(item: any): ContextItem {
  const deliverables = Array.isArray(item.deliverables) ? item.deliverables : []
  const risks = Array.isArray(item.risks) ? item.risks : []
  return baseItem({
    type: 'delivery',
    id: item.id,
    title: item.title,
    subtitle: [item.contact_name, item.project_name, item.delivery_type].filter(Boolean).join(' / '),
    summary: [
      deliverables.length ? `交付物：${deliverables.join('、')}` : '',
      item.remark || '',
    ].filter(Boolean).join('；'),
    status: [item.stage, item.acceptance_status].filter(Boolean).join(' / '),
    updated_at: item.updated_at || item.created_at,
    url: `/deliveries/${item.id}`,
    relations: {
      contact_id: item.contact_id || '',
      project_id: item.project_id || '',
      handover_doc_id: item.handover_doc_id || '',
    },
    metadata: {
      delivery_type: item.delivery_type,
      owner: item.owner,
      customer_owner: item.customer_owner,
      start_date: item.start_date,
      due_date: item.due_date,
      accepted_at: item.accepted_at,
      deliverables,
      risks,
    },
  })
}

function mapFollowUp(item: any): ContextItem {
  return baseItem({
    type: 'follow_up',
    id: item.id,
    title: item.next_step || item.content || '跟进记录',
    subtitle: item.method || item.date || '',
    summary: item.content || '',
    status: item.status,
    updated_at: item.updated_at || item.date || item.created_at,
    url: `/follow-ups/${item.id}`,
    relations: { contact_id: item.contact_id || '' },
    metadata: {
      date: item.date,
      method: item.method,
    },
  })
}

function mapContentPiece(item: any): ContextItem {
  return baseItem({
    type: 'content_piece',
    id: item.id,
    title: item.title,
    subtitle: [item.platform, item.form].filter(Boolean).join(' / '),
    summary: item.topic_source || '',
    status: item.status,
    updated_at: item.updated_at || item.created_at,
    url: `/content-pieces/${item.id}`,
    relations: { doc_id: item.doc_id || '' },
    metadata: {
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
    },
  })
}

function mapChannel(item: any): ContextItem {
  return baseItem({
    type: 'channel',
    id: item.id,
    title: item.name,
    subtitle: item.company_name || item.contact_person || '',
    summary: item.remark || item.cooperation_mode || '',
    status: item.status || item.rating,
    updated_at: item.updated_at || item.created_at,
    url: `/channels/${item.id}`,
    metadata: {
      rating: item.rating,
      total_customers: item.total_customers,
      total_revenue: item.total_revenue,
    },
  })
}

function mapTransaction(item: any): ContextItem {
  return baseItem({
    type: 'transaction',
    id: item.id,
    title: item.description || `${item.type || 'transaction'} ${item.amount || ''}`.trim(),
    subtitle: item.date || '',
    summary: [item.category, item.product_type, item.payment_status].filter(Boolean).join(' / '),
    status: item.invoice_status || item.progress || item.type,
    updated_at: item.updated_at || item.date || item.created_at,
    url: `/transactions/${item.id}`,
    relations: {
      contact_id: item.contact_id || '',
      channel_id: item.channel_id || '',
    },
    metadata: {
      type: item.type,
      amount: item.amount,
      payment_channel: item.payment_channel,
    },
  })
}

function mapDocNote(item: any): ContextItem {
  return baseItem({
    type: 'doc_note',
    id: item.id,
    title: item.title,
    subtitle: item.scope || '',
    summary: item.folder_id || '',
    status: 'active',
    updated_at: item.updated_at || item.created_at,
    url: `/docs/${item.scope || 'knowledge'}/${encodeURIComponent(item.id)}`,
    relations: {
      contact_id: item.contact_id || '',
      folder_id: item.folder_id || '',
    },
  })
}

function mapAuditLog(item: any): ContextItem {
  return baseItem({
    type: 'audit_log',
    id: item.id,
    title: `${item.action} ${item.entity}`.trim(),
    subtitle: item.source || item.actor_id || '',
    summary: item.summary || '',
    status: item.action,
    updated_at: item.created_at,
    url: `/audit/${item.id}`,
    relations: {
      entity: item.entity || '',
      entity_id: item.entity_id || '',
      actor_id: item.actor_id || '',
    },
    metadata: {
      actor_type: item.actor_type,
      payload_hash: item.payload_hash,
    },
  })
}

function baseItem(input: Partial<ContextItem> & { type: string; id: string }): ContextItem {
  return {
    type: input.type,
    id: String(input.id || ''),
    title: clean(input.title) || String(input.id || ''),
    subtitle: clean(input.subtitle),
    summary: clean(input.summary),
    status: clean(input.status),
    updated_at: clean(input.updated_at),
    source: 'crazor',
    url: clean(input.url),
    relations: compactRecord(input.relations || {}) as Record<string, string>,
    metadata: compactRecord(input.metadata || {}),
  }
}

function normalizeTypes(input: unknown): Set<string> {
  const rawItems = Array.isArray(input)
    ? input
    : String(input || '').split(/[\s,，]+/)
  const normalized = rawItems
    .map((item) => TYPE_ALIASES[clean(item).toLowerCase()])
    .filter(Boolean)
  return new Set(normalized.length > 0 ? normalized : DEFAULT_TYPES)
}

function matchesQuery(q: string, fields: unknown[]): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return fields.some((field) => String(field || '').toLowerCase().includes(needle))
}

function countByType(items: ContextItem[]) {
  return items.reduce((acc: Record<string, number>, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {})
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function clamp(value: number, min: number, max: number): number {
  const parsed = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, parsed))
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}
