import { useRef, useState } from "react"
import { ZoomInIcon, ZoomOutIcon, RotateCcwIcon, UsersIcon, ChevronDownIcon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOfficeStore } from "../store"

export default function OfficeToolbar({ sceneRef, onMeeting }) {
  const zoom = useOfficeStore((s) => s.zoom)
  const meetingState = useOfficeStore((s) => s.meetingState)
  const setMeetingState = useOfficeStore((s) => s.setMeetingState)
  const meetingTimer = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleZoomIn = () => {
    sceneRef.current?.engine?.zoomBy(1.2)
  }

  const handleZoomOut = () => {
    sceneRef.current?.engine?.zoomBy(1 / 1.2)
  }

  const handleReset = () => {
    sceneRef.current?.engine?.resetView()
  }

  const dismissMeeting = () => {
    const engine = sceneRef.current?.engine
    if (!engine) return
    setMeetingState("returning")
    engine.endMeeting()
    meetingTimer.current = setTimeout(() => setMeetingState("idle"), 4000)
    setMenuOpen(false)
  }

  const handleMeeting = () => {
    const engine = sceneRef.current?.engine
    if (!engine) return

    clearTimeout(meetingTimer.current)

    if (meetingState === "idle") {
      setMeetingState("going")
      engine.startMeeting()
      meetingTimer.current = setTimeout(() => setMeetingState("meeting"), 4000)
    }
  }

  const handleSummary = () => {
    dismissMeeting()
    onMeeting?.()
  }

  return (
    <div className="flex items-center gap-1">
      {meetingState === "meeting" ? (
        <div className="relative flex">
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs rounded-r-none"
            onClick={handleSummary}
          >
            <SparklesIcon className="size-3.5" />
            总结
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-6 p-0 rounded-l-none border-l-0"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <ChevronDownIcon className="size-3" />
          </Button>
          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-10 py-0.5 min-w-[80px]">
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
                onClick={dismissMeeting}
              >
                散会
              </button>
            </div>
          )}
        </div>
      ) : (
        <Button
          variant={meetingState === "returning" ? "outline" : "default"}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleMeeting}
          disabled={meetingState === "going" || meetingState === "returning"}
        >
          <UsersIcon className="size-3.5" />
          {meetingState === "idle" && "开会"}
          {meetingState === "going" && "前往会议室..."}
          {meetingState === "returning" && "回工位..."}
        </Button>
      )}
      <div className="mx-1 h-4 w-px bg-border" />
      <Button variant="ghost" size="icon" className="size-7" onClick={handleZoomOut} title="缩小">
        <ZoomOutIcon className="size-3.5" />
      </Button>
      <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="icon" className="size-7" onClick={handleZoomIn} title="放大">
        <ZoomInIcon className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="size-7" onClick={handleReset} title="重置视角">
        <RotateCcwIcon className="size-3.5" />
      </Button>
    </div>
  )
}
