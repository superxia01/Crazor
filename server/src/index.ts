import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { stream } from 'hono/streaming'
import { HTTPException } from 'hono/http-exception'
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import {
  listContacts, getContact, createContact, updateContact, deleteContact,
  listTransactions, createTransaction, updateTransaction, deleteTransaction,
  getMonthlyRevenue, listProjects, createProject, updateProject, deleteProject,
  listTasks, listTasksByContact, getTaskReminders, createTask, updateTask, deleteTask, moveTask,
  getContactStats, getFinanceStats, getProjectStats, getHermesSessionStats,
  listFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, getFollowUpReminders,
  listChannels, getChannel, createChannel, updateChannel, deleteChannel, getChannelStats,
  listChannelReferrals, createChannelReferral, listContactChannels,
  listContentPieces, getContentPiece, createContentPiece, updateContentPiece, deleteContentPiece, getContentPieceStats, seedContentPieces,
  contentPublish, contentUpdateMetrics,
  createAuditLog, listAuditLogs,
  createTeamMember, listTeamMembers, updateTeamMember, deleteTeamMember,
  createActorToken, listActorTokens, revokeActorToken, resolveActorToken, hasActiveActorTokens,
} from './services/crazor-db'
import { seedFieldDefinitions, discoverCustomFields, listFieldDefinitions, getFieldDefinition, createFieldDefinition, updateFieldDefinition, deleteFieldDefinition, reorderFieldDefinitions } from './services/field-definitions'
import * as docs from './services/crazor-docs'
import * as docTree from './services/crazor-doc-tree'
import * as skillCatalog from './services/skill-catalog'
import * as aiEmployeeRuntime from './services/ai-employee-runtime'
import { getUnifiedContext } from './services/unified-context'
import { seedVault } from './services/seed-vault'
import { seedSkills, seedOneSkill } from './services/seed-skills'
import { migrateVault } from './services/migrate-vault'
import { handleSSEConnect, handleSSEMessage, handleStreamableHTTP } from './services/crazor-mcp'
import { CRAZOR_HOME, CRAZOR_SKILLS_DIR, WECHAT_APP_ID, DEPLOYMENT_TIER } from './services/crazor-config'
import {
  AGENT_DASHBOARD_URL,
  AGENT_GATEWAY_URL,
  agentProviderSupports,
  agentGatewayHeaders,
  type AgentProviderCapabilityId,
  getAgentProviderDescriptor,
  unsupportedAgentProviderCapability,
} from './services/agent-gateway'
import { evaluateReadPermission, evaluateWritePermission } from './services/crazor-permissions'
import { authMiddleware } from './middleware/auth'
import { generateState, getWechatLoginUrl, exchangeCodeForToken, upsertUser, isUserBound, signJWT, verifyJWT } from './services/crazor-auth'

const app = new Hono()

// --- Config ---
const PORT = parseInt(process.env.PORT || '3001')
const CRAZOR_REQUIRE_WRITE_TOKEN = truthyEnv(process.env.CRAZOR_REQUIRE_WRITE_TOKEN || process.env.CRAZOR_REQUIRE_TOKEN_AUTH)
const CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN = truthyEnv(
  process.env.CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN ||
  process.env.CRAZOR_REQUIRE_READ_TOKEN ||
  process.env.CRAZOR_REQUIRE_WRITE_TOKEN ||
  process.env.CRAZOR_REQUIRE_TOKEN_AUTH,
)
const CRAZOR_REQUIRE_BUSINESS_READ_TOKEN = truthyEnv(
  process.env.CRAZOR_REQUIRE_BUSINESS_READ_TOKEN ||
  process.env.CRAZOR_REQUIRE_READ_TOKEN ||
  process.env.CRAZOR_REQUIRE_TOKEN_AUTH,
)
const CRAZOR_CONTACT_ATTACHMENTS_ROOT = resolve(CRAZOR_HOME, 'attachments', 'contacts')
const DEFAULT_ATTACHMENT_EXTENSIONS = [
  'txt', 'md', 'csv', 'json', 'pdf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'webp', 'gif',
  'zip', 'mp3', 'm4a', 'wav', 'mp4', 'mov',
]
const TEXT_ATTACHMENT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'log', 'yaml', 'yml'])
const IMAGE_ATTACHMENT_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const CRAZOR_ATTACHMENT_MAX_BYTES = parsePositiveInt(process.env.CRAZOR_ATTACHMENT_MAX_BYTES, 20 * 1024 * 1024)
const CRAZOR_ATTACHMENT_PREVIEW_MAX_BYTES = parsePositiveInt(process.env.CRAZOR_ATTACHMENT_PREVIEW_MAX_BYTES, 512 * 1024)
const CRAZOR_ATTACHMENT_ALLOWED_EXTENSIONS = parseAttachmentExtensionList(
  process.env.CRAZOR_ATTACHMENT_ALLOWED_EXTENSIONS || DEFAULT_ATTACHMENT_EXTENSIONS.join(','),
)

// --- Dashboard session token management ---
let _dashboardToken: string | null = null
let _dashboardTokenFetchedAt = 0

async function getDashboardToken(): Promise<string | null> {
  // Cache token for 5 minutes
  if (_dashboardToken && Date.now() - _dashboardTokenFetchedAt < 5 * 60 * 1000) {
    return _dashboardToken
  }
  try {
    const resp = await fetch(`${AGENT_DASHBOARD_URL}/`)
    const html = await resp.text()
    const match = html.match(/__HERMES_SESSION_TOKEN__="([^"]+)"/)
    if (match) {
      _dashboardToken = match[1]
      _dashboardTokenFetchedAt = Date.now()
      return _dashboardToken
    }
  } catch {
    // Dashboard not available
  }
  return _dashboardToken
}

// Helper to make authenticated requests to Dashboard
async function dashboardFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getDashboardToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['X-Hermes-Session-Token'] = token
  }
  return fetch(`${AGENT_DASHBOARD_URL}${path}`, {
    ...options,
    headers,
  })
}

// Safe proxy: returns fallback on upstream failure
async function safeDashboardJson<T>(c: any, path: string, options: RequestInit = {}, fallback: T): Promise<T> {
  try {
    const resp = await dashboardFetch(path, options)
    if (!resp.ok) return fallback
    const data = await resp.json()
    return data ?? fallback
  } catch {
    return fallback
  }
}

function parseUpstreamError(text: string): { message: string; detail?: unknown } {
  try {
    const data = JSON.parse(text)
    const message =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      text
    return { message: String(message), detail: data }
  } catch {
    return { message: text }
  }
}

async function parseResponsePayload(resp: Response): Promise<unknown> {
  const text = await resp.text()
  if (!text) return { ok: resp.ok }
  try {
    return JSON.parse(text)
  } catch {
    return resp.ok ? { ok: true, message: text } : { error: text }
  }
}

async function proxyJsonResponse(c: any, resp: Response) {
  return c.json(await parseResponsePayload(resp), resp.status as 200)
}

function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function responseFailedEvent(message: string, detail?: unknown): string {
  return formatSseEvent('response.failed', {
    type: 'response.failed',
    response: {
      status: 'failed',
      error: { message },
    },
    error: {
      message,
      detail,
    },
  })
}

async function gatewayFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${AGENT_GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      ...agentGatewayHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  })
}

async function readAgentProviderGatewayStatus() {
  try {
    const resp = await gatewayFetch('/v1/models')
    const payload = await parseResponsePayload(resp).catch(() => null)
    return {
      available: resp.ok,
      status: resp.status,
      probe: '/v1/models',
      message: resp.ok ? 'ok' : 'gateway probe failed',
      payload,
    }
  } catch (error) {
    return {
      available: false,
      status: 0,
      probe: '/v1/models',
      message: error instanceof Error ? error.message : 'gateway connection failed',
      payload: null,
    }
  }
}

async function readAgentProviderDashboardStatus() {
  if (!agentProviderSupports('dashboard.status')) {
    return {
      available: false,
      status: 0,
      probe: '',
      skipped: true,
      message: unsupportedAgentProviderCapability('dashboard.status').message,
      payload: null,
    }
  }

  try {
    const resp = await dashboardFetch('/api/status')
    const payload = await parseResponsePayload(resp).catch(() => null)
    const record = asRecord(payload)
    const gatewayRunning = hasOwn(record, 'gateway_running') ? Boolean(record.gateway_running) : resp.ok
    return {
      available: resp.ok,
      status: resp.status,
      probe: '/api/status',
      gateway_running: gatewayRunning,
      message: resp.ok ? 'ok' : 'dashboard probe failed',
      payload,
    }
  } catch (error) {
    return {
      available: false,
      status: 0,
      probe: '/api/status',
      gateway_running: false,
      message: error instanceof Error ? error.message : 'dashboard connection failed',
      payload: null,
    }
  }
}

async function getAgentProviderRuntimeDescriptor() {
  const provider = getAgentProviderDescriptor()
  const [gateway, dashboard] = await Promise.all([
    readAgentProviderGatewayStatus(),
    readAgentProviderDashboardStatus(),
  ])
  const dashboardRequired = provider.capability_ids.some((id: string) => id.startsWith('dashboard.'))
  const status = gateway.available && (!dashboardRequired || dashboard.available)
    ? 'ok'
    : gateway.available
      ? 'degraded'
      : 'offline'

  return {
    ...provider,
    status,
    runtime: {
      gateway,
      dashboard,
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function readFirstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (hasOwn(record, key)) return cleanString(record[key])
  }
  return ''
}

function readContextLength(record: Record<string, unknown>): { hasValue: boolean; value: number } {
  const hasValue = hasOwn(record, 'contextLength') || hasOwn(record, 'model_context_length')
  if (!hasValue) return { hasValue: false, value: 0 }
  const raw = hasOwn(record, 'contextLength') ? record.contextLength : record.model_context_length
  const parsed = Number(raw)
  return { hasValue: true, value: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0 }
}

function inferApiMode(provider: string, model: string, currentApiMode: unknown): string {
  const existing = cleanString(currentApiMode)
  if (existing) return existing

  const normalizedProvider = provider.toLowerCase()
  const normalizedModel = model.toLowerCase()
  if (
    (normalizedProvider === 'custom' || normalizedProvider.startsWith('custom:')) &&
    (normalizedModel.includes('codex') || normalizedModel.includes('gpt-5') || /\bo[1-4]\b/.test(normalizedModel))
  ) {
    return 'codex_responses'
  }
  return ''
}

function readClearFields(record: Record<string, unknown>): Set<string> {
  const raw = record.clearFields
  if (!Array.isArray(raw)) return new Set()
  return new Set(raw.map((item) => cleanString(item)).filter(Boolean))
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseModelBlockFromYaml(yamlText: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yamlText.split(/\r?\n/)
  let inModel = false
  let modelIndent = 0

  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0
    const trimmed = line.trim()

    if (!inModel) {
      if (/^model:\s*(?:#.*)?$/.test(trimmed)) {
        inModel = true
        modelIndent = indent
      }
      continue
    }

    if (!trimmed || trimmed.startsWith('#')) continue
    if (indent <= modelIndent) break

    const match = line.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/)
    if (!match) continue

    const key = match[1]
    let value = match[2].trim()
    const commentIndex = value.search(/\s+#/)
    if (commentIndex >= 0) value = value.slice(0, commentIndex).trim()
    result[key] = unquoteYamlScalar(value)
  }

  return result
}

async function loadDashboardModelBlock(): Promise<Record<string, unknown>> {
  try {
    const resp = await dashboardFetch(`/api/config/raw`)
    if (!resp.ok) return {}
    const payload = asRecord(await resp.json())
    return parseModelBlockFromYaml(cleanString(payload.yaml))
  } catch {
    return {}
  }
}

function shouldUseModelSet(provider: string, body: Record<string, unknown>, contextLength: { hasValue: boolean }): boolean {
  const normalizedProvider = provider.toLowerCase()
  const hasBaseUrl = hasOwn(body, 'baseUrl') || hasOwn(body, 'base_url')
  const hasApiKey = hasOwn(body, 'apiKey') || hasOwn(body, 'api_key')
  const hasApiMode = hasOwn(body, 'apiMode') || hasOwn(body, 'api_mode')
  const hasClearFields = Array.isArray(body.clearFields) && body.clearFields.length > 0

  return (
    normalizedProvider !== 'custom' &&
    !normalizedProvider.startsWith('custom:') &&
    !hasBaseUrl &&
    !hasApiKey &&
    !hasApiMode &&
    !contextLength.hasValue &&
    !hasClearFields
  )
}

const sessionResponseIds = new Map<string, string | null>()
const sessionPinnedIds = new Set<string>()
const sessionModelOverrides = new Map<string, string | null>()

function sessionTimestamp(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString()
  }
  const text = cleanString(value)
  return text || new Date().toISOString()
}

function normalizeGatewaySession(payload: unknown): Record<string, unknown> {
  const record = asRecord(payload)
  const session = asRecord(record.session || record)
  const id = cleanString(session.id)
  const lastActive = session.last_active ?? session.started_at ?? session.updated_at
  const overriddenModel = id ? sessionModelOverrides.get(id) : undefined

  return {
    ...session,
    id,
    title: cleanString(session.title) || cleanString(session.preview) || '新会话',
    model: overriddenModel !== undefined ? overriddenModel : (session.model ?? null),
    pinned: id ? sessionPinnedIds.has(id) : false,
    updated_at: sessionTimestamp(lastActive),
    created_at: sessionTimestamp(session.started_at ?? lastActive),
    response_id: id ? sessionResponseIds.get(id) || null : null,
  }
}

function normalizeGatewaySessionList(payload: unknown): Record<string, unknown>[] {
  const record = asRecord(payload)
  const items = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.sessions)
      ? record.sessions
      : Array.isArray(payload)
        ? payload
        : []
  return items.map((item) => normalizeGatewaySession(item)).filter((item) => item.id)
}

