import { useEffect, useState } from "react"
import {
  BookOpenIcon,
  DatabaseIcon,
  GlobeIcon,
  MessageSquareIcon,
  ServerIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOfficeStore } from "../store"

const META_SECTIONS = [
  { key: "mcpTools", label: "MCP 工具", icon: WrenchIcon, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "apis", label: "内部 API", icon: ServerIcon, color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "dbTables", label: "数据表", icon: DatabaseIcon, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "externalApis", label: "外部 API", icon: GlobeIcon, color: "bg-orange-100 text-orange-700 border-orange-200" },
]

export default function EmployeePanel({ sceneRef, onStartChat }) {
  const employees = useOfficeStore((s) => s.employees)
  const selectedId = useOfficeStore((s) => s.selectedEmployeeId)
  const metaCache = useOfficeStore((s) => s.metaCache)
  const selectEmployee = useOfficeStore((s) => s.selectEmployee)
  const setMeta = useOfficeStore((s) => s.setMeta)
  const charManager = sceneRef.current?.charManager

  const employee = employees.find((e) => e.id === selectedId)
  const meta = selectedId ? metaCache[selectedId] : null

  // Fetch meta on selection
  useEffect(() => {
    if (!selectedId) return
    if (metaCache[selectedId]) return
    let cancelled = false
    fetch(`/api/crazor/skills/meta/${encodeURIComponent(selectedId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setMeta(selectedId, data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedId])

  if (!employee) return null

  const handleClose = () => {
    selectEmployee(null)
    charManager?.unhighlight()
  }

  const handleStartChat = () => {
    onStartChat?.(selectedId)
    handleClose()
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-background border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{employee.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{employee.description}</p>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Tags */}
      {employee.tags?.length > 0 && (
        <div className="px-4 py-2 border-b flex flex-wrap gap-1">
          {employee.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Architecture sections */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
        {meta ? (
          META_SECTIONS.map(({ key, label, icon: Icon, color }) => {
            const items = meta[key]
            if (!items || items.length === 0) return null
            return (
              <div key={key}>
                <div className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {label}
                  <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {items.map((item) => (
                    <Badge key={item} variant="outline" className={`text-xs font-mono ${color}`}>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8">加载中...</div>
        )}

        {meta && (
          <div className="pt-3 border-t text-xs text-muted-foreground">
            <p className="font-medium mb-1">架构概览</p>
            <p>
              Skill → MCP ({meta.mcpTools?.length ?? 0}) → API ({meta.apis?.length ?? 0}) → DB ({meta.dbTables?.length ?? 0})
            </p>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="px-4 py-3 border-t">
        <Button className="w-full gap-2" onClick={handleStartChat}>
          <MessageSquareIcon className="size-4" />
          开始对话
        </Button>
      </div>
    </div>
  )
}
