// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useState } from "react"
import {
  UsersIcon,
  TrendingUpIcon,
  CalendarIcon,
  PhoneIcon,
  MessageSquareIcon,
  MailIcon,
  TagIcon,
  UserIcon,
  DollarSignIcon,
  GlobeIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SchemaDataView } from "@/components/data-view"

const STAGE_COLORS = {
  "新线索": "bg-slate-100 text-slate-700",
  "跟进中": "bg-blue-100 text-blue-700",
  "意向确认": "bg-violet-100 text-violet-700",
  "报价中": "bg-amber-100 text-amber-700",
  "谈判中": "bg-orange-100 text-orange-700",
  "已成交": "bg-emerald-100 text-emerald-700",
  "已流失": "bg-zinc-100 text-zinc-500",
}

export default function ContactsView() {
  return (
    <SchemaDataView
      entity="contacts"
      apiBase="/api/crazor/contacts"
      overrides={{
        icon: UsersIcon,
        badge: "CRM",
        title: "客户管理",
        description: "管理客户关系、商机管线与跟进记录",
        searchPlaceholder: "搜索客户...",
        filterParam: "status",
        filters: [
          { id: "all", label: "全部" },
          { id: "active", label: "活跃" },
          { id: "potential", label: "潜在" },
          { id: "silent", label: "沉默" },
        ],
        stats: (items) => ({
          total: items.length,
          active: items.filter((c) => c.status === "active").length,
          potential: items.filter((c) => c.status === "potential").length,
        }),
        statsGridCols: "grid-cols-2 lg:grid-cols-3",
        statsCards: (stats) => [
          { icon: UsersIcon, label: "总客户", value: stats.total },
          { icon: TrendingUpIcon, label: "活跃客户", value: stats.active, color: "text-emerald-600" },
          { icon: CalendarIcon, label: "潜在客户", value: stats.potential, color: "text-blue-600" },
        ],
        kanbanCard: (item) => {
          const statusLabels = { active: "活跃", potential: "潜在", silent: "沉默" }
          return (
            <div className="rounded-lg border bg-card p-2.5 shadow-none hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium">{item.name}</span>
                <span className="text-[10px] text-muted-foreground">{statusLabels[item.status] || item.status}</span>
              </div>
              {item.company && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{item.company}</div>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {item.project_type && <Badge variant="outline" className="text-[10px] h-4">{item.project_type}</Badge>}
                {item.deal > 0 && <span className="text-[11px] font-medium text-primary">¥{(item.deal / 10000).toFixed(1)}万</span>}
              </div>
            </div>
          )
        },
        detailOverrides: {
          detailMaxWidth: "max-w-2xl",
          detailIcon: UsersIcon,
          detailIconBg: "bg-blue-500/15 text-blue-600",
          detailSubtitle: (item) => `${item.company || "未填写公司"}${item.role ? ` · ${item.role}` : ""}`,
          detailBadges: (item) => {
            const badges = []
            const STATUS_COLORS = {
              active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
              potential: "bg-blue-500/15 text-blue-700 border-blue-500/20",
              silent: "bg-zinc-500/15 text-zinc-500 border-zinc-500/20",
            }
            const STATUS_LABELS = { active: "活跃", potential: "潜在", silent: "沉默" }
            if (item.status) {
              badges.push({ label: STATUS_LABELS[item.status] || item.status, cls: STATUS_COLORS[item.status] || "" })
            }
            if (item.stage) {
              badges.push({ label: item.stage, cls: STAGE_COLORS[item.stage] || "bg-zinc-100 text-zinc-600" })
            }
            if (item.source) {
              badges.push({ label: `来源: ${item.source}`, cls: "border rounded-full px-2 py-0.5 text-[10px] font-medium border-border" })
            }
            return badges
          },
        },
        detailExtra: function ContactChannels({ item }) {
          const [channels, setChannels] = useState([])
          const [loading, setLoading] = useState(true)

          const load = useCallback(async () => {
            try {
              const r = await fetch(`/api/crazor/contacts/${item.id}/channels`)
              if (r.ok) setChannels(await r.json())
            } catch { /* ignore */ }
            setLoading(false)
          }, [item.id])

          useEffect(() => { load() }, [load])

          if (loading) return <div className="text-[11px] text-muted-foreground border-t pt-3">加载中...</div>
          if (channels.length === 0) return null

          return (
            <div className="border-t pt-3">
              <div className="text-[11px] font-medium text-muted-foreground mb-2">关联渠道 ({channels.length})</div>
              <div className="flex flex-col gap-1.5">
                {channels.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <GlobeIcon className="size-3 text-muted-foreground" />
                      <span className="font-medium">{ch.channel_name || ch.channel_id?.slice(0, 8)}</span>
                      {ch.channel_rating && <Badge variant="outline" className="text-[10px] h-4">{ch.channel_rating}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {ch.product_type && <Badge variant="outline" className="text-[10px] h-4">{ch.product_type}</Badge>}
                      {ch.deal_amount > 0 && <span className="text-primary font-medium">¥{ch.deal_amount >= 10000 ? (ch.deal_amount / 10000).toFixed(1) + "万" : ch.deal_amount.toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        },
      }}
    />
  )
}