// --- Middleware ---
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']

const AGENT_PROVIDER_CAPABILITY_ROUTES: { prefix: string; capability: AgentProviderCapabilityId }[] = [
  { prefix: '/api/chat/completions', capability: 'gateway.chat_completions' },
  { prefix: '/api/responses', capability: 'gateway.responses' },
  { prefix: '/api/models', capability: 'gateway.models' },
  { prefix: '/api/sessions', capability: 'gateway.sessions' },
  { prefix: '/api/cron/dependency', capability: 'dashboard.tasks' },
  { prefix: '/api/cron', capability: 'gateway.jobs' },
  { prefix: '/api/config', capability: 'dashboard.config' },
  { prefix: '/api/model', capability: 'dashboard.model_config' },
  { prefix: '/api/env', capability: 'dashboard.env' },
  { prefix: '/api/status', capability: 'dashboard.status' },
  { prefix: '/api/gateway/restart', capability: 'dashboard.status' },
  { prefix: '/api/gateway/stop', capability: 'dashboard.status' },
  { prefix: '/api/dashboard/stop', capability: 'dashboard.status' },
  { prefix: '/api/hermes/version', capability: 'dashboard.status' },
  { prefix: '/api/hermes/update', capability: 'dashboard.update' },
  { prefix: '/api/tools/toolsets', capability: 'dashboard.toolsets' },
  { prefix: '/api/skills/market', capability: 'dashboard.skills_market' },
  { prefix: '/api/skills', capability: 'dashboard.skills' },
  { prefix: '/api/logs', capability: 'dashboard.logs' },
  { prefix: '/api/memories', capability: 'dashboard.memory' },
  { prefix: '/api/tasks', capability: 'dashboard.tasks' },
  { prefix: '/api/agents', capability: 'dashboard.agents' },
  { prefix: '/api/channels', capability: 'dashboard.channels' },
  { prefix: '/api/hermes-config', capability: 'dashboard.memory' },
  { prefix: '/api/files', capability: 'dashboard.files' },
  { prefix: '/mcp', capability: 'crazor.mcp' },
]

app.use('*', cors({
  origin: CORS_ORIGINS,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'X-Crazor-Token', 'X-Crazor-Actor-Type', 'X-Crazor-Actor-Id', 'X-Crazor-Source'],
  exposeHeaders: ['X-Hermes-Session-Id', 'Mcp-Session-Id'],
}))

app.use('*', async (c, next) => {
  const capability = requiredAgentProviderCapability(new URL(c.req.url).pathname)
  if (capability && !agentProviderSupports(capability)) {
    return c.json({
      ...unsupportedAgentProviderCapability(capability),
      status: 'unsupported',
    }, 501)
  }
  await next()
})

const AUDIT_WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE'])
const BUSINESS_READ_ROOTS = new Set([
  'ai-employees',
  'contacts',
  'follow-ups',
  'follow-up-reminders',
  'transactions',
  'projects',
  'tasks',
  'task-reminders',
  'channels',
  'content-pieces',
  'docs',
  'doc-files',
  'analytics',
  'context',
])

app.use('/api/crazor/*', async (c, next) => {
  const method = c.req.method.toUpperCase()
  const shouldAudit = AUDIT_WRITE_METHODS.has(method)
  const url = new URL(c.req.url)
  const sensitiveRead = deriveSensitiveReadAudit(method, url.pathname)
  const businessRead = sensitiveRead ? null : deriveBusinessReadAudit(method, url.pathname, url.searchParams)
  const requestText = shouldAudit
    ? await c.req.raw.clone().text().catch(() => '')
    : ''
  const actor = shouldAudit || sensitiveRead || businessRead
    ? resolveRequestActor(c, { actor_type: 'human', actor_id: 'anonymous', source: 'rest-api' })
    : null

  if (sensitiveRead && shouldProtectSensitiveRead()) {
    const readActor = extractActorToken(c)
      ? actor
      : { actor_type: 'human', actor_id: 'missing-token', source: 'missing-token' }
    const permission = evaluateReadPermission(readActor, sensitiveRead.entity)
    if (!permission.allowed) {
      recordDeniedRestRead(readActor, sensitiveRead, method, url.pathname, permission.required_scope)
      return c.json({
        error: permission.error,
        required_scope: permission.required_scope,
        auth_required: permission.status === 401,
        actor_id: readActor?.actor_id || '',
      }, permission.status || 403)
    }
  }

  if (businessRead && shouldProtectBusinessRead()) {
    const readActor = extractActorToken(c)
      ? actor
      : { actor_type: 'human', actor_id: 'missing-token', source: 'missing-token' }
    const permission = evaluateReadPermission(readActor, businessRead.entity)
    if (!permission.allowed) {
      recordDeniedRestRead(readActor, businessRead, method, url.pathname, permission.required_scope)
      return c.json({
        error: permission.error,
        required_scope: permission.required_scope,
        auth_required: permission.status === 401,
        actor_id: readActor?.actor_id || '',
      }, permission.status || 403)
    }
  }

  if (shouldAudit && CRAZOR_REQUIRE_WRITE_TOKEN && !extractActorToken(c) && !canBootstrapIdentityWrite(url.pathname)) {
    const audit = deriveRestAudit(method, url.pathname, null, url.searchParams)
    const missingActor = { actor_type: 'human', actor_id: 'missing-token', source: 'missing-token' }
    const permission = evaluateWritePermission(missingActor, audit.action, audit.entity)
    recordDeniedRestWrite(missingActor, audit, method, url.pathname, requestText, permission.required_scope)
    return c.json({
      error: permission.error,
      required_scope: permission.required_scope,
      auth_required: true,
    }, permission.status || 401)
  }

  if (shouldAudit && extractActorToken(c)) {
    const audit = deriveRestAudit(method, url.pathname, null, url.searchParams)
    const permission = evaluateWritePermission(actor, audit.action, audit.entity)
    if (!permission.allowed) {
      recordDeniedRestWrite(actor, audit, method, url.pathname, requestText, permission.required_scope)
      return c.json({
        error: permission.error,
        required_scope: permission.required_scope,
        actor_id: actor?.actor_id || '',
      }, permission.status || 403)
    }
  }

  await next()

  if (!shouldAudit || c.res.status < 200 || c.res.status >= 400) return

  const responseBody = await c.res.clone().json().catch(() => null)
  const audit = deriveRestAudit(method, url.pathname, responseBody, url.searchParams)
  try {
    createAuditLog({
      actor_type: actor?.actor_type || 'human',
      actor_id: actor?.actor_id || 'anonymous',
      source: actor?.source || c.req.header('X-Crazor-Source') || 'rest-api',
      action: audit.action,
      entity: audit.entity,
      entity_id: audit.entity_id,
      payload: requestText,
      summary: `${method} ${url.pathname}`,
    })
  } catch (err) {
    console.error('[audit] failed to record REST write:', err)
  }
})

