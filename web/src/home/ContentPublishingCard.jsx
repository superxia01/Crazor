// Copyright (c) 2026 MeeJoy

import { FileTextIcon, TrendingUpIcon } from "lucide-react"

import { PanelShell, SoftIcon } from "./shared"
import { buildContentStats } from "./home-utils"

const PLATFORM_COLORS = {
  "公众号": "#34d399",
  "小红书": "#fb7185",
  "抖音": "#6b7280",
  "视频号": "#fbbf24",
  "YouTube": "#f87171",
  "Twitter": "#60a5fa",
  "Instagram": "#c084fc",
  "TikTok": "#22d3ee",
}

export default function ContentPublishingCard({ contentPieces = [] }) {
  const stats = buildContentStats(contentPieces)

  return (
    <PanelShell className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <SoftIcon icon={FileTextIcon} tone="emerald" className="size-8" />
          <div>
            <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">
              内容发布
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              各平台内容统计
            </div>
          </div>
        </div>
        {stats && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
            <TrendingUpIcon className="size-3" />
            本周 {stats.thisWeek} 篇
          </span>
        )}
      </div>

      {!stats ? (
        <div className="flex-1 flex items-center justify-center py-4">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">暂无内容</span>
        </div>
      ) : (
        <>
          {/* Platform bars */}
          <div className="flex-1 space-y-1.5">
            {Object.entries(stats.byPlatform)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([platform, count]) => {
                const maxCount = Math.max(...Object.values(stats.byPlatform), 1)
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={platform} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 truncate text-[10px] text-slate-500 dark:text-slate-400 text-right">
                      {platform}
                    </span>
                    <div className="flex-1 h-4 rounded bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, 3)}%`,
                          backgroundColor: PLATFORM_COLORS[platform] || "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-[10px] tabular-nums text-slate-600 dark:text-slate-300 text-right">
                      {count}
                    </span>
                  </div>
                )
              })}
          </div>

          {/* Status badges */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300"
                >
                  {status}
                  <span className="font-medium">{count}</span>
                </span>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
              总浏览 {stats.totalViews.toLocaleString()}
            </div>
          </div>
        </>
      )}
    </PanelShell>
  )
}
