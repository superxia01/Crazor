// Copyright (c) 2026 MeeJoy

import { createElement as h, useState, useEffect, useCallback } from "react"
import {
  CalendarIcon,
  KanbanSquareIcon,
  PlusIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataForm } from "@/components/data-view"
import { BadgeCell } from "@/components/data-view/DataGrid"
import { cn } from "@/lib/utils"

const PRIORITY_MAP = {
  high: { label: "高", variant: "bg-rose-500/12 text-rose-600 border-rose-500/20" },
  medium: { label: "中", variant: "bg-amber-500/12 text-amber-600 border-amber-500/20" },
  low: { label: "低", variant: "bg-emerald-500/12 text-emerald-600 border-emerald-500/20" },
}

const ASSIGNEE_COLORS = ["bg-blue-500/15 text-blue-600", "bg-violet-500/15 text-violet-600", "bg-emerald-500/15 text-emerald-600", "bg-amber-500/15 text-amber-600"]

const TASK_STATUSES = ["todo", "doing", "done"]

const FORM_FIELDS = [
  { key: "title", label: "任务标题", required: true, placeholder: "任务标题 *" },
  { key: "description", label: "描述", placeholder: "描述" },
  { key: "priority", label: "优先级", type: "select", options: ["high", "medium", "low"], defaultValue: "medium" },
  { key: "assignee", label: "指派人", placeholder: "指派人" },
  { key: "due_date", label: "截止日期", type: "date" },
]

