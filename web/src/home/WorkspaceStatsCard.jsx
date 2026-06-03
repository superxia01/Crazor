// Copyright (c) 2026 MeeJoy

import { BookOpenIcon, CalendarClockIcon, HistoryIcon, MessageSquarePlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { PanelShell, SoftIcon, TONE_STYLES } from "./shared"

export default function WorkspaceStatsCard({ stats = {} }) {
  const items = [
    { icon: MessageSquarePlusIcon, label: "今日对话", value: stats.todaySessions ?? 0, tone: "emerald" },
    { icon: HistoryIcon, label: "对话总量", value: stats.totalSessions ?? 0, tone: "sky" },
    { icon: BookOpenIcon, label: "笔记数量", value: stats.noteCount ?? 0, tone: "blue" },
    { icon: CalendarClockIcon, label: "活跃任务", value: stats.activeCronJobs ?? 0, tone: stats.cronErrorCount > 0 ? "amber" : "emerald" },
  ]

  return (
    <PanelShell className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <SoftIcon icon={HistoryIcon} tone="sky" className="size-8" />
          <div>
            <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">
              工作台统计
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              对话 · 笔记 · 任务
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1">
        {items.map((item) => {
          const Icon = item.icon
          const dotColor = TONE_STYLES[item.tone]?.dot || TONE_STYLES.slate.dot
          return (
            <div
              key={item.label}
              className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
                <Icon className="size-3 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="flex items-end gap-1.5">
                <span className="tabular-nums text-[20px] font-semibold leading-none text-slate-950 dark:text-slate-50">
                  {item.value}
                </span>
                <span className={cn("mb-1 size-1.5 rounded-full", dotColor)} />
              </div>
            </div>
          )
        })}
      </div>
    </PanelShell>
  )
}
