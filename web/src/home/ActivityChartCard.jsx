// Copyright (c) 2026 MeeJoy

import { HistoryIcon } from "lucide-react"

import { MiniAreaChart, PanelShell, SoftIcon } from "./shared"

export default function ActivityChartCard({ data = [] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <PanelShell className="flex flex-col p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <SoftIcon icon={HistoryIcon} tone="sky" className="size-7 rounded-[7px]" />
          <div>
            <div className="text-[12px] font-semibold text-slate-950 dark:text-slate-50">
              工作活跃度
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              近 7 天
            </div>
          </div>
        </div>
        <span className="tabular-nums text-[12px] font-semibold text-sky-600 dark:text-sky-300">
          {total}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <MiniAreaChart data={data} tone="sky" />
      </div>
    </PanelShell>
  )
}
