// Copyright (c) 2026 MeeJoy

import { useMemo, useState } from "react"
import { CalendarIcon, KanbanSquareIcon, PlusIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ── Mock data ──────────────────────────────────────────────

const MOCK_PROJECTS = [
  {
    id: "p1",
    name: "Crazor v1.0 上线",
    tasks: [
      { id: "t1", title: "首页 UI 设计稿确认", priority: "high", assignee: "张明", dueDate: "2026-05-20", status: "todo", desc: "与设计团队确认首页布局和配色方案" },
      { id: "t2", title: "用户认证模块开发", priority: "high", assignee: "李伟", dueDate: "2026-05-22", status: "doing", desc: "JWT 认证 + 第三方登录集成" },
      { id: "t3", title: "API 文档编写", priority: "medium", assignee: "王芳", dueDate: "2026-05-25", status: "todo", desc: "OpenAPI 3.0 格式文档" },
      { id: "t4", title: "数据库迁移脚本", priority: "medium", assignee: "赵刚", dueDate: "2026-05-23", status: "doing", desc: "SQLite → PostgreSQL 迁移" },
      { id: "t5", title: "单元测试覆盖率 > 80%", priority: "low", assignee: "李伟", dueDate: "2026-05-28", status: "todo", desc: "核心模块测试补全" },
      { id: "t6", title: "竞品分析报告", priority: "low", assignee: "陈婷", dueDate: "2026-05-18", status: "done", desc: "分析 5 个主要竞品的功能和定价" },
      { id: "t7", title: "域名和 SSL 配置", priority: "medium", assignee: "赵刚", dueDate: "2026-05-16", status: "done", desc: "配置 crazor.ai 域名和证书" },
    ],
  },
  {
    id: "p2",
    name: "AI 数字员工市场",
    tasks: [
      { id: "t8", title: "技能模板数据结构设计", priority: "high", assignee: "王芳", dueDate: "2026-05-21", status: "doing", desc: "定义模板 JSON Schema" },
      { id: "t9", title: "支付集成（支付宝/微信）", priority: "high", assignee: "李伟", dueDate: "2026-06-01", status: "todo", desc: "接入支付回调流程" },
      { id: "t10", title: "评分和评论系统", priority: "medium", assignee: "张明", dueDate: "2026-06-05", status: "todo", desc: "用户评分 + 文字评论" },
    ],
  },
]

const COLUMNS = [
  { id: "todo", label: "待办", dot: "bg-blue-500" },
  { id: "doing", label: "进行中", dot: "bg-amber-500" },
  { id: "done", label: "已完成", dot: "bg-emerald-500" },
]

const PRIORITY_MAP = {
  high: { label: "高", variant: "bg-rose-500/12 text-rose-600 border-rose-500/20" },
  medium: { label: "中", variant: "bg-amber-500/12 text-amber-600 border-amber-500/20" },
  low: { label: "低", variant: "bg-emerald-500/12 text-emerald-600 border-emerald-500/20" },
}

const ASSIGNEE_COLORS = [
  "bg-blue-500/15 text-blue-600",
  "bg-violet-500/15 text-violet-600",
  "bg-emerald-500/15 text-emerald-600",
  "bg-amber-500/15 text-amber-600",
]

// ── Component ──────────────────────────────────────────────

export default function ProjectsView() {
  const [activeProject, setActiveProject] = useState(MOCK_PROJECTS[0].id)

  const project = MOCK_PROJECTS.find((p) => p.id === activeProject)

  const columns = useMemo(
    () =>
      COLUMNS.map((col) => ({
        ...col,
        tasks: project.tasks.filter((t) => t.status === col.id),
      })),
    [project],
  )

  return (
    <div className="flex h-full flex-col">
      {/* Top bar — no ViewFrame, custom layout for full-width kanban */}
      <div className="flex items-center justify-between border-b border-border/92 px-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="rounded-full border-border/92 bg-sidebar/48 px-2 py-0.5 text-[10px] text-muted-foreground">
            <KanbanSquareIcon className="size-3.5" />
            Project
          </Badge>
          <h1 className="text-[1rem] font-semibold tracking-tight">项目看板</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Project tabs */}
          {MOCK_PROJECTS.map((p) => (
            <Button
              key={p.id}
              variant={activeProject === p.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveProject(p.id)}
              className={cn(
                "h-7 rounded-full px-3 text-[12px]",
                activeProject === p.id && "bg-primary/10 text-primary",
              )}
            >
              {p.name}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Kanban columns */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {columns.map((col) => (
          <div key={col.id} className="flex flex-1 flex-col min-w-0">
            {/* Column header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", col.dot)} />
                <span className="text-[13px] font-medium">{col.label}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {col.tasks.length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="size-6">
                <PlusIcon className="size-3.5" />
              </Button>
            </div>

            {/* Task cards */}
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-2.5 pb-4">
                {col.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {col.tasks.length === 0 && (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 py-8 text-[12px] text-muted-foreground">
                    暂无任务
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────

function TaskCard({ task }) {
  const priorityInfo = PRIORITY_MAP[task.priority]
  const colorIdx = task.assignee.charCodeAt(0) % ASSIGNEE_COLORS.length

  return (
    <Card className="cursor-pointer shadow-none transition-shadow hover:shadow-sm">
      <CardContent className="p-3">
        {/* Priority badge */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", priorityInfo.variant)}>
            {priorityInfo.label}
          </span>
        </div>

        {/* Title */}
        <div className="text-[12px] font-medium leading-snug">{task.title}</div>

        {/* Description preview */}
        <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{task.desc}</div>

        {/* Footer */}
        <div className="mt-2.5 flex items-center justify-between">
          <Avatar className={cn("size-5", ASSIGNEE_COLORS[colorIdx])} size="sm">
            <AvatarFallback className={cn("text-[10px]", ASSIGNEE_COLORS[colorIdx])}>
              {task.assignee.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarIcon className="size-3" />
            {task.dueDate.slice(5)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
