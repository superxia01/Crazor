// Copyright (c) 2026 MeeJoy
// M1 event bus: WebSocket client hook for the realtime event stream (/api/events/ws)

import { useCallback, useEffect, useRef, useState } from "react"

const MAX_EVENTS = 200
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000

function buildWsUrl() {
  const base = import.meta.env.VITE_API_BASE || ""
  let origin
  if (/^https?:\/\//i.test(base)) {
    origin = base.replace(/^http/i, "ws").replace(/\/+$/, "")
  } else {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    origin = `${proto}//${window.location.host}`
  }
  let token = null
  try {
    token = localStorage.getItem("crazor_token")
  } catch {
    token = null
  }
  const query = token ? `?token=${encodeURIComponent(token)}` : ""
  return `${origin}/api/events/ws${query}`
}

/**
 * 订阅 Crazor 实时事件流。
 *
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] 为 false 时不建立连接
 * @param {(event: Object) => void} [options.onEvent] 每条事件的回调（presence 事件也会触发）
 * @returns {{ events: Array, online: Array, connected: boolean }}
 *   events: 最近事件（含 hello 回放，最多 200 条，新事件在尾部）
 *   online: 当前在线成员 [{member_id, name, connected_at, connections}]
 *   connected: WS 是否已连接
 */
export function useCrazorEvents({ enabled = true, onEvent } = {}) {
  const [events, setEvents] = useState([])
  const [online, setOnline] = useState([])
  const [connected, setConnected] = useState(false)

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const wsRef = useRef(null)
  const retryRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const closedRef = useRef(false)

  const appendEvents = useCallback((incoming) => {
    if (!incoming.length) return
    setEvents((prev) => {
      // 重连时 hello 会回放最近事件，按 id 去重
      const known = new Set(prev.map((item) => item.id))
      const fresh = incoming.filter((item) => item && item.id != null && !known.has(item.id))
      if (!fresh.length) return prev
      const merged = [...prev, ...fresh]
      return merged.length > MAX_EVENTS ? merged.slice(-MAX_EVENTS) : merged
    })
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    closedRef.current = false

    const connect = () => {
      if (closedRef.current) return
      let ws
      try {
        ws = new WebSocket(buildWsUrl())
      } catch {
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        retryRef.current = 0
        setConnected(true)
      }

      ws.onmessage = (raw) => {
        let msg = null
        try {
          msg = JSON.parse(raw.data)
        } catch {
          return
        }
        if (msg?.type === "hello") {
          setOnline(Array.isArray(msg.online) ? msg.online : [])
          if (Array.isArray(msg.recent)) appendEvents(msg.recent)
          return
        }
        if (msg?.type === "ping") {
          try {
            ws.send(JSON.stringify({ type: "pong" }))
          } catch { /* ignore */ }
          return
        }
        if (msg?.type === "event" && msg.event) {
          const event = msg.event
          if (Array.isArray(event?.data?.online)) {
            setOnline(event.data.online)
          }
          appendEvents([event])
          try {
            onEventRef.current?.(event)
          } catch { /* consumer error must not break the stream */ }
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (wsRef.current === ws) wsRef.current = null
        scheduleReconnect()
      }

      ws.onerror = () => {
        try {
          ws.close()
        } catch { /* ignore */ }
      }
    }

    const scheduleReconnect = () => {
      if (closedRef.current || reconnectTimerRef.current) return
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** retryRef.current, RECONNECT_MAX_MS)
      retryRef.current += 1
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    connect()

    return () => {
      closedRef.current = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      const ws = wsRef.current
      wsRef.current = null
      if (ws) {
        ws.onclose = null
        try {
          ws.close()
        } catch { /* ignore */ }
      }
      setConnected(false)
    }
  }, [enabled, appendEvents])

  return { events, online, connected }
}

export default useCrazorEvents
