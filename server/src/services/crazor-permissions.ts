// Copyright (c) 2026 MeeJoy

export type ActorPermissionContext = {
  actor_id?: string
  role?: string
  source?: string
  scopes?: unknown
}

export type PermissionDecision = {
  allowed: boolean
  status?: 401 | 403
  error?: string
  required_scope: string
}

const TOKEN_SOURCES = new Set(["api-token", "agent-token"])
const WRITE_ACTIONS = new Set(["create", "update", "delete", "move", "reorder", "publish", "update_metrics", "install", "discover"])

const ROLE_WRITE_SCOPE_POLICIES: Record<string, string[]> = {
  admin: ["*"],
  member: ["crm:*", "docs:*", "project:*", "content:*"],
  viewer: [],
}

const ROLE_READ_SCOPE_POLICIES: Record<string, string[]> = {
  admin: ["*"],
  member: ["crm:*", "docs:*", "project:*", "content:*"],
  viewer: ["crm:read", "docs:read", "project:read", "content:read"],
}

const ENTITY_GROUPS: Record<string, string[]> = {
  crm: ["contact", "follow_up", "transaction", "channel", "channel_referral", "contact_doc", "contact_attachment"],
  docs: ["doc", "doc_note", "doc_folder", "doc_file", "contact_doc", "contact_attachment"],
  project: ["project", "task"],
  projects: ["project", "task"],
  content: ["content_piece"],
  identity: ["team_member", "actor_token", "field_definition", "skill"],
  audit: ["audit_log"],
  channel: ["channel", "channel_referral"],
  channels: ["channel", "channel_referral"],
}

export function normalizeScopes(input: unknown): string[] {
  if (Array.isArray(input)) return uniqueScopes(input.flatMap((item) => normalizeScopes(item)))
  if (input === null || input === undefined) return []

  const raw = String(input).trim()
  if (!raw) return []

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      return normalizeScopes(JSON.parse(raw))
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return uniqueScopes(raw.split(/[\s,，]+/))
}

export function serializeScopes(input: unknown, fallback = "*"): string {
  const scopes = normalizeScopes(input)
  return scopes.length > 0 ? scopes.join(",") : fallback
}

export function roleAllowedScopes(role: unknown): string[] {
  return roleAllowedWriteScopes(role)
}

export function roleAllowedWriteScopes(role: unknown): string[] {
  return ROLE_WRITE_SCOPE_POLICIES[clean(role) || "member"] || ROLE_WRITE_SCOPE_POLICIES.member
}

export function roleAllowedReadScopes(role: unknown): string[] {
  return ROLE_READ_SCOPE_POLICIES[clean(role) || "member"] || ROLE_READ_SCOPE_POLICIES.member
}

export function requiredScope(entity: string, action: string): string {
  return `${clean(entity)}:${clean(action)}`
}

export function evaluateWritePermission(actor: ActorPermissionContext | null | undefined, action: string, entity: string): PermissionDecision {
  const required_scope = requiredScope(entity, action)

  if (!actor) return { allowed: true, required_scope }
  if (actor.source === "missing-token") {
    return { allowed: false, status: 401, error: "token required", required_scope }
  }
  if (actor.source === "invalid-token") {
    return { allowed: false, status: 401, error: "invalid token", required_scope }
  }
  if (!TOKEN_SOURCES.has(String(actor.source || ""))) return { allowed: true, required_scope }

  const scopes = normalizeScopes(actor.scopes)
  if (scopes.some((scope) => scopeAllows(scope, entity, action))) {
    if (roleAllowsWrite(actor.role, entity, action)) {
      return { allowed: true, required_scope }
    }
    return { allowed: false, status: 403, error: "role denied", required_scope }
  }

  return { allowed: false, status: 403, error: "permission denied", required_scope }
}

export function evaluateReadPermission(actor: ActorPermissionContext | null | undefined, entity: string): PermissionDecision {
  const action = "read"
  const required_scope = requiredScope(entity, action)

  if (!actor) return { allowed: true, required_scope }
  if (actor.source === "missing-token") {
    return { allowed: false, status: 401, error: "token required", required_scope }
  }
  if (actor.source === "invalid-token") {
    return { allowed: false, status: 401, error: "invalid token", required_scope }
  }
  if (!TOKEN_SOURCES.has(String(actor.source || ""))) return { allowed: true, required_scope }

  const scopes = normalizeScopes(actor.scopes)
  if (scopes.some((scope) => scopeAllows(scope, entity, action))) {
    if (roleAllowsRead(actor.role, entity, action)) {
      return { allowed: true, required_scope }
    }
    return { allowed: false, status: 403, error: "role denied", required_scope }
  }

  return { allowed: false, status: 403, error: "permission denied", required_scope }
}

function roleAllowsWrite(role: unknown, entity: string, action: string): boolean {
  return roleAllowedWriteScopes(role).some((scope) => scopeAllows(scope, entity, action))
}

function roleAllowsRead(role: unknown, entity: string, action: string): boolean {
  return roleAllowedReadScopes(role).some((scope) => scopeAllows(scope, entity, action))
}

function scopeAllows(scope: string, entity: string, action: string): boolean {
  const normalized = clean(scope)
  if (!normalized) return false
  if (normalized === "*") return true

  const [left, right = "*"] = normalized.split(":", 2)
  if (!left) return false

  const entityAllowed = entityMatches(left, entity)
  const actionAllowed = actionMatches(right, action)
  if (entityAllowed && actionAllowed) return true

  // Also support write-oriented aliases such as write:crm and write:*.
  if (left === "write" && WRITE_ACTIONS.has(clean(action))) {
    return entityMatches(right, entity)
  }
  if (left === "read" && clean(action) === "read") {
    return entityMatches(right, entity)
  }

  return false
}

function entityMatches(scopeEntity: string, entity: string): boolean {
  const expected = clean(scopeEntity)
  const actual = clean(entity)
  if (expected === "*" || expected === actual) return true
  return ENTITY_GROUPS[expected]?.includes(actual) || false
}

function actionMatches(scopeAction: string, action: string): boolean {
  const expected = clean(scopeAction)
  const actual = clean(action)
  return expected === "*" || expected === actual || (expected === "write" && WRITE_ACTIONS.has(actual))
}

function uniqueScopes(scopes: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const scope of scopes) {
    const text = clean(scope)
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

function clean(value: unknown): string {
  return String(value || "").trim().toLowerCase()
}
