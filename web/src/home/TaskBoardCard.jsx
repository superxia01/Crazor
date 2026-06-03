// Copyright (c) 2026 MeeJoy

import { CalendarClockIcon, CheckCircle2Icon, CircleIcon, ClockIcon, AlertTriangleIcon } from "lucide-react"

import { PanelShell, SoftIcon } from "./shared"
import { buildTaskStats } from "./home-utils"

const TASK_STATUS = [
  { key: "todo", label: "待办", color: "#60a5fa", icon: CircleIcon },
  { key: "doing", label: "进行中", color: "#f59e0b", icon: ClockIcon },
  { key: "done", label: "已完成", color: "#10b981", icon: CheckCircle2Icon },
]

export default function TaskBoardCard({ projects, cronJobs = [] }) {
  const stats = buildTaskStats(projects, cronJobs)

  return (
    <PanelShell className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <SoftIcon icon={CalendarClockIcon} tone="amber" className="size-8" />
          <div>
            <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">
              任务看板
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              项目任务进度
            </div>
          </div>
        </div>
        {stats.total > 0 && (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {stats.total} 个项目
          </span>
        )}
      </div>

      {/* Task progress bars */}
      <div className="space-y-2.5">
        {TASK_STATUS.map(({ key, label, color }) => {
          const count = stats[key]
          const total = stats.todo + stats.doing + stats.done || 1
          const pct = Math.round((count / total) * 100)
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-[10px] tabular-nums text-slate-600 dark:text-slate-300 font-medium">
                  {count}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Cron jobs */}
      {(stats.activeCron > 0 || stats.cronErrors > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <CalendarClockIcon className="size-3 text-slate-400" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                定时任务: {stats.activeCron} 个活跃
              </span>
            </div>
            {stats.cronErrors > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangleIcon className="size-3" />
                {stats.cronErrors} 个异常
              </span>
            )}
          </div>
        </div>
      )}
    </PanelShell>
  )
}
