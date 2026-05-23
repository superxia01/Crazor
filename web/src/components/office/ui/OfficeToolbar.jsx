import { ZoomInIcon, ZoomOutIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOfficeStore } from "../store"

export default function OfficeToolbar({ sceneRef }) {
  const zoom = useOfficeStore((s) => s.zoom)
  const setZoom = useOfficeStore((s) => s.setZoom)
  const resetZoom = useOfficeStore((s) => s.resetZoom)

  const handleZoomIn = () => {
    setZoom(zoom + 0.2)
    // Trigger scene resize to apply new zoom
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

  return (
    <div className="flex items-center gap-1">
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
