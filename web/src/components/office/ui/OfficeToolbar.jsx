import { useRef } from "react"
import { ZoomInIcon, ZoomOutIcon, RotateCcwIcon, UsersIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOfficeStore } from "../store"

export default function OfficeToolbar({ sceneRef, onMeeting }) {
  const zoom = useOfficeStore((s) => s.zoom)
  const setZoom = useOfficeStore((s) => s.setZoom)
  const resetZoom = useOfficeStore((s) => s.resetZoom)
  const meetingState = useOfficeStore((s) => s.meetingState)
  const setMeetingState = useOfficeStore((s) => s.setMeetingState)
  const meetingTimer = useRef(null)

  const handleZoomIn = () => {
    setZoom(zoom + 0.2)
    setTimeout(() => sceneRef.current?.scene.resize(), 0)
  }

  const handleZoomOut = () => {
    setZoom(zoom - 0.2)
    setTimeout(() => sceneRef.current?.scene.resize(), 0)
  }

  const handleReset = () => {
    resetZoom()
    setTimeout(() => sceneRef.current?.scene.resize(), 0)
  }

  const handleMeeting = () => {
    const { charManager, pathfinder } = sceneRef.current || {}
    if (!charManager || !pathfinder) return

    clearTimeout(meetingTimer.current)

    if (meetingState === "idle") {
      // 开会：全员走向会议室
      setMeetingState("going")
      charManager.moveAllToMeeting(pathfinder)
      meetingTimer.current = setTimeout(() => setMeetingState("meeting"), 4000)
      onMeeting?.()
    } else if (meetingState === "meeting") {
      // 散会：全员回工位
      setMeetingState("returning")
      charManager.moveAllToDesks(pathfinder)
      meetingTimer.current = setTimeout(() => setMeetingState("idle"), 4000)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={meetingState === "meeting" ? "default" : "outline"}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={handleMeeting}
        disabled={meetingState === "going" || meetingState === "returning"}
      >
        <UsersIcon className="size-3.5" />
        {meetingState === "idle" && "开会"}
        {meetingState === "going" && "前往会议室..."}
        {meetingState === "meeting" && "散会"}
        {meetingState === "returning" && "回工位..."}
      </Button>
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
