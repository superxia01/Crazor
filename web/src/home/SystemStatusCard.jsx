// Copyright (c) 2026 MeeJoy

import { ShieldCheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { PanelShell, SoftIcon, TONE_STYLES, getToneForStatus } from "./shared"

export default function SystemStatusCard({ rows = [] }) {
  return (
    <PanelShell className="p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <SoftIcon icon={ShieldCheckIcon} tone="sky" className="size-7 rounded-[7px]" />
        <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">
          系统状态
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map((row) => {
          const Icon = row.icon
          const tone = getToneForStatus(row.tone)
          return (
            <div
              key={row.id}
              className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="size-3 text-slate-400 dark:text-slate-500" />
                <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {row.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", TONE_STYLES[tone]?.dot || TONE_STYLES.slate.dot)} />
                <span className="truncate text-[11px] font-medium text-slate-950 dark:text-slate-50">
                  {row.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </PanelShell>
  )
}
