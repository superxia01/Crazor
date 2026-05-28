import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { stream } from 'hono/streaming'
import { HTTPException } from 'hono/http-exception'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listContacts, getContact, createContact, updateContact, deleteContact,
  listTransactions, createTransaction, updateTransaction, deleteTransaction,
  getMonthlyRevenue, listProjects, createProject, updateProject, deleteProject,
  listTasks, createTask, updateTask, deleteTask, moveTask,
  getContactStats, getFinanceStats, getProjectStats, getHermesSessionStats,
  listFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, getFollowUpReminders,
  listChannels, getChannel, createChannel, updateChannel, deleteChannel, getChannelStats,
  listChannelReferrals, createChannelReferral, listContactChannels,
  listContentPieces, getContentPiece, createContentPiece, updateContentPiece, deleteContentPiece, getContentPieceStats, seedContentPieces,
} from './services/crazor-db'
import { seedFieldDefinitions, discoverCustomFields, listFieldDefinitions, getFieldDefinition, createFieldDefinition, updateFieldDefinition, deleteFieldDefinition, reorderFieldDefinitions } from './services/field-definitions'
import * as docs from './services/crazor-docs'
import * as docTree from './services/crazor-doc-tree'
import * as skillCatalog from './services/skill-catalog'
import { seedVault } from './services/seed-vault'
import { seedSkills } from './services/seed-skills'
import { migrateVault } from './services/migrate-vault'
import { handleSSEConnect, handleSSEMessage, handleStreamableHTTP } from './services/crazor-mcp'
import { CRAZOR_SKILLS_DIR } from './services/crazor-config'

const app = new Hono()

// --- Config ---
const HERMES_GATEWAY_URL = process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642'
const HERMES_DASHBOARD_URL = process.env.HERMES_DASHBOARD_URL || 'http://127.0.0.1:9119'
const PORT = parseInt(process.env.PORT || '3001')

// --- Dashboard session token management ---
let _dashboardToken: string | null = null
let _dashboardTokenFetchedAt = 0

