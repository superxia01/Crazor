// Crazor Event Bus — M1 实时数据底座
// 进程内 pub/sub（Crazor 为单进程 Bun 服务，无需外部 MQ）。
// 维护最近 RING_SIZE 条事件的内存环形缓冲，供新连接 / REST 查询按 since 回放。
// 约定：emit 永不抛错（内部消化）；单个订阅者回调异常不影响其他订阅者。

export type CrazorEventType =
  | 'entity.created'
  | 'entity.updated'
  | 'entity.deleted'
  | 'mcp.tool_called'
  | 'member.joined'
  | 'presence.online'
  | 'presence.offline'

export interface CrazorEvent {
  id: number
  ts: string
  type: CrazorEventType
  actor_id: string
  actor_name: string
  actor_type: string
  entity: string
  entity_id: string
  summary: string
  data?: Record<string, unknown>
}

export interface CrazorEventInput {
  type: CrazorEventType
  actor_id?: string
  actor_name?: string
  actor_type?: string
  entity?: string
  entity_id?: string
  summary?: string
  data?: Record<string, unknown>
}

type EventSubscriber = (event: CrazorEvent) => void

const RING_SIZE = 500

// 以启动时间为种子，保证进程重启后 id 仍单调递增，前端的 since 游标不会倒退。
let eventSeq = Date.now()
const ringBuffer: CrazorEvent[] = []
const subscribers = new Set<EventSubscriber>()

/**
 * 发射一条事件。永不抛错：构造失败返回 null，订阅者异常逐个吞掉。
 * 事件总线挂掉不能影响主业务。
 */
export function emitEvent(input: CrazorEventInput): CrazorEvent | null {
  try {
    const event: CrazorEvent = {
      id: ++eventSeq,
      ts: new Date().toISOString(),
      type: input.type,
      actor_id: String(input.actor_id || 'anonymous'),
      actor_name: String(input.actor_name || ''),
      actor_type: String(input.actor_type || 'human'),
      entity: String(input.entity || ''),
      entity_id: String(input.entity_id || ''),
      summary: String(input.summary || ''),
      ...(input.data ? { data: input.data } : {}),
    }

    ringBuffer.push(event)
    if (ringBuffer.length > RING_SIZE) {
      ringBuffer.splice(0, ringBuffer.length - RING_SIZE)
    }

    for (const subscriber of subscribers) {
      try {
        subscriber(event)
      } catch (err) {
        console.error('[event-bus] subscriber callback failed:', err)
      }
    }
    return event
  } catch (err) {
    console.error('[event-bus] emit failed:', err)
    return null
  }
}

/** 订阅事件流。返回取消订阅函数。 */
export function subscribeEvents(subscriber: EventSubscriber): () => void {
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

/**
 * 从环形缓冲读取最近事件。
 * @param since 只返回 id 大于 since 的事件（0 = 不过滤）
 * @param limit 最多返回条数（取尾部最新的 limit 条）
 */
export function getRecentEvents(since = 0, limit = 50): CrazorEvent[] {
  const cappedLimit = Math.max(1, Math.min(Math.floor(limit) || 50, RING_SIZE))
  const filtered = since > 0 ? ringBuffer.filter((event) => event.id > since) : ringBuffer
  return filtered.slice(-cappedLimit)
}

/** 当前环形缓冲中最新事件的 id（无事件时为启动种子值）。 */
export function latestEventId(): number {
  return eventSeq
}

/**
 * 审计 action → entity.* 事件类型映射。
 * deny_* / 读审计等不产生实体事件时返回 null。
 */
export function entityEventTypeFromAuditAction(action: string): CrazorEventType | null {
  const normalized = String(action || '').trim()
  if (!normalized || normalized.startsWith('deny_')) return null
  if (normalized === 'create') return 'entity.created'
  if (normalized === 'delete') return 'entity.deleted'
  // update / move / publish / update_metrics / redeem 等其余写动作统一视为更新
  return 'entity.updated'
}