function truthyEnv(value: unknown): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function requiredAgentProviderCapability(pathname: string): AgentProviderCapabilityId | null {
  const route = AGENT_PROVIDER_CAPABILITY_ROUTES.find((item) => pathMatchesPrefix(pathname, item.prefix))
  return route?.capability || null
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function canBootstrapIdentityWrite(pathname: string): boolean {
  if (!CRAZOR_REQUIRE_WRITE_TOKEN || hasActiveActorTokens()) return false
  return pathname === '/api/crazor/identity/members' || pathname === '/api/crazor/identity/tokens'
}

function shouldProtectSensitiveRead(): boolean {
  return CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN && hasActiveActorTokens()
}

function shouldProtectBusinessRead(): boolean {
  return CRAZOR_REQUIRE_BUSINESS_READ_TOKEN && hasActiveActorTokens()
}

function deriveSensitiveReadAudit(method: string, pathname: string): { entity: string; entity_id: string } | null {
  if (method !== 'GET') return null
  if (pathname === '/api/crazor/audit-logs') return { entity: 'audit_log', entity_id: '' }
  if (pathname === '/api/crazor/identity/members') return { entity: 'team_member', entity_id: '' }
  if (pathname === '/api/crazor/identity/tokens') return { entity: 'actor_token', entity_id: '' }
  return null
}

function deriveBusinessReadAudit(method: string, pathname: string, searchParams: URLSearchParams): { entity: string; entity_id: string } | null {
  if (method !== 'GET') return null
  if (deriveSensitiveReadAudit(method, pathname)) return null

  const segments = pathname.replace(/^\/api\/crazor\/?/, '').split('/').filter(Boolean)
  if (segments[0] === 'identity') return null
  if (!BUSINESS_READ_ROOTS.has(segments[0])) return null

  const entity = deriveAuditEntity(segments)
  return {
    entity,
    entity_id: deriveRestEntityId(segments, null, searchParams),
  }
}

function recordDeniedRestRead(actor: any, audit: { entity: string; entity_id: string }, method: string, pathname: string, requiredScope: string) {
  try {
    createAuditLog({
      actor_type: actor?.actor_type || 'human',
      actor_id: actor?.actor_id || 'missing-token',
      source: actor?.source || 'permission-denied',
      action: 'deny_read',
      entity: audit.entity,
      entity_id: audit.entity_id,
      payload: '',
      summary: `${method} ${pathname} denied: ${requiredScope}`,
    })
  } catch (err) {
    console.error('[audit] failed to record read permission denial:', err)
  }
}

function recordDeniedRestWrite(actor: any, audit: { action: string; entity: string; entity_id: string }, method: string, pathname: string, requestText: string, requiredScope: string) {
  try {
    createAuditLog({
      actor_type: actor?.actor_type || 'human',
      actor_id: actor?.actor_id || 'missing-token',
      source: actor?.source || 'permission-denied',
      action: `deny_${audit.action}`,
      entity: audit.entity,
      entity_id: audit.entity_id,
      payload: requestText,
      summary: `${method} ${pathname} denied: ${requiredScope}`,
    })
  } catch (err) {
    console.error('[audit] failed to record permission denial:', err)
  }
}

function resolveRequestActor(c: any, fallback = { actor_type: 'human', actor_id: 'anonymous', source: 'rest-api' }) {
  const token = extractActorToken(c)
  if (token) {
    const actor = resolveActorToken(token)
    if (actor) return actor
    return {
      actor_type: fallback.actor_type,
      actor_id: 'invalid-token',
      source: 'invalid-token',
    }
  }
  return {
    actor_type: c.req.header('X-Crazor-Actor-Type') || fallback.actor_type,
    actor_id: c.req.header('X-Crazor-Actor-Id') || fallback.actor_id,
    source: c.req.header('X-Crazor-Source') || fallback.source,
  }
}

function extractActorToken(c: any): string {
  const scopedToken = String(c.req.header('X-Crazor-Token') || '').trim()
  if (scopedToken) return scopedToken

  const auth = c.req.header('Authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  const bearer = String(match?.[1] || '').trim()
  return bearer.startsWith('czr_') ? bearer : ''
}

function resolveMcpRequestActor(c: any) {
  if (CRAZOR_REQUIRE_WRITE_TOKEN && !extractActorToken(c)) {
    return { actor_type: 'agent', actor_id: 'missing-token', source: 'missing-token' }
  }
  return resolveRequestActor(c, { actor_type: 'agent', actor_id: 'mcp-client', source: 'mcp-tool' })
}

function deriveRestAudit(method: string, path: string, responseBody: any, searchParams: URLSearchParams) {
  const segments = path.replace(/^\/api\/crazor\/?/, '').split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  const action = deriveAuditAction(method, last)
  const entity = deriveAuditEntity(segments)
  const entity_id = deriveRestEntityId(segments, responseBody, searchParams)
  return { action, entity, entity_id }
}

function deriveRestEntityId(segments: string[], responseBody: any, searchParams: URLSearchParams) {
  if (segments[0] === 'ai-employees' && segments[2] === 'runs') {
    return stringOrEmpty(segments[1])
  }
  return (
    stringOrEmpty(responseBody?.id) ||
    stringOrEmpty(searchParams.get('id')) ||
    stringOrEmpty(segments[1]) ||
    ''
  )
}

function deriveAuditAction(method: string, lastSegment: string) {
  if (lastSegment === 'move') return 'move'
  if (lastSegment === 'reorder') return 'reorder'
  if (lastSegment === 'runs') return 'run'
  if (lastSegment === 'discover') return 'discover'
  if (lastSegment === 'install') return 'install'
  if (lastSegment === 'publish') return 'publish'
  if (lastSegment === 'metrics') return 'update_metrics'
  if (method === 'POST') return 'create'
  if (method === 'PATCH') return 'update'
  if (method === 'DELETE') return 'delete'
  return method.toLowerCase()
}

function deriveAuditEntity(segments: string[]) {
  if (segments[0] === 'contacts' && segments[2] === 'docs') return 'contact_doc'
  if (segments[0] === 'contacts' && segments[2] === 'attachments') return 'contact_attachment'
  if (segments[0] === 'channels' && segments[2] === 'referrals') return 'channel_referral'
  if (segments[0] === 'doc-files') return 'doc_file'
  if (segments[0] === 'docs') {
    if (segments[2]?.startsWith('folders')) return 'doc_folder'
    if (segments[2]?.startsWith('notes')) return 'doc_note'
    return 'doc'
  }
  if (segments[0] === 'schema') return 'field_definition'
  if (segments[0] === 'ai-employees') return 'ai_employee'
  if (segments[0] === 'identity' && segments[1] === 'members') return 'team_member'
  if (segments[0] === 'identity' && segments[1] === 'tokens') return 'actor_token'
  if (segments[0] === 'skills') return 'skill'

  const entityMap: Record<string, string> = {
    contacts: 'contact',
    'content-pieces': 'content_piece',
    transactions: 'transaction',
    projects: 'project',
    tasks: 'task',
    'task-reminders': 'task',
    'follow-ups': 'follow_up',
    'follow-up-reminders': 'follow_up',
    channels: 'channel',
    analytics: 'analytics',
    context: 'context',
  }
  return entityMap[segments[0]] || segments[0] || 'unknown'
}

function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function parseAttachmentExtensionList(value: unknown): string[] {
  const extensions = String(value || '')
    .split(/[\s,，]+/)
    .map((item) => normalizeAttachmentExtension(item))
    .filter(Boolean)
  return extensions.length > 0 ? Array.from(new Set(extensions)) : DEFAULT_ATTACHMENT_EXTENSIONS
}

function normalizeAttachmentExtension(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === '*') return '*'
  return raw.replace(/^\.+/, '')
}

function attachmentExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return ''
  return normalizeAttachmentExtension(filename.slice(dotIndex + 1))
}

function attachmentPolicy() {
  const allowed = CRAZOR_ATTACHMENT_ALLOWED_EXTENSIONS
  return {
    max_bytes: CRAZOR_ATTACHMENT_MAX_BYTES,
    max_mb: Number((CRAZOR_ATTACHMENT_MAX_BYTES / 1024 / 1024).toFixed(1)),
    preview_max_bytes: CRAZOR_ATTACHMENT_PREVIEW_MAX_BYTES,
    allowed_extensions: allowed,
    accept: allowed.includes('*') ? '' : allowed.map((ext) => `.${ext}`).join(','),
  }
}

function isAttachmentExtensionAllowed(filename: string): boolean {
  const allowed = CRAZOR_ATTACHMENT_ALLOWED_EXTENSIONS
  if (allowed.includes('*')) return true
  const ext = attachmentExtension(filename)
  return Boolean(ext && allowed.includes(ext))
}

function contactAttachmentsDir(contactId: string): string {
  const safeContactId = sanitizePathSegment(contactId)
  const dir = resolve(CRAZOR_CONTACT_ATTACHMENTS_ROOT, safeContactId)
  if (!dir.startsWith(`${CRAZOR_CONTACT_ATTACHMENTS_ROOT}/`) && dir !== CRAZOR_CONTACT_ATTACHMENTS_ROOT) {
    throw new Error('invalid contact attachment path')
  }
  return dir
}

function sanitizePathSegment(value: unknown): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
}

function sanitizeAttachmentFilename(value: unknown): string {
  const source = basename(String(value || 'attachment'))
  const cleaned = source.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim()
  return cleaned || 'attachment'
}

function uniqueAttachmentName(dir: string, filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  const baseName = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : ''
  let candidate = filename
  let index = 2
  while (existsSync(resolve(dir, candidate))) {
    candidate = `${baseName}-${index}${ext}`
    index += 1
  }
  return candidate
}

function attachmentKind(filename: string): 'text' | 'image' | 'file' {
  const ext = attachmentExtension(filename)
  if (TEXT_ATTACHMENT_EXTENSIONS.has(ext)) return 'text'
  if (IMAGE_ATTACHMENT_EXTENSIONS.has(ext)) return 'image'
  return 'file'
}

