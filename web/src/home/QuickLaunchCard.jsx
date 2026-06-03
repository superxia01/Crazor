// Copyright (c) 2026 MeeJoy

import { ChevronRightIcon, ZapIcon } from "lucide-react"

import { PanelShell, SoftIcon } from "./shared"

export default function QuickLaunchCard({ actions = [] }) {
  return (
    <PanelShell className="p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <SoftIcon icon={ZapIcon} tone="sky" className="size-7 rounded-[7px]" />
        <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">
          快速入口
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon
          const tone = action.tone || "slate"
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className="group flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-left transition-all hover:border-sky-200 hover:shadow-sm dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:border-sky-400/30"
            >
              <SoftIcon icon={Icon} tone={tone} className="size-6 rounded-md shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-950 dark:text-slate-50">
                {action.title}
              </span>
            </button>
          )
        })}
      </div>
    </PanelShell>
  )
}
