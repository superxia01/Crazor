// M2 多运行时网关：Provider 适配层。
// 业务路由只调用本模块的 runtime* 函数，不直接 fetch 网关；
// provider 差异（Responses 缺失降级、jobs/sessions 能力缺失）全部封装在这里。
// 设计依据：docs/architecture/agent-gateway.md「Provider 接入契约」。

import {
  AGENT_GATEWAY_URL,
  AGENT_PROVIDER_DISPLAY_NAME,
  agentGatewayHeaders,
  agentProviderSupports,
} from './agent-gateway'

export async function gatewayFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${AGENT_GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      ...agentGatewayHeaders(),
      ...((options.headers as Record<string, string>) || {}),
    },
  })
}

// 不同 provider 回传会话 id 的头不一致（Hermes 用 x-hermes-session-id）。
const SESSION_ID_HEADERS = ['x-hermes-session-id', 'x-agent-session-id', 'x-session-id']

export function extractRuntimeSessionId(resp: Response): string {
  for (const header of SESSION_ID_HEADERS) {
    const value = resp.headers.get(header)
    if (value) return value
  }
  return ''
}

// ---------------------------------------------------------------------------
// Chat Completions（所有 provider 的最低要求）
// ---------------------------------------------------------------------------

export async function runtimeChatCompletions(body: unknown): Promise<Response> {
  return gatewayFetch('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Responses（可选能力；缺失时降级为 Chat Completions 并翻译协议）
// ---------------------------------------------------------------------------

type ResponsesRequestBody = {
  model?: string
  input?: unknown
  stream?: boolean
  previous_response_id?: string | null
  [key: string]: unknown
}

// Responses 的 input（字符串或消息数组）→ Chat Completions messages。
export function responsesInputToChatMessages(input: unknown): Array<{ role: string; content: string }> {
  if (typeof input === 'string') {
    return [{ role: 'user', content: input }]
  }
  if (!Array.isArray(input)) return []
  const messages: Array<{ role: string; content: string }> = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const role = typeof record.role === 'string' ? record.role : 'user'
    const content = record.content
    if (typeof content === 'string') {
      messages.push({ role, content })
      continue
    }
    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (typeof part === 'string') return part
          if (part && typeof part === 'object') {
            const partRecord = part as Record<string, unknown>
            if (typeof partRecord.text === 'string') return partRecord.text
          }
          return ''
        })
        .filter(Boolean)
        .join('\n')
      if (text) messages.push({ role, content: text })
    }
  }
  return messages
}