export default {
  apiBase: "/api/crazor/tasks",
  icon: KanbanSquareIcon,
  badge: "Project",
  title: "项目看板",
  description: "任务管理与进度追踪",
  createLabel: "新增任务",
  createDialogTitle: "新建任务",
  createDialogDesc: "添加到当前项目",
  createToast: "任务已创建",
  searchable: false,
  editable: false,
  deletable: true,
  filterParam: "status",

  // Load projects list as extra data
  loadExtra: async () => {
    const resp = await fetch("/api/crazor/projects")
    const projects = resp.ok ? await resp.json() : []
    return { projects }
  },

  // Project selector in header actions
  headerActions: ({ extraData }) => {
    const projects = extraData?.projects || []
    return h(ProjectSelector, { projects })
  },

  // extraParams: add project_id to API request
  extraParams: () => {
    const sel = typeof window !== "undefined" ? window.__activeProject : null
    return sel ? { project: sel } : {}
  },

  stats: (items) => ({
    total: items.length,
    todo: items.filter((t) => t.status === "todo").length,
    doing: items.filter((t) => t.status === "doing").length,
    done: items.filter((t) => t.status === "done").length,
  }),

  statsGridCols: "grid-cols-2 lg:grid-cols-4",

  statsCards: (stats) => [
    { icon: KanbanSquareIcon, label: "总任务", value: stats.total },
    { icon: CalendarIcon, label: "待办", value: stats.todo, color: "text-blue-600" },
    { icon: CalendarIcon, label: "进行中", value: stats.doing, color: "text-amber-600" },
    { icon: CalendarIcon, label: "已完成", value: stats.done, color: "text-emerald-600" },
  ],

  filters: [
    { id: "all", label: "全部" },
    { id: "todo", label: "待办" },
    { id: "doing", label: "进行中" },
    { id: "done", label: "已完成" },
  ],

  columns: [
    {
      accessorKey: "title",
      header: "任务",
      cell: ({ getValue, row }) => (
        <div>
          <span className="font-medium">{getValue()}</span>
          {row.original.description && (
            <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{row.original.description}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "priority",
      header: "优先级",
      cell: ({ getValue }) => {
        const v = getValue()
        const info = PRIORITY_MAP[v] || PRIORITY_MAP.medium
        return <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", info.variant)}>{info.label}</span>
      },
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ getValue }) => {
        const v = getValue()
        const map = { todo: "待办", doing: "进行中", done: "已完成" }
        const cls = { todo: "bg-blue-100 text-blue-700", doing: "bg-amber-100 text-amber-700", done: "bg-emerald-100 text-emerald-700" }
        return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cls[v] || "")}>{map[v] || v}</span>
      },
    },
    {
      accessorKey: "assignee",
      header: "指派",
      cell: ({ getValue }) => {
        const v = getValue()
        if (!v) return <span className="text-muted-foreground">-</span>
        const idx = v.charCodeAt(0) % ASSIGNEE_COLORS.length
        return (
          <div className="flex items-center gap-1.5">
            <Avatar className={cn("size-5", ASSIGNEE_COLORS[idx])}>
              <AvatarFallback className={cn("text-[10px]", ASSIGNEE_COLORS[idx])}>{v.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="text-[12px]">{v}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "due_date",
      header: "截止",
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? <span className="whitespace-nowrap text-[12px]">{v.slice(5)}</span> : <span className="text-muted-foreground">-</span>
      },
    },
  ],

  kanban: {
    laneKey: "status",
    lanes: [
      { id: "todo", label: "待办", color: "bg-blue-400" },
      { id: "doing", label: "进行中", color: "bg-amber-400" },
      { id: "done", label: "已完成", color: "bg-emerald-400" },
    ],
    renderCard: (item) => {
      const info = PRIORITY_MAP[item.priority] || PRIORITY_MAP.medium
      const idx = (item.assignee || "x").charCodeAt(0) % ASSIGNEE_COLORS.length
      return (
        <div className="rounded-lg border bg-card p-2.5 shadow-none">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", info.variant)}>{info.label}</span>
          </div>
          <div className="text-[12px] font-medium leading-snug">{item.title}</div>
          {item.description && <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{item.description}</div>}
          <div className="mt-2 flex items-center justify-between">
            {item.assignee ? (
              <Avatar className={cn("size-5", ASSIGNEE_COLORS[idx])}>
                <AvatarFallback className={cn("text-[10px]", ASSIGNEE_COLORS[idx])}>{item.assignee.slice(0, 1)}</AvatarFallback>
              </Avatar>
            ) : <div />}
            {item.due_date && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarIcon className="size-3" />{item.due_date.slice(5)}
              </div>
            )}
          </div>
        </div>
      )
    },
  },

  formFields: FORM_FIELDS,

  // Inject project_id into create
  beforeCreate: (data) => ({
    ...data,
    project_id: typeof window !== "undefined" ? window.__activeProject : undefined,
  }),

  detail: {
    detailTitleKey: "title",
    detailIcon: KanbanSquareIcon,
    detailIconBg: "bg-blue-500/10 text-blue-600",
    detailSubtitle: (item) => item.description || "",
    detailBadges: (item) => {
      const info = PRIORITY_MAP[item.priority] || PRIORITY_MAP.medium
      const statusMap = { todo: "待办", doing: "进行中", done: "已完成" }
      const statusCls = { todo: "bg-blue-100 text-blue-700", doing: "bg-amber-100 text-amber-700", done: "bg-emerald-100 text-emerald-700" }
      return [
        { label: info.label, cls: `rounded border px-2 py-0.5 text-[10px] font-medium ${info.variant}` },
        { label: statusMap[item.status] || item.status, cls: `rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCls[item.status] || ""}` },
      ]
    },
    detailFields: [
      { key: "assignee", label: "指派" },
      { key: "due_date", label: "截止日期" },
    ],
  },
}

// Project selector component rendered in header
function ProjectSelector({ projects }) {
  const [active, setActive] = useState(null)

  useEffect(() => {
    if (!active && projects.length > 0) {
      setActive(projects[0].id)
      window.__activeProject = projects[0].id
    }
  }, [projects, active])

  const handleSelect = useCallback((id) => {
    setActive(id)
    window.__activeProject = id
    // Trigger DataView reload by dispatching a custom event
    window.dispatchEvent(new CustomEvent("dataview-reload"))
  }, [])

  if (projects.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {projects.map((p) => (
        <Button
          key={p.id}
          variant="ghost"
          size="sm"
          onClick={() => handleSelect(p.id)}
          className={cn(
            "h-7 rounded-full px-3 text-[12px]",
            active === p.id ? "bg-primary/10 text-primary" : "text-muted-foreground",
          )}
        >
          {p.name}
        </Button>
      ))}
    </div>
  )
}