async function getDashboardToken(): Promise<string | null> {
  // Cache token for 5 minutes
  if (_dashboardToken && Date.now() - _dashboardTokenFetchedAt < 5 * 60 * 1000) {
    return _dashboardToken
  }
  try {
    const resp = await fetch(`${HERMES_DASHBOARD_URL}/`)
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
  return fetch(`${HERMES_DASHBOARD_URL}${path}`, {
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

// --- Middleware ---
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174']

app.use('*', cors({
  origin: CORS_ORIGINS,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  exposeHeaders: ['X-Hermes-Session-Id', 'Mcp-Session-Id'],
}))

// --- Health ---
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'crazor-api' }))

// --- MCP SSE endpoint (legacy, for SSE-only clients) ---
app.get('/mcp/sse', (c) => handleSSEConnect())
app.post('/mcp/sse', async (c) => {
  const body = await c.req.json()
  const sessionIdParam = c.req.query('sessionId')
  const response = await handleSSEMessage(body, sessionIdParam)
  if (response === null) return c.json({})
  return c.json(response)
})

// --- MCP StreamableHTTP endpoint (for Hermes Agent / MCP SDK clients) ---
app.post('/mcp', async (c) => {
  const body = await c.req.json()
  const sessionHeader = c.req.header('mcp-session-id') || null
  return handleStreamableHTTP(body, sessionHeader)
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

// --- Hermes Gateway Proxy (port 8642) ---
// Chat completions with SSE streaming
app.post('/api/chat/completions', async (c) => {
  const body = await c.req.json()
  const upstreamUrl = `${HERMES_GATEWAY_URL}/v1/chat/completions`

  const resp = await fetch(upstreamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new HTTPException(resp.status as any, { message: text })
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
  const upstreamUrl = `${HERMES_GATEWAY_URL}/v1/responses`

  const resp = await fetch(upstreamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new HTTPException(resp.status as any, { message: text })
  }

  if (body.stream) {
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

  const sessionId = resp.headers.get('x-hermes-session-id')
  if (sessionId) c.header('X-Hermes-Session-Id', sessionId)
  const data = await resp.json()
  return c.json(data)
})

// Models
app.get('/api/models', async (c) => {
  const resp = await fetch(`${HERMES_GATEWAY_URL}/v1/models`)
  const data = await resp.json()
  return c.json(data)
})

// Cron jobs (Hermes Gateway :8642)
app.get('/api/cron', async (c) => {
  try {
    const resp = await fetch(`${HERMES_GATEWAY_URL}/api/jobs?include_disabled=true`)
    const data = await resp.json()
    return c.json(data)
  } catch {
    return c.json([])
  }
})

app.post('/api/cron', async (c) => {
  const body = await c.req.json()
  const resp = await fetch(`${HERMES_GATEWAY_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return c.json(data, resp.status as 200)
})

app.post('/api/cron/:id/pause', async (c) => {
  const resp = await fetch(`${HERMES_GATEWAY_URL}/api/jobs/${c.req.param('id')}/pause`, { method: 'POST' })
  return c.json(await resp.json())
})

app.post('/api/cron/:id/resume', async (c) => {
  const resp = await fetch(`${HERMES_GATEWAY_URL}/api/jobs/${c.req.param('id')}/resume`, { method: 'POST' })
  return c.json(await resp.json())
})

app.post('/api/cron/:id/run', async (c) => {
  const resp = await fetch(`${HERMES_GATEWAY_URL}/api/jobs/${c.req.param('id')}/run`, { method: 'POST' })
  return c.json(await resp.json())
})

app.delete('/api/cron/:id', async (c) => {
  const resp = await fetch(`${HERMES_GATEWAY_URL}/api/jobs/${c.req.param('id')}`, { method: 'DELETE' })
  return c.json(await resp.json())
})

// --- Hermes Dashboard Proxy (port 9119) ---
// Sessions
app.get('/api/sessions', async (c) => {
  const resp = await dashboardFetch(`/api/sessions`)
  const data = await resp.json()
  // Dashboard returns {sessions:[], total:0} — unwrap to array for frontend
  if (data && Array.isArray(data.sessions)) {
    return c.json(data.sessions)
  }
  return c.json(data)
})

app.get('/api/sessions/search', async (c) => {
  const q = c.req.query('q') || ''
  const resp = await dashboardFetch(`/api/sessions/search?q=${encodeURIComponent(q)}`)
  const data = await resp.json()
  return c.json(data)
})

app.get('/api/sessions/:id', async (c) => {
  const resp = await dashboardFetch(`/api/sessions/${c.req.param('id')}`)
  const data = await resp.json()
  return c.json(data)
})

app.get('/api/sessions/:id/messages', async (c) => {
  const resp = await dashboardFetch(`/api/sessions/${c.req.param('id')}/messages`)
  const data = await resp.json()
  // Dashboard returns { session_id, messages: [...] }, frontend expects array
  return c.json(Array.isArray(data) ? data : data.messages || [])
})

app.delete('/api/sessions/:id', async (c) => {
  const resp = await dashboardFetch(`/api/sessions/${c.req.param('id')}`, { method: 'DELETE' })
  return c.json({ ok: true })
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
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json({ ok: true })
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
  const data = await resp.json()
  return c.json(data)
})

app.get('/api/model/options', async (c) => {
  const resp = await dashboardFetch(`/api/model/options`)
  const data = await resp.json()
  return c.json(data)
})

app.post('/api/model/set', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/model/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json({ ok: true })
})

// Env vars
app.get('/api/env', async (c) => {
  const resp = await dashboardFetch(`/api/env`)
  const data = await resp.json()
  return c.json(data)
})

app.post('/api/env', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/env`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json({ ok: true })
})

app.delete('/api/env/:key', async (c) => {
  const resp = await dashboardFetch(`/api/env/${c.req.param('key')}`, { method: 'DELETE' })
  return c.json({ ok: true })
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
    const resp = await fetch(`${HERMES_GATEWAY_URL}/health`)
    const data = await resp.json()
    return c.json(data)
  } catch {
    return c.json({ status: 'offline' })
  }
})

// --- Sessions (write operations) ---
// Dashboard only supports GET /api/sessions; sessions are created by the Gateway during chat.
// Generate a local session stub so the frontend can track the conversation.
const _localSessions: Record<string, any> = {}

app.post('/api/sessions', async (c) => {
  const body = await c.req.json()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const session = {
    id,
    title: body.title || 'New Conversation',
    agent_id: body.agent_id || 'hermes-agent',
    workspace_path: body.workspace_path || null,
    model: body.model || null,
    created_at: now,
    updated_at: now,
    messages: [],
  }
  _localSessions[id] = session
  return c.json(session, 201)
})

app.patch('/api/sessions/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  if (_localSessions[id]) {
    Object.assign(_localSessions[id], body, { updated_at: new Date().toISOString() })
    return c.json(_localSessions[id])
  }
  // Session might exist in Dashboard only — best-effort forward
  try {
    const resp = await dashboardFetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return c.json(await resp.json())
  } catch {
    return c.json({ ok: true })
  }
})

app.post('/api/sessions/:id/pin', async (c) => {
  const id = c.req.param('id')
  if (_localSessions[id]) {
    _localSessions[id].pinned = !(_localSessions[id].pinned)
    return c.json({ ok: true, pinned: _localSessions[id].pinned })
  }
  return c.json({ ok: true })
})

app.post('/api/sessions/:id/messages', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  if (_localSessions[id]) {
    const msg = { role: body.role, content: body.content, created_at: new Date().toISOString() }
    _localSessions[id].messages.push(msg)
    return c.json(msg, 201)
  }
  return c.json({ ok: true })
})

// --- Skills (detail, toggle, market, install, uninstall, update) ---

const SKILLS_INDEX_URL = 'https://hermes-agent.nousresearch.com/docs/api/skills-index.json'
let _skillsCache: { data: any[]; fetchedAt: number } | null = null

app.get('/api/skills/market', async (c) => {
  try {
    // Cache for 10 minutes
    if (_skillsCache && Date.now() - _skillsCache.fetchedAt < 600_000) {
      return c.json(_skillsCache.data)
    }
    const resp = await fetch(SKILLS_INDEX_URL, { headers: { 'Accept': 'application/json' } })
    if (!resp.ok) return c.json([])
    const payload = await resp.json()
    const skills = Array.isArray(payload?.skills) ? payload.skills : []
    _skillsCache = { data: skills, fetchedAt: Date.now() }
    return c.json(skills)
  } catch {
    return c.json(_skillsCache?.data ?? [])
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
  const resp = await dashboardFetch(`/api/env/${c.req.param('key')}/reveal`)
  const data = await resp.json()
  return c.json(data)
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
app.get('/api/crazor/contacts/:id/docs', (c) => {
  return c.json(docs.listContactDocs(c.req.param('id')))
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
  return c.json(docTree.createNote(scope, body.folderId || null, body.title || '未命名笔记'), 201)
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
  })
})

app.get('/api/crazor/analytics/revenue', (c) => {
  return c.json(getMonthlyRevenue(6))
})

app.get('/api/crazor/analytics/channels', (c) => {
  return c.json(getChannelStats())
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

app.get('/api/crazor/skills/catalog', (c) => {
  return c.json(skillCatalog.getCatalog({ source: 'crazor' }))
})

app.get('/api/crazor/skills/meta', (c) => {
  return c.json(skillCatalog.getAllSkillMeta())
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
  return c.json(ids)
})

app.post('/api/crazor/skills/install', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'Missing skill id' }, 400)

  // Re-seed this specific skill (seedSkills is idempotent)
  const result = seedSkills()
  // Verify the skill now exists
  const content = skillCatalog.getSkillContent(id)
  if (!content) return c.json({ error: 'Skill not found in catalog' }, 404)

  return c.json({ success: true })
})

app.delete('/api/crazor/skills/:id', async (c) => {
  const { id } = c.req.param()
  const skillDir = join(CRAZOR_SKILLS_DIR, id)
  if (!existsSync(skillDir)) return c.json({ error: 'Not found' }, 404)
  const { rmSync } = await import('node:fs')
  rmSync(skillDir, { recursive: true, force: true })
  return c.json({ success: true })
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
console.log(`   Hermes Gateway: ${HERMES_GATEWAY_URL}`)
console.log(`   Hermes Dashboard: ${HERMES_DASHBOARD_URL}`)
if (seedResult.folders > 0 || seedResult.notes > 0) {
  console.log(`   📦 Seeded vault: ${seedResult.folders} folders, ${seedResult.notes} notes`)
}
if (seedSkillsResult.converted > 0 || seedSkillsResult.skipped > 0) {
  console.log(`   📦 Seeded skills: ${seedSkillsResult.converted} converted, ${seedSkillsResult.skipped} unchanged`)
}

export default {
  port: PORT,
  fetch: app.fetch,
}