export function formatResponsesSseEvent(type: string, payload: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`
}

// 非流式 Chat Completions 结果 → Responses 形状。
export function chatCompletionToResponsePayload(chatPayload: unknown, model: string): Record<string, unknown> {
  const record = (chatPayload && typeof chatPayload === 'object' ? chatPayload : {}) as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = (choices[0] && typeof choices[0] === 'object' ? choices[0] : {}) as Record<string, unknown>
  const message = (firstChoice.message && typeof firstChoice.message === 'object' ? firstChoice.message : {}) as Record<string, unknown>
  const text = typeof message.content === 'string' ? message.content : ''
  const id = typeof record.id === 'string' && record.id ? record.id : `resp_${Math.abs(Date.now())}`
  return {
    id,
    object: 'response',
    status: 'completed',
    model: typeof record.model === 'string' ? record.model : model,
    degraded_from: 'chat.completions',
    output: [
      {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text }],
      },
    ],
    output_text: text,
    usage: record.usage ?? null,
  }
}

// 增量翻译器：Chat Completions SSE → Responses SSE。
// 与前端 web/src/api/chat.js 的解析逻辑对齐：
// response.output_text.delta（json.delta）/ response.completed / response.failed，
// 任意事件的 json.response.id 会被记录为 response_id。
export function createChatSseTranslator(responseId: string) {
  let buffer = ''
  let completed = false

  function translateBlock(block: string): string {
    const dataLines: string[] = []
    for (const rawLine of block.split('\n')) {
      const line = rawLine.trimEnd()
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length === 0) return ''
    const data = dataLines.join('\n')
    if (data === '[DONE]') return completedEvent()

    let json: Record<string, unknown>
    try {
      json = JSON.parse(data) as Record<string, unknown>
    } catch {
      return ''
    }
    if (typeof json.id === 'string' && json.id) responseId = json.id
    const choices = Array.isArray(json.choices) ? json.choices : []
    const firstChoice = (choices[0] && typeof choices[0] === 'object' ? choices[0] : {}) as Record<string, unknown>
    const delta = (firstChoice.delta && typeof firstChoice.delta === 'object' ? firstChoice.delta : {}) as Record<string, unknown>
    const token = typeof delta.content === 'string' ? delta.content : ''

    let out = ''
    if (token) {
      out += formatResponsesSseEvent('response.output_text.delta', {
        delta: token,
        response: { id: responseId },
      })
    }
    if (firstChoice.finish_reason === 'stop' || firstChoice.finish_reason === 'length') {
      out += completedEvent()
    }
    return out
  }

  function completedEvent(): string {
    if (completed) return ''
    completed = true
    return formatResponsesSseEvent('response.completed', {
      response: { id: responseId, status: 'completed', degraded_from: 'chat.completions' },
    })
  }

  return {
    push(text: string): string {
      buffer += text.replace(/\r\n/g, '\n')
      let out = ''
      while (buffer.includes('\n\n')) {
        const index = buffer.indexOf('\n\n')
        const block = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 2)
        if (block) out += translateBlock(block)
      }
      return out
    },
    flush(): string {
      let out = ''
      const block = buffer.trim()
      buffer = ''
      if (block) out += translateBlock(block)
      out += completedEvent()
      return out
    },
  }
}

function translateChatStreamToResponses(upstream: ReadableStream<Uint8Array>, responseId: string): ReadableStream<Uint8Array> {
  const translator = createChatSseTranslator(responseId)
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const out = translator.push(decoder.decode(value, { stream: true }))
          if (out) controller.enqueue(encoder.encode(out))
        }
        const tail = translator.flush()
        if (tail) controller.enqueue(encoder.encode(tail))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'degraded responses stream interrupted'
        controller.enqueue(
          encoder.encode(
            formatResponsesSseEvent('response.failed', {
              response: { status: 'failed', error: { message } },
              error: { message },
            })
          )
        )
      } finally {
        controller.close()
      }
    },
  })
}

// 上游对 /v1/responses 的「端点不存在」信号；5xx 不算（那是运行错误，应透传）。
const RESPONSES_FALLBACK_STATUS = new Set([404, 405, 501])

export async function runtimeResponses(body: ResponsesRequestBody): Promise<Response> {
  if (agentProviderSupports('gateway.responses')) {
    const resp = await gatewayFetch('/v1/responses', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!RESPONSES_FALLBACK_STATUS.has(resp.status)) return resp
    // 声明了能力但端点缺失（如 openai-compatible 网关误标），继续降级。
  }
  return degradedResponses(body)
}

async function degradedResponses(body: ResponsesRequestBody): Promise<Response> {
  const messages = responsesInputToChatMessages(body.input)
  if (messages.length === 0) {
    return Response.json(
      { error: `${AGENT_PROVIDER_DISPLAY_NAME} Responses 降级失败：input 为空或无法转换为 messages` },
      { status: 400 }
    )
  }
  const chatBody: Record<string, unknown> = {
    model: body.model,
    messages,
    stream: Boolean(body.stream),
  }
  const resp = await runtimeChatCompletions(chatBody)
  if (!resp.ok) return resp

  if (body.stream) {
    if (!resp.body) {
      return Response.json({ error: `${AGENT_PROVIDER_DISPLAY_NAME} 返回了空的流式响应` }, { status: 502 })
    }
    return new Response(translateChatStreamToResponses(resp.body, ''), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const payload = chatCompletionToResponsePayload(await resp.json(), String(body.model || ''))
  return Response.json(payload)
}

// ---------------------------------------------------------------------------
// Models（可选能力；缺失时返回真实空列表）
// ---------------------------------------------------------------------------

export async function runtimeListModels(): Promise<Response> {
  if (!agentProviderSupports('gateway.models')) {
    return Response.json({ object: 'list', data: [] })
  }
  return gatewayFetch('/v1/models')
}

// ---------------------------------------------------------------------------
// Jobs / 定时任务（可选能力）
// ---------------------------------------------------------------------------

export const runtimeJobs = {
  supported(): boolean {
    return agentProviderSupports('gateway.jobs')
  },
  async list(): Promise<Response> {
    return gatewayFetch('/api/jobs?include_disabled=true')
  },
  async create(body: unknown): Promise<Response> {
    return gatewayFetch('/api/jobs', { method: 'POST', body: JSON.stringify(body) })
  },
  async pause(id: string): Promise<Response> {
    return gatewayFetch(`/api/jobs/${encodeURIComponent(id)}/pause`, { method: 'POST' })
  },
  async resume(id: string): Promise<Response> {
    return gatewayFetch(`/api/jobs/${encodeURIComponent(id)}/resume`, { method: 'POST' })
  },
  async run(id: string): Promise<Response> {
    return gatewayFetch(`/api/jobs/${encodeURIComponent(id)}/run`, { method: 'POST' })
  },
  async remove(id: string): Promise<Response> {
    return gatewayFetch(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}

// ---------------------------------------------------------------------------
// Sessions / 会话（可选能力）
// ---------------------------------------------------------------------------

export const runtimeSessions = {
  supported(): boolean {
    return agentProviderSupports('gateway.sessions')
  },
  async list(limit = 100): Promise<Response> {
    return gatewayFetch(`/api/sessions?limit=${limit}`)
  },
  async get(id: string): Promise<Response> {
    return gatewayFetch(`/api/sessions/${encodeURIComponent(id)}`)
  },
  async messages(id: string): Promise<Response> {
    return gatewayFetch(`/api/sessions/${encodeURIComponent(id)}/messages`)
  },
  async remove(id: string): Promise<Response> {
    return gatewayFetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}
