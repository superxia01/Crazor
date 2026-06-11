import { useCallback, useEffect, useRef, useState } from "react"
import { Gamepad2Icon, PowerIcon } from "lucide-react"
import { ViewFrame } from "@/components/view-frame"
import { Button } from "@/components/ui/button"
import { useCrazorEvents } from "@/hooks/useCrazorEvents"
import { useOfficeStore } from "./store"
import { OfficeEngine } from "./engine2d/OfficeEngine"
import { describeEvent } from "./data/eventRouting"
import EmployeePanel from "./ui/EmployeePanel"
import OfficeToolbar from "./ui/OfficeToolbar"

const OFFICE_ENABLED_KEY = "crazor-office-3d-enabled"

function formatTime(ts) {
  try {
    return new Date(ts).toTimeString().slice(0, 8)
  } catch {
    return ""
  }
}

export default function OfficeView({ onSelectEmployee, onMeeting }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(OFFICE_ENABLED_KEY) === "true" } catch { return false }
  })
  const [ticker, setTicker] = useState("系统就绪 · 等待事件流接入")

  const employees = useOfficeStore((s) => s.employees)
  const selectedEmployeeId = useOfficeStore((s) => s.selectedEmployeeId)
  const delivered = useOfficeStore((s) => s.delivered)

  // M1 event bus: real events drive the office animations
  const handleEvent = useCallback((event) => {
    sceneRef.current?.engine?.handleEvent(event)
    const text = describeEvent(event)
    if (text) setTicker(text)
  }, [])
  const { events, online, connected } = useCrazorEvents({ enabled, onEvent: handleEvent })

  // Fetch employees on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch("/api/crazor/skills/catalog")
        if (resp.ok && !cancelled) {
          const catalog = await resp.json()
          useOfficeStore.getState().setEmployees(catalog)
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Initialize canvas-2d scene only when enabled
  useEffect(() => {
    if (!enabled || !containerRef.current || sceneRef.current) return

    const engine = new OfficeEngine(containerRef.current, useOfficeStore, {
      onTicker: setTicker,
    })
    sceneRef.current = { engine }

    return () => {
      engine.dispose()
      sceneRef.current = null
    }
  }, [enabled])

  // Sync employees → canvas characters
  useEffect(() => {
    if (!sceneRef.current || employees.length === 0) return
    sceneRef.current.engine.setEmployees(employees)
  }, [employees, enabled])

  // Presence: online human members walk in / out of the office
  useEffect(() => {
    sceneRef.current?.engine?.syncOnline(online)
  }, [online, enabled])

  // Connection state: dim the office while reconnecting
  useEffect(() => {
    sceneRef.current?.engine?.setConnected(connected)
  }, [connected, enabled])

  const handleToggle = () => {
    const next = !enabled
    setEnabled(next)
    try { localStorage.setItem(OFFICE_ENABLED_KEY, String(next)) } catch { /* ignore */ }
  }

  // Office disabled — show closed state
  if (!enabled) {
    return (
      <ViewFrame title="AI 数字员工办公室" description="2.5D 像素风虚拟办公空间">
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
              <Gamepad2Icon className="size-10 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">3D 办公室已关闭</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                开启后可在虚拟办公空间中查看 AI 数字员工
              </p>
            </div>
            <Button onClick={handleToggle} className="gap-2">
              <PowerIcon className="size-4" />
              开启 3D 办公室
            </Button>
          </div>
        </div>
      </ViewFrame>
    )
  }

  const staffCount = employees.filter((e) => e.id !== "vault-rules").length
  const recentEvents = events.slice(-6).reverse()

  // Office enabled — render event-driven neon scene
  return (
    <ViewFrame
      title="AI 数字员工办公室"
      description="2.5D 像素风虚拟办公空间"
      badge="BETA"
      actions={
        <div className="flex items-center gap-2">
          <OfficeToolbar sceneRef={sceneRef} onMeeting={onMeeting} />
          <Button variant="ghost" size="icon" className="size-7" onClick={handleToggle} title="关闭办公室">
            <PowerIcon className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      }
    >
      <div className="relative h-full w-full overflow-hidden bg-[#07070f]">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Top HUD: connection + event ticker + stats */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-[#08081299] to-transparent px-4 py-2 text-xs">
          <span className="flex shrink-0 items-center gap-1.5 text-[#8b90b8]">
            <span
              className={`size-2 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-red-400 animate-pulse"}`}
            />
            {connected ? "事件流已连接" : "重连中"}
          </span>
          <span className="min-w-0 flex-1 truncate text-[#00d4c8] [text-shadow:0_0_8px_rgba(0,212,200,.6)]">
            ◤ {ticker} ◢
          </span>
          <span className="hidden shrink-0 gap-3 text-[#8b90b8] sm:flex">
            <span>在岗 <b className="text-[#dfe3ff]">{staffCount}</b></span>
            <span>在线 <b className="text-[#dfe3ff]">{online.length}</b></span>
            <span>事件 <b className="text-[#dfe3ff]">{events.length}</b></span>
            <span>交付 <b className="text-[#dfe3ff]">{delivered}</b></span>
          </span>
        </div>

        {/* Event log (latest first) */}
        {recentEvents.length > 0 && (
          <div className="pointer-events-none absolute right-3 top-10 z-10 flex w-64 flex-col gap-1.5">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="animate-in slide-in-from-right rounded-md border border-white/5 border-l-2 border-l-[#7c5cff] bg-[#101222d0] px-2.5 py-1.5 text-[11px] leading-snug text-[#dfe3ff] backdrop-blur"
              >
                <span className="mr-1.5 text-[10px] text-[#8b90b8]">{formatTime(event.ts)}</span>
                {describeEvent(event)}
              </div>
            ))}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-[11px] text-[#8b90b8]">
          拖拽平移 · 滚轮缩放 · 点击员工跟拍
        </div>

        {selectedEmployeeId && (
          <EmployeePanel sceneRef={sceneRef} onStartChat={onSelectEmployee} />
        )}
      </div>
    </ViewFrame>
  )
}