function attachmentMimeType(filename: string): string {
  const ext = attachmentExtension(filename)
  const mimeMap: Record<string, string> = {
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    json: 'application/json; charset=utf-8',
    log: 'text/plain; charset=utf-8',
    yaml: 'text/yaml; charset=utf-8',
    yml: 'text/yaml; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    zip: 'application/zip',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

function contactAttachmentResponse(contactId: string, name: string, stat: any) {
  const encodedContactId = encodeURIComponent(contactId)
  const encodedName = encodeURIComponent(name)
  const kind = attachmentKind(name)
  return {
    id: name,
    name,
    path: `attachments/contacts/${sanitizePathSegment(contactId)}/${name}`,
    size: stat.size,
    extension: attachmentExtension(name),
    kind,
    mime_type: attachmentMimeType(name),
    can_preview: kind !== 'file' && stat.size <= CRAZOR_ATTACHMENT_PREVIEW_MAX_BYTES,
    created_at: stat.birthtime.toISOString(),
    updated_at: stat.mtime.toISOString(),
    download_url: `/api/crazor/contacts/${encodedContactId}/attachments/${encodedName}`,
    preview_url: `/api/crazor/contacts/${encodedContactId}/attachments/${encodedName}/preview`,
  }
}

function listContactAttachments(contactId: string) {
  const dir = contactAttachmentsDir(contactId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name !== '.DS_Store')
    .flatMap((name) => {
      const filePath = resolve(dir, name)
      try {
        const stat = statSync(filePath)
        if (!stat.isFile()) return []
        return [contactAttachmentResponse(contactId, name, stat)]
      } catch {
        return []
      }
    })
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
}

function buildDocSearchSnippet(content: string, query: string): string {
  const text = String(content || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const q = query.trim().toLowerCase()
  if (!q) return text.slice(0, 160)
  const index = text.toLowerCase().indexOf(q)
  if (index < 0) return text.slice(0, 160)
  const start = Math.max(0, index - 50)
  const end = Math.min(text.length, index + q.length + 90)
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`
}

// --- Health ---
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'crazor-api' }))

const WECHAT_LOGIN_SESSION_TTL_MS = 10 * 60 * 1000
const wechatLoginSessions = new Map<string, {
  createdAt: number
  token?: string
  nickname?: string
  avatarUrl?: string
}>()

function rememberWechatLoginSession(state: string) {
  pruneWechatLoginSessions()
  wechatLoginSessions.set(state, { createdAt: Date.now() })
}

function completeWechatLoginSession(state: string, data: { token: string; nickname?: string; avatarUrl?: string }) {
  const current = wechatLoginSessions.get(state)
  if (!current) return
  wechatLoginSessions.set(state, {
    ...current,
    token: data.token,
    nickname: data.nickname,
    avatarUrl: data.avatarUrl,
  })
}

function readWechatLoginSession(state: string) {
  pruneWechatLoginSessions()
  return wechatLoginSessions.get(state) || null
}

function pruneWechatLoginSessions() {
  const cutoff = Date.now() - WECHAT_LOGIN_SESSION_TTL_MS
  for (const [state, session] of wechatLoginSessions.entries()) {
    if (session.createdAt < cutoff) wechatLoginSessions.delete(state)
  }
}

function backendOrigin(c: any): string {
  return new URL(c.req.url).origin
}

// --- Agent Provider Adapter ---
app.get('/api/agent/provider', async (c) => {
  return c.json(await getAgentProviderRuntimeDescriptor())
})

app.get('/api/agent/provider/capabilities', (c) => {
  const provider = getAgentProviderDescriptor()
  return c.json({
    provider: provider.id,
    kind: provider.kind,
    capabilities: provider.capabilities,
    capability_ids: provider.capability_ids,
  })
})

// --- Auth routes (public, no auth middleware) ---
app.get('/api/auth/wechat/url', (c) => {
  if (!WECHAT_APP_ID) {
    return c.json({ error: 'WeChat login not configured' }, 500)
  }
  const state = generateState()
  rememberWechatLoginSession(state)
  const redirectUri = `${backendOrigin(c)}/api/auth/wechat/callback`
  const url = getWechatLoginUrl(state, redirectUri)
  return c.json({ url, state })
})

app.get('/api/auth/wechat/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')

  if (!code) {
    return c.json({ error: 'Missing code parameter' }, 400)
  }

  try {
    const wechatInfo = await exchangeCodeForToken(code)
    const user = upsertUser(wechatInfo)
    const token = signJWT({ openid: wechatInfo.openid, nickname: wechatInfo.nickname || user.nickname })
    completeWechatLoginSession(String(state || ''), {
      token,
      nickname: wechatInfo.nickname || user.nickname,
      avatarUrl: wechatInfo.avatar_url || user.avatar_url || '',
    })

    // Set JWT as httpOnly cookie and redirect to frontend
    c.header('Set-Cookie', `crazor_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`, { append: true })

    return c.html(`<!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Crazor 登录成功</title>
          <style>
            body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
            main{max-width:420px;padding:40px;text-align:center}
            h1{font-size:24px;margin:0 0 12px}
            p{margin:0;color:#cbd5e1;line-height:1.8}
          </style>
        </head>
        <body>
          <main>
            <h1>登录成功</h1>
            <p>你可以回到 Crazor 客户端继续使用，本页面可以关闭。</p>
          </main>
        </body>
      </html>`)
  } catch (e: any) {
    console.error('[auth] WeChat callback error:', e.message)
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/auth/wechat/session/:state', (c) => {
  const state = c.req.param('state')
  const session = readWechatLoginSession(state)
  if (!session) return c.json({ loggedIn: false, expired: true })
  if (!session.token) return c.json({ loggedIn: false, expired: false })
  return c.json({
    loggedIn: true,
    token: session.token,
    nickname: session.nickname || '',
    avatarUrl: session.avatarUrl || '',
  })
})

app.post('/api/auth/logout', (c) => {
  c.header('Set-Cookie', 'crazor_token=; Path=/; HttpOnly; Max-Age=0', { append: true })
  return c.json({ ok: true })
})

app.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7)
    : c.req.query('token')
    || (() => { try { return getCookieVal(c, 'crazor_token') } catch { return null } })()

  if (!token) {
    return c.json({ loggedIn: false })
  }

  try {
    const payload = verifyJWT(token)
    return c.json({
      loggedIn: true,
      nickname: payload.nickname,
      plan: DEPLOYMENT_TIER,
    })
  } catch {
    return c.json({ loggedIn: false })
  }
})

app.get('/api/auth/status', (c) => {
  return c.json({
    bound: isUserBound(),
    wechatConfigured: !!WECHAT_APP_ID,
    plan: DEPLOYMENT_TIER,
  })
})

app.get('/api/auth/plan', (c) => {
  return c.json({ plan: DEPLOYMENT_TIER })
})

// Helper: get cookie value without hono/cookie dependency issues
function getCookieVal(c: any, name: string): string | null {
  const header = c.req?.header?.('cookie') || ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? match[1] : null
}

// --- Auth middleware (applied after auth routes, before business routes) ---
app.use('*', authMiddleware)

// --- MCP SSE endpoint (legacy, for SSE-only clients) ---
app.get('/mcp/sse', (c) => handleSSEConnect())
app.post('/mcp/sse', async (c) => {
  const body = await c.req.json()
  const sessionIdParam = c.req.query('sessionId')
  const response = await handleSSEMessage(body, sessionIdParam, resolveMcpRequestActor(c))
  if (response === null) return c.json({})
  return c.json(response)
})

// --- MCP StreamableHTTP endpoint (for Hermes Agent / MCP SDK clients) ---
app.post('/mcp', async (c) => {
  const body = await c.req.json()
  const sessionHeader = c.req.header('mcp-session-id') || null
  return handleStreamableHTTP(body, sessionHeader, resolveMcpRequestActor(c))
})

// Handle DELETE for session cleanup (optional, MCP spec)
app.delete('/mcp', async (c) => {
  const sessionHeader = c.req.header('mcp-session-id')
  if (sessionHeader) {
    // Session cleanup would go here if needed
    return c.json({ ok: true })
  }
  return c.json({ ok: true })
})

// --- Agent Gateway Proxy (Hermes-compatible OpenAI API) ---
// Chat completions with SSE streaming
app.post('/api/chat/completions', async (c) => {
  const body = await c.req.json()
  const upstreamUrl = `${AGENT_GATEWAY_URL}/v1/chat/completions`

  const resp = await fetch(upstreamUrl, {
    method: 'POST',
    headers: agentGatewayHeaders(),
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    const error = parseUpstreamError(text)
    return c.json({ error: error.message, detail: error.detail }, resp.status as 500)
  }

  // Check if streaming
  if (body.stream) {
    // SSE passthrough
    return stream(c, async (stream) => {
      c.header('Content-Type', 'text/event-stream')
      c.header('Cache-Control', 'no-cache')
      c.header('Connection', 'keep-alive')
      c.header('X-Accel-Buffering', 'no')

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        await stream.write(decoder.decode(value, { stream: true }))
      }
    })
  }

  // Non-streaming: just forward JSON
  const sessionId = resp.headers.get('x-hermes-session-id')
  if (sessionId) c.header('X-Hermes-Session-Id', sessionId)
  const data = await resp.json()
  return c.json(data)
})

// Responses API (alternative chat endpoint)
app.post('/api/responses', async (c) => {
  const body = await c.req.json()
  const upstreamUrl = `${AGENT_GATEWAY_URL}/v1/responses`

  if (body.stream) {
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')
    c.header('X-Accel-Buffering', 'no')

    return stream(c, async (stream) => {
      await stream.write(': connected\n\n')

      let resp: Response
      try {
        resp = await fetch(upstreamUrl, {
          method: 'POST',
          headers: agentGatewayHeaders(),
          body: JSON.stringify(body),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Hermes Responses API connection failed'
        await stream.write(responseFailedEvent(message))
        return
      }

      if (!resp.ok) {
        const text = await resp.text()
        const error = parseUpstreamError(text)
        await stream.write(responseFailedEvent(error.message, error.detail))
        return
      }

      const reader = resp.body?.getReader()
      if (!reader) {
        await stream.write(responseFailedEvent('Hermes Responses API returned an empty stream'))
        return
      }

      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await stream.write(decoder.decode(value, { stream: true }))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Hermes Responses API stream interrupted'
        await stream.write(responseFailedEvent(message))
      } finally {
        reader.releaseLock()
      }
    })
  }

  const resp = await fetch(upstreamUrl, {
    method: 'POST',
    headers: agentGatewayHeaders(),
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    const error = parseUpstreamError(text)
    return c.json({ error: error.message, detail: error.detail }, resp.status as 500)
  }

  const sessionId = resp.headers.get('x-hermes-session-id')
  if (sessionId) c.header('X-Hermes-Session-Id', sessionId)
  const data = await resp.json()
  return c.json(data)
})

// Models
app.get('/api/models', async (c) => {
  const resp = await fetch(`${AGENT_GATEWAY_URL}/v1/models`, { headers: agentGatewayHeaders() })
  const data = await resp.json()
  return c.json(data)
})

// Cron jobs (Agent Gateway provider)
app.get('/api/cron', async (c) => {
  try {
    const resp = await fetch(`${AGENT_GATEWAY_URL}/api/jobs?include_disabled=true`, { headers: agentGatewayHeaders() })
    const data = await resp.json()
    return c.json(data)
  } catch {
    return c.json([])
  }
})

app.post('/api/cron', async (c) => {
  const body = await c.req.json()
  const resp = await fetch(`${AGENT_GATEWAY_URL}/api/jobs`, {
    method: 'POST',
    headers: agentGatewayHeaders(),
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return c.json(data, resp.status as 200)
})

app.post('/api/cron/:id/pause', async (c) => {
  const resp = await fetch(`${AGENT_GATEWAY_URL}/api/jobs/${c.req.param('id')}/pause`, { method: 'POST', headers: agentGatewayHeaders() })
  return c.json(await resp.json())
})

app.post('/api/cron/:id/resume', async (c) => {
  const resp = await fetch(`${AGENT_GATEWAY_URL}/api/jobs/${c.req.param('id')}/resume`, { method: 'POST', headers: agentGatewayHeaders() })
  return c.json(await resp.json())
})

app.post('/api/cron/:id/run', async (c) => {
  const resp = await fetch(`${AGENT_GATEWAY_URL}/api/jobs/${c.req.param('id')}/run`, { method: 'POST', headers: agentGatewayHeaders() })
  return c.json(await resp.json())
})

app.delete('/api/cron/:id', async (c) => {
  const resp = await fetch(`${AGENT_GATEWAY_URL}/api/jobs/${c.req.param('id')}`, { method: 'DELETE', headers: agentGatewayHeaders() })
  return c.json(await resp.json())
})

// --- Hermes Dashboard Proxy (port 9119) ---
// Sessions
app.get('/api/sessions', async (c) => {
  const resp = await gatewayFetch(`/api/sessions?limit=100`)
  if (!resp.ok) return proxyJsonResponse(c, resp)
  return c.json(normalizeGatewaySessionList(await resp.json()))
})

app.get('/api/sessions/search', async (c) => {
  const q = c.req.query('q') || ''
  const resp = await gatewayFetch(`/api/sessions?limit=100`)
  if (!resp.ok) return proxyJsonResponse(c, resp)
  const sessions = normalizeGatewaySessionList(await resp.json())
  const normalizedQuery = q.trim().toLowerCase()
  return c.json(
    normalizedQuery
      ? sessions.filter((session) => cleanString(session.title).toLowerCase().includes(normalizedQuery))
      : sessions
  )
})

app.get('/api/sessions/:id', async (c) => {
  const resp = await gatewayFetch(`/api/sessions/${encodeURIComponent(c.req.param('id'))}`)
  if (!resp.ok) return proxyJsonResponse(c, resp)
  return c.json(normalizeGatewaySession(await resp.json()))
})

app.get('/api/sessions/:id/messages', async (c) => {
  const resp = await gatewayFetch(`/api/sessions/${encodeURIComponent(c.req.param('id'))}/messages`)
  if (!resp.ok) return proxyJsonResponse(c, resp)
  const payload = asRecord(await resp.json())
  return c.json(Array.isArray(payload.data) ? payload.data : [])
})

app.delete('/api/sessions/:id', async (c) => {
  const sessionId = c.req.param('id')
  const resp = await gatewayFetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
  sessionResponseIds.delete(sessionId)
  sessionPinnedIds.delete(sessionId)
  sessionModelOverrides.delete(sessionId)
  return proxyJsonResponse(c, resp)
})

// Config
app.get('/api/config', async (c) => {
  const resp = await dashboardFetch(`/api/config`)
  const data = await resp.json()
  return c.json(data)
})

app.get('/api/config/raw', async (c) => {
  const resp = await dashboardFetch(`/api/config/raw`)
  const data = await resp.json()
  return c.json(data)
})

app.patch('/api/config', async (c) => {
  const body = asRecord(await c.req.json())

  if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) {
    const resp = await dashboardFetch(`/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: body.config }),
    })
    return proxyJsonResponse(c, resp)
  }

  const provider = readFirstString(body, ['provider'])
  const model = readFirstString(body, ['model'])
  const baseUrl = readFirstString(body, ['baseUrl', 'base_url'])
  const apiKey = readFirstString(body, ['apiKey', 'api_key'])
  const apiMode = readFirstString(body, ['apiMode', 'api_mode'])
  const hasBaseUrl = hasOwn(body, 'baseUrl') || hasOwn(body, 'base_url')
  const hasApiKey = hasOwn(body, 'apiKey') || hasOwn(body, 'api_key')
  const hasApiMode = hasOwn(body, 'apiMode') || hasOwn(body, 'api_mode')
  const clearFields = readClearFields(body)
  const contextLength = readContextLength(body)

  if ((provider || model) && shouldUseModelSet(provider, body, contextLength)) {
    const resp = await dashboardFetch(`/api/model/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'main',
        provider,
        model,
      }),
    })
    return proxyJsonResponse(c, resp)
  }

  const configResp = await dashboardFetch(`/api/config`)
  if (!configResp.ok) return proxyJsonResponse(c, configResp)

  const infoResp = await dashboardFetch(`/api/model/info`)
  const currentConfig = asRecord(await configResp.json())
  const currentModelInfo = infoResp.ok ? asRecord(await infoResp.json()) : {}
  const currentModelBlock = await loadDashboardModelBlock()
  const nextConfig: Record<string, unknown> = { ...currentConfig }
  const existingModel = {
    ...currentModelBlock,
    ...asRecord(nextConfig.model),
  }
  const nextModel: Record<string, unknown> = { ...existingModel }

  const resolvedProvider = clearFields.has('provider')
    ? ''
    : provider || cleanString(nextModel.provider) || cleanString(currentModelInfo.provider) || 'auto'
  const resolvedModel = clearFields.has('model')
    ? ''
    : model || cleanString(nextModel.default) || cleanString(nextModel.model) || cleanString(currentModelInfo.model) || cleanString(currentConfig.model)

  nextModel.provider = resolvedProvider
  nextModel.default = resolvedModel
  if (clearFields.has('baseUrl') || clearFields.has('base_url')) {
    nextModel.base_url = ''
  } else if (hasBaseUrl && baseUrl) {
    nextModel.base_url = baseUrl
  }
  if (clearFields.has('apiKey') || clearFields.has('api_key')) {
    nextModel.api_key = ''
  } else if (hasApiKey && apiKey) {
    nextModel.api_key = apiKey
  }
  if (clearFields.has('apiMode') || clearFields.has('api_mode')) {
    delete nextModel.api_mode
  } else if (hasApiMode && apiMode) {
    nextModel.api_mode = apiMode
  }
  const inferredApiMode = inferApiMode(resolvedProvider, resolvedModel, nextModel.api_mode)
  if (inferredApiMode) nextModel.api_mode = inferredApiMode
  if (contextLength.hasValue) {
    if (contextLength.value > 0) {
      nextModel.context_length = contextLength.value
    } else {
      delete nextModel.context_length
    }
  }
  nextConfig.model = nextModel
  if (contextLength.hasValue) nextConfig.model_context_length = contextLength.value

  const resp = await dashboardFetch(`/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: nextConfig }),
  })
  return proxyJsonResponse(c, resp)
})

