import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { stream } from 'hono/streaming'
import { HTTPException } from 'hono/http-exception'

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
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Hermes-Session-Id'],
}))

// --- Health ---
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'crazor-api' }))

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
  return c.json(data)
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
    method: 'POST',
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
app.post('/api/sessions', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return c.json(data, resp.status as 200)
})

app.patch('/api/sessions/:id', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/sessions/${c.req.param('id')}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return c.json(data)
})

app.post('/api/sessions/:id/pin', async (c) => {
  const resp = await dashboardFetch(`/api/sessions/${c.req.param('id')}/pin`, { method: 'POST' })
  return c.json(await resp.json())
})

app.post('/api/sessions/:id/messages', async (c) => {
  const body = await c.req.json()
  const resp = await dashboardFetch(`/api/sessions/${c.req.param('id')}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return c.json(await resp.json())
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

// --- Start ---
console.log(`🚀 Crazor API Server starting on port ${PORT}`)
console.log(`   Hermes Gateway: ${HERMES_GATEWAY_URL}`)
console.log(`   Hermes Dashboard: ${HERMES_DASHBOARD_URL}`)

export default {
  port: PORT,
  fetch: app.fetch,
}
