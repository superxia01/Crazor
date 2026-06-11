// M2 适配层不变量测试：Responses ⇄ Chat Completions 协议翻译。
// 运行：cd server && bun test src/services/agent-runtime.test.ts

import { describe, expect, test } from 'bun:test'
import {
  chatCompletionToResponsePayload,
  createChatSseTranslator,
  formatResponsesSseEvent,
  responsesInputToChatMessages,
} from './agent-runtime'

function parseSseEvents(text: string): Array<{ event: string; data: Record<string, unknown> }> {
  return text
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      const event = lines.find((l) => l.startsWith('event: '))?.slice(7) || ''
      const data = lines.find((l) => l.startsWith('data: '))?.slice(6) || '{}'
      return { event, data: JSON.parse(data) }
    })
}

describe('responsesInputToChatMessages', () => {
  test('字符串 input → 单条 user 消息', () => {
    expect(responsesInputToChatMessages('你好')).toEqual([{ role: 'user', content: '你好' }])
  })

  test('消息数组直接映射 role/content', () => {
    const input = [
      { role: 'system', content: '你是助手' },
      { role: 'user', content: '查任务' },
    ]
    expect(responsesInputToChatMessages(input)).toEqual(input)
  })

  test('content parts 数组拼接 text 段', () => {
    const input = [{ role: 'user', content: [{ type: 'input_text', text: 'a' }, { type: 'input_text', text: 'b' }] }]
    expect(responsesInputToChatMessages(input)).toEqual([{ role: 'user', content: 'a\nb' }])
  })

  test('非法 input 返回空数组', () => {
    expect(responsesInputToChatMessages(null)).toEqual([])
    expect(responsesInputToChatMessages([{ content: 42 }])).toEqual([])
  })
})

describe('createChatSseTranslator', () => {
  test('delta 内容翻译为 response.output_text.delta，[DONE] 翻译为 response.completed', () => {
    const translator = createChatSseTranslator('')
    const chunk =
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"你"}}]}\n\n' +
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"好"}}]}\n\n' +
      'data: [DONE]\n\n'
    const events = parseSseEvents(translator.push(chunk) + translator.flush())
    expect(events.map((e) => e.event)).toEqual([
      'response.output_text.delta',
      'response.output_text.delta',
      'response.completed',
    ])
    expect(events[0].data.delta).toBe('你')
    expect(events[1].data.delta).toBe('好')
    // 前端从任意事件的 response.id 取会话续聊 id
    expect((events[2].data.response as Record<string, unknown>).id).toBe('chatcmpl-1')
  })

  test('跨 chunk 撕裂的 SSE 块能正确缓冲重组', () => {
    const translator = createChatSseTranslator('')
    const full = 'data: {"id":"chatcmpl-2","choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n'
    let out = ''
    for (const char of full) out += translator.push(char) // 一次一个字符的极端撕裂
    out += translator.flush()
    const events = parseSseEvents(out)
    expect(events.map((e) => e.event)).toEqual(['response.output_text.delta', 'response.completed'])
    expect(events[0].data.delta).toBe('hello')
  })

  test('finish_reason=stop 与 [DONE] 同时出现时 completed 只发一次', () => {
    const translator = createChatSseTranslator('')
    const chunk =
      'data: {"id":"c3","choices":[{"delta":{"content":"x"},"finish_reason":null}]}\n\n' +
      'data: {"id":"c3","choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
      'data: [DONE]\n\n'
    const events = parseSseEvents(translator.push(chunk) + translator.flush())
    expect(events.filter((e) => e.event === 'response.completed')).toHaveLength(1)
  })

  test('无 [DONE] 的上游流在 flush 时兜底 completed', () => {
    const translator = createChatSseTranslator('')
    const out = translator.push('data: {"id":"c4","choices":[{"delta":{"content":"y"}}]}\n\n') + translator.flush()
    const events = parseSseEvents(out)
    expect(events.at(-1)?.event).toBe('response.completed')
  })
})

describe('chatCompletionToResponsePayload', () => {
  test('非流式 chat 结果转换为 Responses 形状', () => {
    const payload = chatCompletionToResponsePayload(
      {
        id: 'chatcmpl-9',
        model: 'gpt-x',
        choices: [{ message: { role: 'assistant', content: '答案' } }],
        usage: { total_tokens: 7 },
      },
      'fallback-model'
    )
    expect(payload.id).toBe('chatcmpl-9')
    expect(payload.status).toBe('completed')
    expect(payload.output_text).toBe('答案')
    expect(payload.degraded_from).toBe('chat.completions')
    const output = payload.output as Array<Record<string, unknown>>
    expect(output[0].type).toBe('message')
    expect((output[0].content as Array<Record<string, unknown>>)[0]).toEqual({ type: 'output_text', text: '答案' })
  })

  test('空 choices 不抛错，输出空文本', () => {
    const payload = chatCompletionToResponsePayload({}, 'm')
    expect(payload.output_text).toBe('')
    expect(payload.model).toBe('m')
  })
})

describe('formatResponsesSseEvent', () => {
  test('输出 event/data 两行块，data 含 type 字段', () => {
    const text = formatResponsesSseEvent('response.completed', { response: { id: 'r1' } })
    const events = parseSseEvents(text)
    expect(events[0].event).toBe('response.completed')
    expect(events[0].data.type).toBe('response.completed')
  })
})