// Skills
app.get('/api/skills', async (c) => {
  const resp = await dashboardFetch(`/api/skills`)
  const data = await resp.json()
  return c.json(data)
})

app.get('/api/tools/toolsets', async (c) => {
  const resp = await dashboardFetch(`/api/tools/toolsets`)
  const data = await resp.json()
  return c.json(data)
})

// Models
app.get('/api/model/info', async (c) => {
  const resp = await dashboardFetch(`/api/model/info`)
  const data = asRecord(await resp.json())
  const modelBlock = await loadDashboardModelBlock()
  const baseUrl = cleanString(modelBlock.base_url)
  const apiKey = cleanString(modelBlock.api_key)
  const apiMode = cleanString(modelBlock.api_mode)

  if (baseUrl) data.baseUrl = baseUrl
  if (apiMode) data.apiMode = apiMode
  data.apiKeySet = Boolean(apiKey)
  return c.json(data)
})

app.get('/api/model/options', async (c) => {
  const resp = await dashboardFetch(`/api/model/options`)
  const data = await resp.json()
  return c.json(data)
})

app.post('/api/model/set', async (c) => {
  const body = asRecord(await c.req.json())
  if (!cleanString(body.scope)) body.scope = 'main'
  const resp = await dashboardFetch(`/api/model/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return proxyJsonResponse(c, resp)
})

// Env vars
app.get('/api/env', async (c) => {
  const resp = await dashboardFetch(`/api/env`)
  const data = await resp.json()
  return c.json(data)
})

async function setDashboardEnvVar(c: any) {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/env`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return proxyJsonResponse(c, resp)
}

app.post('/api/env', setDashboardEnvVar)
app.put('/api/env', setDashboardEnvVar)

app.delete('/api/env/:key', async (c) => {
  const resp = await dashboardFetch(`/api/env`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: c.req.param('key') }),
  })
  return proxyJsonResponse(c, resp)
})

// Gateway status
app.get('/api/status', async (c) => {
  const resp = await dashboardFetch(`/api/status`)
  const data = await resp.json()
  return c.json(data)
})

app.post('/api/gateway/restart', async (c) => {
  const resp = await dashboardFetch(`/api/gateway/restart`, { method: 'POST' })
  return c.json({ ok: true })
})

// Hermes version
app.get('/api/hermes/version', async (c) => {
  try {
    const resp = await dashboardFetch(`/api/status`)
    const data = await resp.json()
    return c.json({
      status: data.gateway_running ? 'ok' : 'offline',
      version: data.version || 'unknown',
      release_date: data.release_date || '',
      gateway_running: data.gateway_running || false,
      platform: 'hermes-agent',
    })
  } catch {
    return c.json({ status: 'offline', version: 'unknown' })
  }
})

// --- Sessions (write operations) ---
// Session writes go through Agent Gateway. Dashboard remains read/config only.

