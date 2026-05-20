// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

const tokenListeners = new Set()
const doneListeners = new Set()
const errorListeners = new Set()
const toolEventListeners = new Set()
let _streamAbortController = null

function buildRequestEventPayload(requestId, payload = {}) {
  return {
    requestId,
    ...payload,
  }
}

// ========================
// Non-streaming chat
// ========================
export async function sendChat(messages, options = {}) {
  const { model = null } = options
  const json = await api.post('/api/chat/completions', {
    model: model || 'hermes-agent',
    messages,
    stream: false,
  })
  return { content: json?.choices?.[0]?.message?.content || '' }
}

// ========================
// Streaming chat (SSE via Responses API)
// ========================
export async function sendChatStream(messages, options = {}) {
  const { previousResponseId = null, replayHistory = true, model = null, requestId = '' } = options
  const input = replayHistory
    ? messages
    : messages[messages.length - 1]?.content || ''

  _streamAbortController?.abort()
  _streamAbortController = new AbortController()

  const response = await api.stream(
    '/api/responses',
    {
      model: model || 'hermes-agent',
      input,
      previous_response_id: previousResponseId,
      stream: true,
    },
    _streamAbortController.signal,
  ).catch((error) => {
    if (error?.name === 'AbortError') {
      emitBrowserDone()
      return null
    }
    const message = `连接失败: ${error.message}`
    emitBrowserError(message)
    throw error
  })

  if (!response) return null

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let streamCompleted = false
  let responseId = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')

    while (buffer.includes('\n\n')) {
      const index = buffer.indexOf('\n\n')
      const block = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 2)

      if (!block) continue

      let eventType = ''
      const dataLines = []

      for (const rawLine of block.split('\n')) {
        const line = rawLine.trimEnd()
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          dataLines.push(line.slice(6))
        }
      }

      if (dataLines.length === 0) continue

      const data = dataLines.join('\n')
      if (data === '[DONE]') {
        streamCompleted = true
        emitBrowserDone()
        _streamAbortController = null
        return
      }

      let json
      try {
        json = JSON.parse(data)
      } catch {
        continue
      }

      if (json?.response?.id) {
        responseId = json.response.id
      }

      if (eventType === 'response.output_text.delta') {
        const token = json?.delta
        if (token) emitBrowserToken(buildRequestEventPayload(requestId, { token }))
        continue
      }

      if (eventType === 'response.output_item.added') {
        const item = json?.item || {}
        if (item.type === 'function_call') {
          emitBrowserToolEvent({
            requestId,
            phase: 'started',
            name: item.name || null,
            callId: item.call_id || null,
            arguments: item.arguments || null,
            output: null,
            status: item.status || null,
          })
        } else if (item.type === 'function_call_output') {
          const output = Array.isArray(item.output)
            ? item.output.map((part) => part?.text).filter(Boolean).join('\n')
            : ''
          emitBrowserToolEvent({
            requestId,
            phase: 'completed',
            name: null,
            callId: item.call_id || null,
            arguments: null,
            output: output || null,
            status: item.status || null,
          })
        }
        continue
      }

      if (eventType === 'response.failed') {
        const message =
          json?.response?.error?.message ||
          json?.error?.message ||
          'Hermes Responses API failed'
        emitBrowserError(message)
        throw new Error(message)
      }

      if (eventType === 'response.completed') {
        streamCompleted = true
        emitBrowserDone(buildRequestEventPayload(requestId))
        _streamAbortController = null
        return responseId
      }
    }
  }

  if (!streamCompleted) {
    emitBrowserDone(buildRequestEventPayload(requestId))
  }
  _streamAbortController = null
  return responseId
}

export async function cancelChatStream(requestId = '') {
  _streamAbortController?.abort()
  _streamAbortController = null
}

export async function onChatToken(callback) {
  tokenListeners.add(callback)
  return () => tokenListeners.delete(callback)
}

export async function onChatDone(callback) {
  doneListeners.add(callback)
  return () => doneListeners.delete(callback)
}

export async function onChatError(callback) {
  errorListeners.add(callback)
  return () => errorListeners.delete(callback)
}

export async function onChatToolEvent(callback) {
  toolEventListeners.add(callback)
  return () => toolEventListeners.delete(callback)
}

// SSE event emitter functions
export function emitBrowserToken(payload) {
  tokenListeners.forEach((listener) => listener(payload))
}

export function emitBrowserDone(payload = {}) {
  doneListeners.forEach((listener) => listener(payload))
}

export function emitBrowserError(payload) {
  errorListeners.forEach((listener) => listener(payload))
}

export function emitBrowserToolEvent(event) {
  toolEventListeners.forEach((listener) => listener(event))
}
