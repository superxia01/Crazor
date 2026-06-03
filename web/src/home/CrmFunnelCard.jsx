// Copyright (c) 2026 MeeJoy

import { UsersIcon, PhoneIcon, MailIcon } from "lucide-react"

import { PanelShell, SoftIcon } from "./shared"
import { buildCrmFunnelData } from "./home-utils"

export default function CrmFunnelCard({ contacts, reminders = [] }) {
  const data = buildCrmFunnelData(contacts, reminders)

  return (
    <PanelShell className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <SoftIcon icon={UsersIcon} tone="blue" className="size-8" />
          <div>
            <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">
              CRM 漏斗
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              客户阶段分布
            </div>
          </div>
        </div>
        {data && (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            共 {data.total} 位
          </span>
        )}
      </div>

      {!data ? (
        <div className="flex-1 flex items-center justify-center py-4">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">暂无数据</span>
        </div>
      ) : (
        <div className="flex-1 space-y-1.5">
          {data.stages.map((stage) => (
            <div key={stage.name} className="flex items-center gap-2">
              <span className="w-14 shrink-0 truncate text-[10px] text-slate-500 dark:text-slate-400 text-right">
                {stage.name}
              </span>
              <div className="flex-1 h-4 rounded bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${Math.max(stage.percent, 2)}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
              <span className="w-6 shrink-0 text-[10px] tabular-nums text-slate-600 dark:text-slate-300 text-right">
                {stage.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {data?.topReminders?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            待跟进: {data.followUpsDue} 条
          </div>
          {data.topReminders.map((r) => (
            <div key={r.id} className="flex items-center gap-1.5 py-0.5">
              {r.method === "phone" ? (
                <PhoneIcon className="size-3 text-slate-400" />
              ) : (
                <MailIcon className="size-3 text-slate-400" />
              )}
              <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                {r.contact_name}
              </span>
              <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                {r.date?.slice(5) || ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  )
}
