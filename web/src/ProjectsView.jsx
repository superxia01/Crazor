// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarIcon, KanbanSquareIcon, PlusIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

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

const ASSIGNEE_COLORS = ["bg-blue-500/15 text-blue-600", "bg-violet-500/15 text-violet-600", "bg-emerald-500/15 text-emerald-600", "bg-amber-500/15 text-amber-600"]

export default function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", assignee: "", due_date: "", status: "todo" })

  const loadData = useCallback(async () => {
    const [pResp, tResp] = await Promise.all([fetch("/api/crazor/projects"), fetch("/api/crazor/tasks")])
    if (pResp.ok) {
      const ps = await pResp.json()
      setProjects(ps)
      if (!activeProject && ps.length > 0) setActiveProject(ps[0].id)
    }
    if (tResp.ok) setTasks(await tResp.json())
  }, [activeProject])

  useEffect(() => { void loadData() }, [loadData])

  const columns = useMemo(
    () => COLUMNS.map((col) => ({ ...col, tasks: tasks.filter((t) => t.project_id === activeProject && t.status === col.id) })),
    [tasks, activeProject],
  )

  const handleCreateTask = useCallback(async () => {
    if (!taskForm.title.trim() || !activeProject) return
    await fetch("/api/crazor/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...taskForm, project_id: activeProject }),
    })
    setShowCreateTask(false)
    setTaskForm({ title: "", description: "", priority: "medium", assignee: "", due_date: "", status: "todo" })
    await loadData()
  }, [taskForm, activeProject, loadData])

  const handleMoveTask = useCallback(async (taskId, newStatus) => {
    await fetch(`/api/crazor/tasks/${taskId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    await loadData()
  }, [loadData])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/92 px-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="rounded-full border-border/92 bg-sidebar/48 px-2 py-0.5 text-[10px] text-muted-foreground">
            <KanbanSquareIcon className="size-3.5" />Project
          </Badge>
          <h1 className="text-[1rem] font-semibold tracking-tight">项目看板</h1>
        </div>
        <div className="flex items-center gap-2">
          {projects.map((p) => (
            <Button key={p.id} variant={activeProject === p.id ? "secondary" : "ghost"} size="sm"
              onClick={() => setActiveProject(p.id)}
              className={cn("h-7 rounded-full px-3 text-[12px]", activeProject === p.id && "bg-primary/10 text-primary")}>
              {p.name}
            </Button>
          ))}
          <Button size="sm" onClick={() => setShowCreateTask(true)} className="h-7 px-2.5 text-[12px]">
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>
      <Separator />

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {columns.map((col) => (
          <div key={col.id} className="flex flex-1 flex-col min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", col.dot)} />
                <span className="text-[13px] font-medium">{col.label}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{col.tasks.length}</Badge>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-2.5 pb-4">
                {col.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onMove={handleMoveTask} />
                ))}
                {col.tasks.length === 0 && (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 py-8 text-[12px] text-muted-foreground">暂无任务</div>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>新建任务</DialogTitle><DialogDescription>添加到当前项目</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="任务标题 *" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="描述" value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="flex gap-2">
              {["high", "medium", "low"].map((p) => (
                <Button key={p} size="sm" variant={taskForm.priority === p ? "default" : "outline"} onClick={() => setTaskForm((f) => ({ ...f, priority: p }))}>
                  {PRIORITY_MAP[p].label}
                </Button>
              ))}
            </div>
            <Input placeholder="指派人" value={taskForm.assignee} onChange={(e) => setTaskForm((f) => ({ ...f, assignee: e.target.value }))} />
            <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))} />
            <Button onClick={handleCreateTask} disabled={!taskForm.title.trim()}>创建</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskCard({ task, onMove }) {
  const priorityInfo = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium
  const colorIdx = (task.assignee || "x").charCodeAt(0) % ASSIGNEE_COLORS.length

  return (
    <Card className="shadow-none transition-shadow hover:shadow-sm">
      <CardContent className="p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", priorityInfo.variant)}>{priorityInfo.label}</span>
        </div>
        <div className="text-[12px] font-medium leading-snug">{task.title}</div>
        {task.description && <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{task.description}</div>}
        <div className="mt-2.5 flex items-center justify-between">
          {task.assignee ? (
            <Avatar className={cn("size-5", ASSIGNEE_COLORS[colorIdx])} size="sm">
              <AvatarFallback className={cn("text-[10px]", ASSIGNEE_COLORS[colorIdx])}>{task.assignee.slice(0, 1)}</AvatarFallback>
            </Avatar>
          ) : <div />}
          <div className="flex items-center gap-1.5">
            {task.status !== "todo" && (
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => onMove(task.id, task.status === "doing" ? "todo" : "doing")}>
                ← 左移
              </Button>
            )}
            {task.status !== "done" && (
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => onMove(task.id, task.status === "todo" ? "doing" : "done")}>
                右移 →
              </Button>
            )}
            {task.due_date && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarIcon className="size-3" />{task.due_date.slice(5)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