app.post('/api/sessions', async (c) => {
  const body = await c.req.json()
  const resp = await gatewayFetch(`/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: body?.title,
      model: body?.model,
    }),
  })
  if (!resp.ok) return proxyJsonResponse(c, resp)

  const session = normalizeGatewaySession(await resp.json())
  if (session.id && body?.model !== undefined) {
    sessionModelOverrides.set(String(session.id), body.model || null)
    session.model = body.model || null
  }
  return c.json(session, resp.status as 201)
})

app.patch('/api/sessions/:id', async (c) => {
  const sessionId = c.req.param('id')
  const body = await c.req.json()
  const patchBody: Record<string, unknown> = {}

  if (Object.prototype.hasOwnProperty.call(body, 'response_id')) {
    sessionResponseIds.set(sessionId, body.response_id ? String(body.response_id) : null)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'model')) {
    sessionModelOverrides.set(sessionId, body.model ? String(body.model) : null)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    patchBody.title = body.title
  }
  if (Object.prototype.hasOwnProperty.call(body, 'end_reason')) {
    patchBody.end_reason = body.end_reason
  }

  if (Object.keys(patchBody).length === 0) {
    const resp = await gatewayFetch(`/api/sessions/${encodeURIComponent(sessionId)}`)
    if (!resp.ok) return proxyJsonResponse(c, resp)
    return c.json(normalizeGatewaySession(await resp.json()))
  }

  const resp = await gatewayFetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchBody),
  })
  if (!resp.ok) return proxyJsonResponse(c, resp)
  return c.json(normalizeGatewaySession(await resp.json()))
})

app.post('/api/sessions/:id/pin', async (c) => {
  const sessionId = c.req.param('id')
  if (sessionPinnedIds.has(sessionId)) {
    sessionPinnedIds.delete(sessionId)
  } else {
    sessionPinnedIds.add(sessionId)
  }
  const resp = await gatewayFetch(`/api/sessions/${encodeURIComponent(sessionId)}`)
  if (!resp.ok) return proxyJsonResponse(c, resp)
  return c.json(normalizeGatewaySession(await resp.json()))
})

app.post('/api/sessions/:id/messages', async (c) => {
  return c.json({ ok: true, session_id: c.req.param('id') })
})

// --- Skills (detail, toggle, market, install, uninstall, update) ---

const SKILLS_INDEX_URL = 'https://hermes-agent.nousresearch.com/docs/api/skills-index.json'
const DEFAULT_MARKET_SKILLS_LIMIT = 500
const MAX_MARKET_SKILLS_LIMIT = 1000
let _skillsCache: { data: any[]; fetchedAt: number } | null = null

function marketSkillsLimit(rawLimit: string | undefined): number {
  const parsed = Number.parseInt(rawLimit || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MARKET_SKILLS_LIMIT
  return Math.min(parsed, MAX_MARKET_SKILLS_LIMIT)
}

function compactMarketString(value: unknown, maxLength = 240): string {
  const text = String(value || '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

function compactMarketTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function compactMarketSkill(skill: any) {
  const identifier = compactMarketString(skill?.identifier || skill?.id || skill?.name || skill?.path, 180)
  const path = compactMarketString(skill?.path, 180)
  const source = compactMarketString(skill?.source || 'market', 40)
  const tags = compactMarketTags(skill?.tags)
  const category = compactMarketString(skill?.category || path.split('/')[0] || tags[0] || source || 'general', 80)
  const fallbackName = identifier.split('/').filter(Boolean).pop() || 'unnamed-skill'
  const name = compactMarketString(skill?.name || skill?.label || fallbackName, 120)

  return {
    name,
    label: compactMarketString(skill?.label || name, 120),
    description: compactMarketString(skill?.description || skill?.summary, 280),
    source,
    identifier,
    trust_level: compactMarketString(skill?.trust_level || skill?.trustLevel, 60),
    repo: compactMarketString(skill?.repo, 180),
    path,
    category,
    tags,
    installed: Boolean(skill?.installed),
  }
}

function compactMarketSkills(payload: any): any[] {
  const rawSkills = Array.isArray(payload) ? payload : Array.isArray(payload?.skills) ? payload.skills : []
  return rawSkills
    .map(compactMarketSkill)
    .filter(skill => skill.identifier && skill.name)
    .slice(0, MAX_MARKET_SKILLS_LIMIT)
}

app.get('/api/skills/market', async (c) => {
  const limit = marketSkillsLimit(c.req.query('limit'))
  try {
    // Cache for 10 minutes
    if (_skillsCache && Date.now() - _skillsCache.fetchedAt < 600_000) {
      return c.json(_skillsCache.data.slice(0, limit))
    }
    const resp = await fetch(SKILLS_INDEX_URL, { headers: { 'Accept': 'application/json' } })
    if (!resp.ok) return c.json([])
    const payload = await resp.json()
    const skills = compactMarketSkills(payload)
    _skillsCache = { data: skills, fetchedAt: Date.now() }
    return c.json(skills.slice(0, limit))
  } catch {
    return c.json((_skillsCache?.data ?? []).slice(0, limit))
  }
})

app.get('/api/skills/market/:identifier', async (c) => {
  try {
    return c.json(await safeDashboardJson(c, `/api/skills/market/${c.req.param('identifier')}`, {}, {}))
  } catch { return c.json({}) }
})

app.get('/api/skills/:name', async (c) => {
  const resp = await dashboardFetch(`/api/skills/${c.req.param('name')}`)
  const data = await resp.json()
  return c.json(data)
})

app.patch('/api/skills/:name', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/skills/${c.req.param('name')}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
})

app.post('/api/skills/install', async (c) => {
  try {
    const body = await c.req.json()
    const resp = await dashboardFetch(`/api/skills/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch { return c.json({ error: 'install not available' }) }
})

app.post('/api/skills/uninstall', async (c) => {
  try {
    const body = await c.req.json()
    const resp = await dashboardFetch(`/api/skills/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch { return c.json({ error: 'uninstall not available' }) }
})

app.post('/api/skills/check-updates', async (c) => {
  try {
    const body = await c.req.json()
    const resp = await dashboardFetch(`/api/skills/check-updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch { return c.json({ updates: [] }) }
})

app.post('/api/skills/update', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/skills/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
})

// --- Hermes update ---

// --- Hermes update ---
app.post('/api/hermes/update', async (c) => {
  const resp = await dashboardFetch(`/api/hermes/update`, { method: 'POST' })
  return c.json(await resp.json())
})

// --- Cron dependency ---
app.get('/api/cron/dependency', async (c) => {
  const resp = await dashboardFetch(`/api/cron/dependency`)
  return c.json(await resp.json())
})

app.post('/api/cron/dependency/install', async (c) => {
  const resp = await dashboardFetch(`/api/cron/dependency/install`, { method: 'POST' })
  return c.json(await resp.json())
})

// --- Gateway / Dashboard control ---
app.post('/api/gateway/stop', async (c) => {
  const resp = await dashboardFetch(`/api/gateway/stop`, { method: 'POST' })
  return c.json({ ok: true })
})

app.post('/api/dashboard/stop', async (c) => {
  const resp = await dashboardFetch(`/api/dashboard/stop`, { method: 'POST' })
  return c.json({ ok: true })
})

// --- Logs ---
app.get('/api/logs', async (c) => {
  const file = c.req.query('file') || 'agent'
  const lines = c.req.query('lines') || '100'
  const level = c.req.query('level') || 'ALL'
  const component = c.req.query('component') || 'all'
  const resp = await dashboardFetch(`/api/logs?file=${file}&lines=${lines}&level=${level}&component=${component}`)
  const data = await resp.json()
  return c.json(data)
})

// --- Env reveal ---
app.get('/api/env/:key/reveal', async (c) => {
  const resp = await dashboardFetch(`/api/env/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: c.req.param('key') }),
  })
  return proxyJsonResponse(c, resp)
})

// --- Memories (Dashboard :9119) ---
app.get('/api/memories', async (c) => {
  const workspace = c.req.query('workspace') || ''
  const url = workspace
    ? `/api/memories?workspace=${encodeURIComponent(workspace)}`
    : `/api/memories`
  return c.json(await safeDashboardJson(c, url, {}, []))
})

app.post('/api/memories', async (c) => {
  const body = await c.req.json()
  try {
    const resp = await dashboardFetch(`/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch { return c.json({ ok: true }) }
})

app.patch('/api/memories/:id', async (c) => {
  const body = await c.req.json()
  try {
    const resp = await dashboardFetch(`/api/memories/${c.req.param('id')}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch { return c.json({ ok: true }) }
})

app.delete('/api/memories/:id', async (c) => {
  try { await dashboardFetch(`/api/memories/${c.req.param('id')}`, { method: 'DELETE' }) } catch {}
  return c.json({ ok: true })
})

app.post('/api/memories/compact', async (c) => {
  try {
    const resp = await dashboardFetch(`/api/memories/compact`, { method: 'POST' })
    return c.json(await resp.json())
  } catch { return c.json({ ok: true }) }
})

// --- Tasks (Dashboard :9119) ---
app.get('/api/tasks', async (c) => {
  const workspace = c.req.query('workspace') || ''
  const url = workspace
    ? `/api/tasks?workspace=${encodeURIComponent(workspace)}`
    : `/api/tasks`
  return c.json(await safeDashboardJson(c, url, {}, []))
})

app.post('/api/tasks', async (c) => {
  const body = await c.req.json()
  try {
    const resp = await dashboardFetch(`/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch { return c.json({ ok: true }) }
})

app.patch('/api/tasks/:id', async (c) => {
  const body = await c.req.json()
  try {
    const resp = await dashboardFetch(`/api/tasks/${c.req.param('id')}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch { return c.json({ ok: true }) }
})

app.delete('/api/tasks/:id', async (c) => {
  try { await dashboardFetch(`/api/tasks/${c.req.param('id')}`, { method: 'DELETE' }) } catch {}
  return c.json({ ok: true })
})

// --- Agents (Dashboard :9119) ---
app.get('/api/agents', async (c) => {
  return c.json(await safeDashboardJson(c, '/api/agents', {}, [
    { id: 'hermes-agent', name: 'Hermes Agent', description: '默认通用智能体' }
  ]))
})

// --- Channels (Dashboard :9119) ---
app.get('/api/channels', async (c) => {
  return c.json(await safeDashboardJson(c, '/api/channels', {}, {}))
})

app.patch('/api/channels', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/channels`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json({ ok: true })
})

app.post('/api/channels/weixin/qrcode', async (c) => {
  const resp = await dashboardFetch(`/api/channels/weixin/qrcode`, { method: 'POST' })
  return c.json(await resp.json())
})

app.post('/api/channels/weixin/qrcode/status', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/channels/weixin/qrcode/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
})

app.post('/api/channels/qqbot/qrcode', async (c) => {
  const resp = await dashboardFetch(`/api/channels/qqbot/qrcode`, { method: 'POST' })
  return c.json(await resp.json())
})

app.post('/api/channels/qqbot/qrcode/status', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/channels/qqbot/qrcode/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
})

app.post('/api/channels/whatsapp/qrcode', async (c) => {
  const resp = await dashboardFetch(`/api/channels/whatsapp/qrcode`, { method: 'POST' })
  return c.json(await resp.json())
})

// --- Hermes Config (USER.md, SOUL.md, MEMORY.md) ---
app.get('/api/hermes-config/user', async (c) => {
  return c.json(await safeDashboardJson(c, '/api/hermes-config/user', {}, ''))
})

app.post('/api/hermes-config/user', async (c) => {
  const body = await c.req.json()
  try {
    await dashboardFetch(`/api/hermes-config/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {}
  return c.json({ ok: true })
})

app.get('/api/hermes-config/soul', async (c) => {
  return c.json(await safeDashboardJson(c, '/api/hermes-config/soul', {}, ''))
})

app.post('/api/hermes-config/soul', async (c) => {
  const body = await c.req.json()
  try {
    await dashboardFetch(`/api/hermes-config/soul`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {}
  return c.json({ ok: true })
})

app.get('/api/hermes-config/memory', async (c) => {
  return c.json(await safeDashboardJson(c, '/api/hermes-config/memory', {}, ''))
})

// --- Files (Dashboard :9119) ---
app.get('/api/files/list', async (c) => {
  const filePath = c.req.query('path') || ''
  const workspace = c.req.query('workspace') || ''
  const url = workspace
    ? `/api/files/list?path=${encodeURIComponent(filePath)}&workspace=${encodeURIComponent(workspace)}`
    : `/api/files/list?path=${encodeURIComponent(filePath)}`
  return c.json(await safeDashboardJson(c, url, {}, []))
})

app.get('/api/files/read', async (c) => {
  const filePath = c.req.query('path') || ''
  const workspace = c.req.query('workspace') || ''
  const url = workspace
    ? `/api/files/read?path=${encodeURIComponent(filePath)}&workspace=${encodeURIComponent(workspace)}`
    : `/api/files/read?path=${encodeURIComponent(filePath)}`
  return c.json(await safeDashboardJson(c, url, {}, ''))
})

app.get('/api/files/preview', async (c) => {
  const filePath = c.req.query('path') || ''
  const workspace = c.req.query('workspace') || ''
  const url = workspace
    ? `/api/files/preview?path=${encodeURIComponent(filePath)}&workspace=${encodeURIComponent(workspace)}`
    : `/api/files/preview?path=${encodeURIComponent(filePath)}`
  return c.json(await safeDashboardJson(c, url, {}, {}))
})

app.post('/api/files/open', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/files/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
})

app.post('/api/files/write', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/files/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json({ ok: true })
})

app.delete('/api/files', async (c) => {
  const filePath = c.req.query('path') || ''
  const workspace = c.req.query('workspace') || ''
  const apiUrl = workspace
    ? `/api/files?path=${encodeURIComponent(filePath)}&workspace=${encodeURIComponent(workspace)}`
    : `/api/files?path=${encodeURIComponent(filePath)}`
  const resp = await dashboardFetch(apiUrl, { method: 'DELETE' })
  return c.json({ ok: true })
})

app.post('/api/files/mkdir', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/files/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json({ ok: true })
})

app.post('/api/files/attachment', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/files/attachment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
})

app.post('/api/files/import', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/files/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
})

// --- Workspaces (local stubs — will be backed by SQLite later) ---
// For now, return minimal defaults to keep frontend working
const DEFAULT_WORKSPACES = [
  {
    id: 'default',
    name: '默认工作区',
    path: '~/AI/hermes-workspace',
    icon: '📁',
  },
]

app.get('/api/workspaces', async (c) => {
  return c.json(DEFAULT_WORKSPACES)
})

app.get('/api/workspaces/current', async (c) => {
  return c.json(DEFAULT_WORKSPACES[0])
})

app.post('/api/workspaces/current', async (c) => {
  return c.json({ ok: true })
})

app.post('/api/workspaces', async (c) => {
  const body = await c.req.json()
  return c.json({ id: `ws-${Date.now()}`, ...body })
})

app.patch('/api/workspaces/:id', async (c) => {
  const body = await c.req.json()
  return c.json({ id: c.req.param('id'), ...body })
})

app.delete('/api/workspaces/:id', async (c) => {
  return c.json(DEFAULT_WORKSPACES)
})

// --- Terminal sessions (local stubs) ---
app.post('/api/terminal/sessions', async (c) => {
  return c.json({ sessionId: `term-${Date.now()}` })
})

app.post('/api/terminal/sessions/:id/input', async (c) => {
  return c.json({ ok: true })
})

app.post('/api/terminal/sessions/:id/resize', async (c) => {
  return c.json({ ok: true })
})

app.delete('/api/terminal/sessions/:id', async (c) => {
  return c.json({ ok: true })
})

// --- Error handler ---
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message)
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  return c.json({ error: 'Internal server error' }, 500)
})

// ==========================================================================
// Crazor business data routes (SQLite + local files, no Dashboard dependency)
// ==========================================================================

app.get('/api/crazor/audit-logs', (c) => {
  const entity = c.req.query('entity')
  const entity_id = c.req.query('entity_id')
  const actor_id = c.req.query('actor_id')
  const limit = Number(c.req.query('limit') || 100)
  return c.json(listAuditLogs({
    entity: entity || undefined,
    entity_id: entity_id || undefined,
    actor_id: actor_id || undefined,
    limit,
  }))
})

app.get('/api/crazor/identity/me', (c) => {
  return c.json(resolveRequestActor(c))
})

app.get('/api/crazor/identity/members', (c) => {
  return c.json(listTeamMembers())
})

app.post('/api/crazor/identity/members', async (c) => {
  const body = await c.req.json()
  if (!body.name) return c.json({ error: 'name is required' }, 400)
  return c.json(createTeamMember({
    name: body.name,
    actor_type: body.actor_type || 'human',
    role: body.role || 'member',
    status: body.status || 'active',
  }), 201)
})

app.patch('/api/crazor/identity/members/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateTeamMember(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.delete('/api/crazor/identity/members/:id', (c) => {
  deleteTeamMember(c.req.param('id'))
  return c.json({ ok: true, id: c.req.param('id') })
})

app.get('/api/crazor/identity/tokens', (c) => {
  const member_id = c.req.query('member_id')
  const status = c.req.query('status')
  return c.json(listActorTokens({
    member_id: member_id || undefined,
    status: status || undefined,
  }))
})

app.post('/api/crazor/identity/tokens', async (c) => {
  const body = await c.req.json()
  if (!body.member_id) return c.json({ error: 'member_id is required' }, 400)
  try {
    return c.json(createActorToken({
      member_id: body.member_id,
      label: body.label || '',
      token_type: body.token_type || 'api',
      scopes: body.scopes,
    }), 201)
  } catch (err: any) {
    return c.json({ error: err?.message || 'failed to create token' }, 404)
  }
})

app.delete('/api/crazor/identity/tokens/:id', (c) => {
  const revoked = revokeActorToken(c.req.param('id'))
  if (!revoked) return c.json({ error: 'not found' }, 404)
  return c.json(revoked)
})

// --- Contacts ---
app.get('/api/crazor/contacts', (c) => {
  const status = c.req.query('status')
  const q = c.req.query('q')
  return c.json(listContacts({ status: status || undefined, q: q || undefined }))
})

app.get('/api/crazor/contacts/:id', (c) => {
  const contact = getContact(c.req.param('id'))
  if (!contact) return c.json({ error: 'not found' }, 404)
  return c.json(contact)
})

app.post('/api/crazor/contacts', async (c) => {
  const body = await c.req.json()
  if (!body.name) return c.json({ error: 'name is required' }, 400)
  const contact = createContact(body)
  // Auto-create a folder in knowledge tree for this contact
  docTree.ensureContactFolder(contact.id, contact.name)
  return c.json(contact, 201)
})

app.patch('/api/crazor/contacts/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateContact(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.delete('/api/crazor/contacts/:id', (c) => {
  deleteContact(c.req.param('id'))
  return c.json({ ok: true })
})

// --- Contact docs (Markdown) ---
app.get('/api/crazor/contacts/:id/docs/search', (c) => {
  const contactId = c.req.param('id')
  const q = (c.req.query('q') || '').trim()
  const lower = q.toLowerCase()

  const treeDocs = docTree.listNotesByContact('knowledge', contactId).flatMap((note: any) => {
    const fullNote = docTree.getNote(note.id)
    if (!fullNote) return []
    const title = String(fullNote.title || note.title || '')
    const content = String(fullNote.content || '')
    if (lower && !title.toLowerCase().includes(lower) && !content.toLowerCase().includes(lower)) return []
    return [{
      ...note,
      title,
      source: 'knowledge',
      snippet: buildDocSearchSnippet(content, q),
      updated_at: fullNote.updated_at || note.updated_at,
    }]
  })

  const legacyDocs = docs.listContactDocs(contactId).flatMap((doc: any) => {
    const content = docs.readDoc(doc.path) || ''
    const title = String(doc.name?.replace(/\.md$/, '') || doc.path || '')
    if (lower && !title.toLowerCase().includes(lower) && !content.toLowerCase().includes(lower)) return []
    return [{
      ...doc,
      id: `legacy:${doc.path}`,
      title,
      source: 'legacy',
      snippet: buildDocSearchSnippet(content, q),
    }]
  })

  return c.json([...treeDocs, ...legacyDocs].slice(0, 30))
})

app.get('/api/crazor/contacts/:id/docs', (c) => {
  const contactId = c.req.param('id')
  const treeDocs = docTree.listNotesByContact('knowledge', contactId).map((note: any) => ({
    ...note,
    source: 'knowledge',
  }))
  const legacyDocs = docs.listContactDocs(contactId).map((doc: any) => ({
    ...doc,
    id: `legacy:${doc.path}`,
    title: doc.name?.replace(/\.md$/, '') || doc.path,
    source: 'legacy',
  }))
  return c.json([...treeDocs, ...legacyDocs])
})

app.post('/api/crazor/contacts/:id/docs', async (c) => {
  const body = await c.req.json()
  if (!body.filename) return c.json({ error: 'filename is required' }, 400)
  const contactId = c.req.param('id')
  // Ensure knowledge tree has a folder for this contact
  docTree.ensureContactFolder(contactId, body.contactName || contactId)
  // Create the doc in tree + filesystem
  const note = docTree.createContactNote(contactId, body.filename, body.content || '')
  return c.json(note || docs.createContactDoc(contactId, body.filename, body.content || ''), 201)
})

// --- Contact attachments ---
app.get('/api/crazor/attachments/policy', (c) => {
  return c.json(attachmentPolicy())
})

app.get('/api/crazor/contacts/:id/attachments', (c) => {
  const contactId = c.req.param('id')
  if (!getContact(contactId)) return c.json({ error: 'not found' }, 404)
  return c.json(listContactAttachments(contactId))
})

app.post('/api/crazor/contacts/:id/attachments', async (c) => {
  const contactId = c.req.param('id')
  if (!getContact(contactId)) return c.json({ error: 'not found' }, 404)

  const body = await c.req.parseBody() as Record<string, any>
  const rawFile = Array.isArray(body.file) ? body.file[0] : body.file
  if (!rawFile || typeof rawFile.arrayBuffer !== 'function') {
    return c.json({ error: 'file is required' }, 400)
  }

  const dir = contactAttachmentsDir(contactId)
  mkdirSync(dir, { recursive: true })

  const originalName = sanitizeAttachmentFilename(rawFile.name || body.filename || 'attachment')
  if (!isAttachmentExtensionAllowed(originalName)) {
    return c.json({
      error: 'attachment type is not allowed',
      allowed_extensions: CRAZOR_ATTACHMENT_ALLOWED_EXTENSIONS,
    }, 415)
  }

  if (Number(rawFile.size || 0) > CRAZOR_ATTACHMENT_MAX_BYTES) {
    return c.json({
      error: 'attachment is too large',
      max_bytes: CRAZOR_ATTACHMENT_MAX_BYTES,
    }, 413)
  }

  const filename = uniqueAttachmentName(dir, originalName)
  const filePath = resolve(dir, filename)
  const arrayBuffer = await rawFile.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)
  if (fileBuffer.byteLength > CRAZOR_ATTACHMENT_MAX_BYTES) {
    return c.json({
      error: 'attachment is too large',
      max_bytes: CRAZOR_ATTACHMENT_MAX_BYTES,
    }, 413)
  }
  writeFileSync(filePath, fileBuffer)

  const stat = statSync(filePath)
  return c.json(contactAttachmentResponse(contactId, filename, stat), 201)
})

app.get('/api/crazor/contacts/:id/attachments/:filename/preview', (c) => {
  const contactId = c.req.param('id')
  if (!getContact(contactId)) return c.json({ error: 'not found' }, 404)
  const filename = sanitizeAttachmentFilename(c.req.param('filename'))
  const filePath = resolve(contactAttachmentsDir(contactId), filename)
  if (!existsSync(filePath)) return c.json({ error: 'not found' }, 404)

  const stat = statSync(filePath)
  const kind = attachmentKind(filename)
  const base = {
    name: filename,
    kind,
    size: stat.size,
    mime_type: attachmentMimeType(filename),
    max_preview_bytes: CRAZOR_ATTACHMENT_PREVIEW_MAX_BYTES,
  }

  if (kind === 'file') {
    return c.json({ ...base, previewable: false, reason: '该附件类型暂不支持预览，请下载查看' })
  }
  if (stat.size > CRAZOR_ATTACHMENT_PREVIEW_MAX_BYTES) {
    return c.json({ ...base, previewable: false, reason: '附件超过预览大小限制，请下载查看' })
  }
  if (kind === 'text') {
    return c.json({
      ...base,
      previewable: true,
      content: readFileSync(filePath, 'utf-8'),
    })
  }
  return c.json({
    ...base,
    previewable: true,
    content_base64: Buffer.from(readFileSync(filePath)).toString('base64'),
  })
})

app.get('/api/crazor/contacts/:id/attachments/:filename', (c) => {
  const contactId = c.req.param('id')
  if (!getContact(contactId)) return c.json({ error: 'not found' }, 404)
  const filename = sanitizeAttachmentFilename(c.req.param('filename'))
  const filePath = resolve(contactAttachmentsDir(contactId), filename)
  if (!existsSync(filePath)) return c.json({ error: 'not found' }, 404)
  return new Response(readFileSync(filePath), {
    headers: {
      'Content-Type': attachmentMimeType(filename),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
})

app.delete('/api/crazor/contacts/:id/attachments/:filename', (c) => {
  const contactId = c.req.param('id')
  if (!getContact(contactId)) return c.json({ error: 'not found' }, 404)
  const filename = sanitizeAttachmentFilename(c.req.param('filename'))
  const filePath = resolve(contactAttachmentsDir(contactId), filename)
  if (!existsSync(filePath)) return c.json({ error: 'not found' }, 404)
  rmSync(filePath)
  return c.json({ ok: true, id: filename })
})

// --- Content Pieces ---
app.get('/api/crazor/content-pieces', (c) => {
  const platform = c.req.query('platform')
  const form = c.req.query('form')
  const status = c.req.query('status')
  const q = c.req.query('q')
  return c.json(listContentPieces({ platform, form, status, q }))
})

app.get('/api/crazor/content-pieces/stats', (c) => {
  return c.json(getContentPieceStats())
})

app.get('/api/crazor/content-pieces/:id', (c) => {
  const piece = getContentPiece(c.req.param('id'))
  if (!piece) return c.json({ error: 'not found' }, 404)
  return c.json(piece)
})

app.post('/api/crazor/content-pieces', async (c) => {
  const body = await c.req.json()
  if (!body.title) return c.json({ error: 'title is required' }, 400)
  const piece = createContentPiece(body)
  return c.json(piece, 201)
})

app.patch('/api/crazor/content-pieces/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateContentPiece(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.post('/api/crazor/content-pieces/:id/publish', (c) => {
  try {
    return c.json(contentPublish(c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err?.message || 'publish failed' }, 404)
  }
})

app.patch('/api/crazor/content-pieces/:id/metrics', async (c) => {
  try {
    const body = await c.req.json()
    return c.json(contentUpdateMetrics(c.req.param('id'), body))
  } catch (err: any) {
    return c.json({ error: err?.message || 'metrics update failed' }, 404)
  }
})

app.delete('/api/crazor/content-pieces/:id', (c) => {
  deleteContentPiece(c.req.param('id'))
  return c.json({ ok: true })
})

// Legacy file read/write (used by contact docs)
app.get('/api/crazor/doc-files/*', (c) => {
  const docPath = c.req.path.replace('/api/crazor/doc-files/', '')
  const content = docs.readDoc(docPath)
  if (content === null) return c.json({ error: 'not found' }, 404)
  return c.json({ path: docPath, content })
})

app.patch('/api/crazor/doc-files/*', async (c) => {
  const docPath = c.req.path.replace('/api/crazor/doc-files/', '')
  const body = await c.req.json()
  docs.updateDoc(docPath, body.content || '')
  return c.json({ ok: true })
})

// --- Document tree (notebook + knowledge) ---

app.get('/api/crazor/docs/:scope/tree', (c) => {
  const scope = c.req.param('scope')
  if (scope !== 'notebook' && scope !== 'knowledge') return c.json({ error: 'invalid scope' }, 400)
  return c.json(docTree.listTree(scope))
})

app.post('/api/crazor/docs/:scope/folders', async (c) => {
  const scope = c.req.param('scope')
  const body = await c.req.json()
  return c.json(docTree.createFolder(scope, body.parentId || null, body.name || '未命名'), 201)
})

// --- Document folder/note operations (ID via query param to support path-based IDs) ---

app.patch('/api/crazor/docs/:scope/folders-ops', async (c) => {
  const id = c.req.query('id')
  const body = await c.req.json()
  docTree.renameFolder(id, body.name)
  return c.json({ ok: true })
})

app.delete('/api/crazor/docs/:scope/folders-ops', (c) => {
  const id = c.req.query('id')
  try {
    docTree.deleteFolder(id)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

app.post('/api/crazor/docs/:scope/folders-ops/move', async (c) => {
  const id = c.req.query('id')
  const body = await c.req.json()
  docTree.moveFolder(id, body.parentId || null, body.targetFolderId || null, body.position || null)
  return c.json({ ok: true })
})

app.post('/api/crazor/docs/:scope/notes', async (c) => {
  const scope = c.req.param('scope')
  const body = await c.req.json()
  return c.json(docTree.createNote(scope, body.folderId || null, body.title || '未命名笔记', body.content || '', body.contact_id || null), 201)
})

app.get('/api/crazor/docs/:scope/notes-ops', (c) => {
  const id = c.req.query('id')
  const note = docTree.getNote(id)
  if (!note) return c.json({ error: 'not found' }, 404)
  return c.json(note)
})

app.patch('/api/crazor/docs/:scope/notes-ops', async (c) => {
  const id = c.req.query('id')
  const body = await c.req.json()
  docTree.updateNote(id, body.title || '', body.content || '')
  return c.json({ ok: true })
})

app.delete('/api/crazor/docs/:scope/notes-ops', (c) => {
  const id = c.req.query('id')
  docTree.deleteNote(id)
  return c.json({ ok: true })
})

app.post('/api/crazor/docs/:scope/notes-ops/move', async (c) => {
  const id = c.req.query('id')
  const body = await c.req.json()
  docTree.moveNote(id, body.folderId || null, body.targetNoteId || null, body.position || null)
  return c.json({ ok: true })
})

app.get('/api/crazor/docs/:scope/search', (c) => {
  const scope = c.req.param('scope')
  const q = c.req.query('q') || ''
  return c.json(docTree.searchNotes(scope, q))
})

// --- Transactions ---
app.get('/api/crazor/transactions', (c) => {
  const type = c.req.query('type')
  const month = c.req.query('month')
  const category = c.req.query('category')
  return c.json(listTransactions({ type: type || undefined, month: month || undefined, category: category || undefined }))
})

app.post('/api/crazor/transactions', async (c) => {
  const body = await c.req.json()
  if (!body.type || body.amount === undefined) return c.json({ error: 'type and amount are required' }, 400)
  return c.json(createTransaction(body), 201)
})

app.patch('/api/crazor/transactions/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateTransaction(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.delete('/api/crazor/transactions/:id', (c) => {
  deleteTransaction(c.req.param('id'))
  return c.json({ ok: true })
})

// --- Projects ---
app.get('/api/crazor/projects', (c) => {
  const status = c.req.query('status')
  return c.json(listProjects(status || undefined))
})

app.post('/api/crazor/projects', async (c) => {
  const body = await c.req.json()
  if (!body.name) return c.json({ error: 'name is required' }, 400)
  return c.json(createProject(body), 201)
})

app.patch('/api/crazor/projects/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateProject(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.delete('/api/crazor/projects/:id', (c) => {
  deleteProject(c.req.param('id'))
  return c.json({ ok: true })
})

// --- Tasks ---
app.get('/api/crazor/tasks', (c) => {
  const project = c.req.query('project')
  const contactId = c.req.query('contact_id')
  if (contactId) return c.json(listTasksByContact(contactId))
  return c.json(listTasks(project || undefined))
})

app.post('/api/crazor/tasks', async (c) => {
  const body = await c.req.json()
  if (!body.project_id || !body.title) return c.json({ error: 'project_id and title are required' }, 400)
  return c.json(createTask(body), 201)
})

app.patch('/api/crazor/tasks/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateTask(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.delete('/api/crazor/tasks/:id', (c) => {
  deleteTask(c.req.param('id'))
  return c.json({ ok: true })
})

app.patch('/api/crazor/tasks/:id/move', async (c) => {
  const body = await c.req.json()
  if (!body.status) return c.json({ error: 'status is required' }, 400)
  const updated = moveTask(c.req.param('id'), body.status, body.sort_order)
  return c.json(updated)
})

app.get('/api/crazor/task-reminders', (c) => {
  return c.json(getTaskReminders(parsePositiveInt(c.req.query('limit'), 20)))
})

// --- Follow-ups ---
app.get('/api/crazor/follow-up-reminders', (c) => {
  return c.json(getFollowUpReminders())
})

app.get('/api/crazor/follow-ups', (c) => {
  const contact_id = c.req.query('contact_id')
  const status = c.req.query('status')
  const date_from = c.req.query('date_from')
  const date_to = c.req.query('date_to')
  return c.json(listFollowUps({ contact_id: contact_id || undefined, status: status || undefined, date_from: date_from || undefined, date_to: date_to || undefined }))
})

app.post('/api/crazor/follow-ups', async (c) => {
  const body = await c.req.json()
  if (!body.contact_id) return c.json({ error: 'contact_id is required' }, 400)
  return c.json(createFollowUp(body), 201)
})

app.patch('/api/crazor/follow-ups/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateFollowUp(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.delete('/api/crazor/follow-ups/:id', (c) => {
  deleteFollowUp(c.req.param('id'))
  return c.json({ ok: true })
})

// --- Channels ---
app.get('/api/crazor/channels', (c) => {
  const status = c.req.query('status')
  const rating = c.req.query('rating')
  const is_public = c.req.query('is_public')
  return c.json(listChannels({ status: status || undefined, rating: rating || undefined, is_public: is_public ? parseInt(is_public) : undefined }))
})

app.get('/api/crazor/channels/:id', (c) => {
  const channel = getChannel(c.req.param('id'))
  if (!channel) return c.json({ error: 'not found' }, 404)
  return c.json(channel)
})

app.post('/api/crazor/channels', async (c) => {
  const body = await c.req.json()
  if (!body.name) return c.json({ error: 'name is required' }, 400)
  return c.json(createChannel(body), 201)
})

app.patch('/api/crazor/channels/:id', async (c) => {
  const body = await c.req.json()
  const updated = updateChannel(c.req.param('id'), body)
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

app.delete('/api/crazor/channels/:id', (c) => {
  deleteChannel(c.req.param('id'))
  return c.json({ ok: true })
})

app.get('/api/crazor/channels/:id/referrals', (c) => {
  return c.json(listChannelReferrals(c.req.param('id')))
})

app.post('/api/crazor/channels/:id/referrals', async (c) => {
  const body = await c.req.json()
  body.channel_id = c.req.param('id')
  return c.json(createChannelReferral(body), 201)
})

app.get('/api/crazor/contacts/:id/channels', (c) => {
  return c.json(listContactChannels(c.req.param('id')))
})

// --- Analytics ---
app.get('/api/crazor/analytics/overview', (c) => {
  return c.json({
    contacts: getContactStats(),
    finance: getFinanceStats(),
    projects: getProjectStats(),
    hermes: getHermesSessionStats(),
    channels: getChannelStats(),
    followUpReminders: getFollowUpReminders(),
    taskReminders: getTaskReminders(),
  })
})

app.get('/api/crazor/analytics/revenue', (c) => {
  return c.json(getMonthlyRevenue(6))
})

app.get('/api/crazor/analytics/channels', (c) => {
  return c.json(getChannelStats())
})

// --- Unified Context Layer ---
app.get('/api/crazor/context', (c) => {
  return c.json(getUnifiedContext({
    q: c.req.query('q') || '',
    types: c.req.query('types') || '',
    contact_id: c.req.query('contact_id') || '',
    limit: c.req.query('limit') || '',
  }))
})

// --- Schema API ---
app.get('/api/crazor/schema/:entity', (c) => {
  return c.json(listFieldDefinitions(c.req.param('entity')))
})

app.post('/api/crazor/schema/:entity', async (c) => {
  const body = await c.req.json()
  body.entity = c.req.param('entity')
  const result = createFieldDefinition(body)
  if (!result) return c.json({ error: 'field already exists' }, 409)
  return c.json(result, 201)
})

app.patch('/api/crazor/schema/:entity/:key', async (c) => {
  const body = await c.req.json()
  const result = updateFieldDefinition(c.req.param('entity'), c.req.param('key'), body)
  if (!result) return c.json({ error: 'not found' }, 404)
  return c.json(result)
})

app.delete('/api/crazor/schema/:entity/:key', (c) => {
  const ok = deleteFieldDefinition(c.req.param('entity'), c.req.param('key'))
  if (!ok) return c.json({ error: 'not found or not custom' }, 404)
  return c.json({ ok: true })
})

app.post('/api/crazor/schema/:entity/reorder', async (c) => {
  const { orderedKeys } = await c.req.json()
  reorderFieldDefinitions(c.req.param('entity'), orderedKeys)
  return c.json({ ok: true })
})

app.post('/api/crazor/schema/:entity/discover', (c) => {
  discoverCustomFields(c.req.param('entity'))
  return c.json(listFieldDefinitions(c.req.param('entity')))
})

// --- Crazor Skill Catalog & Installation ---

function isSystemCrazorSkill(id: string): boolean {
  return aiEmployeeRuntime.isSystemSkill(id)
}

function publicCrazorSkills() {
  return skillCatalog.getCatalog({ source: 'crazor' }).filter((skill: any) => skill.category !== 'system')
}

app.get('/api/crazor/skills/catalog', (c) => {
  return c.json(publicCrazorSkills())
})

app.get('/api/crazor/skills/meta', (c) => {
  const publicIds = new Set(publicCrazorSkills().map((skill: any) => skill.id))
  return c.json(skillCatalog.getAllSkillMeta().filter((meta: any) => publicIds.has(meta.id)))
})

app.get('/api/crazor/skills/meta/:id', (c) => {
  const meta = skillCatalog.getSkillMeta(c.req.param('id'))
  if (!meta) return c.json({ error: 'Not found' }, 404)
  return c.json(meta)
})

app.get('/api/crazor/skills/installed', (c) => {
  if (!existsSync(CRAZOR_SKILLS_DIR)) return c.json([])
  const ids = readdirSync(CRAZOR_SKILLS_DIR).filter((d) => {
    const p = join(CRAZOR_SKILLS_DIR, d)
    return statSync(p).isDirectory() && existsSync(join(p, 'SKILL.md'))
  })
  return c.json(ids.filter((id) => !isSystemCrazorSkill(id)))
})

app.post('/api/crazor/skills/install', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'Missing skill id' }, 400)
  if (isSystemCrazorSkill(id)) return c.json({ error: 'System skill cannot be installed as a digital employee' }, 403)

  const result = seedOneSkill(id)
  if (result === 'not_found') return c.json({ error: 'Skill source not found' }, 404)
  // Verify the skill now exists
  const content = skillCatalog.getSkillContent(id)
  if (!content) return c.json({ error: 'Skill not found in catalog' }, 404)

  return c.json({ success: true, result })
})

app.delete('/api/crazor/skills/:id', async (c) => {
  const { id } = c.req.param()
  if (isSystemCrazorSkill(id)) return c.json({ error: 'System skill cannot be removed through digital employee APIs' }, 403)
  const skillDir = join(CRAZOR_SKILLS_DIR, id)
  if (!existsSync(skillDir)) return c.json({ error: 'Not found' }, 404)
  const { rmSync } = await import('node:fs')
  rmSync(skillDir, { recursive: true, force: true })
  return c.json({ success: true })
})

// --- AI Employee Runtime ---

app.get('/api/crazor/ai-employees', (c) => {
  return c.json(aiEmployeeRuntime.listAiEmployees())
})

app.get('/api/crazor/ai-employees/:id', (c) => {
  const employee = aiEmployeeRuntime.getAiEmployee(c.req.param('id'))
  if (!employee) return c.json({ error: 'AI employee not found' }, 404)
  return c.json(employee)
})

app.post('/api/crazor/ai-employees/:id/runs', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const run = aiEmployeeRuntime.prepareAiEmployeeRun(c.req.param('id'), body)
  if (!run) return c.json({ error: 'AI employee not found' }, 404)
  return c.json(run, 201)
})

// --- Start ---
const migrationResult = migrateVault()
const seedResult = seedVault()
const seedSkillsResult = seedSkills()
// Seed field definitions from schema metadata
seedFieldDefinitions()
seedContentPieces()
for (const entity of ['contacts', 'channels', 'transactions']) {
  discoverCustomFields(entity)
}
console.log(`🚀 Crazor API Server starting on port ${PORT}`)
console.log(`   Agent Gateway: ${AGENT_GATEWAY_URL}`)
console.log(`   Agent Dashboard: ${AGENT_DASHBOARD_URL}`)
if (seedResult.folders > 0 || seedResult.notes > 0) {
  console.log(`   📦 Seeded vault: ${seedResult.folders} folders, ${seedResult.notes} notes`)
}
if (seedSkillsResult.converted > 0 || seedSkillsResult.skipped > 0) {
  console.log(`   📦 Seeded skills: ${seedSkillsResult.converted} converted, ${seedSkillsResult.skipped} unchanged`)
}

// --- Serve frontend static files (for Tauri production build) ---
const FRONTEND_DIST = join(import.meta.dir, '../../web/dist')
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

app.get('*', async (c: any) => {
  const urlPath = new URL(c.req.url).pathname
  // Try to serve static file
  const filePath = join(FRONTEND_DIST, urlPath === '/' ? 'index.html' : urlPath)
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath)
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
    return new Response(readFileSync(filePath), {
      headers: { 'Content-Type': mimeType },
    })
  }
  // SPA fallback: serve index.html for any non-API route
  const indexPath = join(FRONTEND_DIST, 'index.html')
  if (existsSync(indexPath)) {
    return new Response(readFileSync(indexPath), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  return c.notFound()
})

export default {
  port: PORT,
  fetch: app.fetch,
}
