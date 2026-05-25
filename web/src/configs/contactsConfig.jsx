// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useState } from "react"
import {
  Building2Icon,
  DollarSignIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneIcon,
  TagIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  CalendarIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BadgeCell, CurrencyCell } from "@/components/data-view/DataGrid"
import { cn } from "@/lib/utils"

const FOLLOW_METHODS = ["微信", "面谈", "电话", "群聊"]
const FOLLOW_STATUSES = ["待跟进", "已跟进", "已完成"]

const STAGE_COLORS = {
  "新线索": "bg-slate-100 text-slate-700",
  "跟进中": "bg-blue-100 text-blue-700",
  "意向确认": "bg-violet-100 text-violet-700",
  "报价中": "bg-amber-100 text-amber-700",
  "谈判中": "bg-orange-100 text-orange-700",
  "已成交": "bg-emerald-100 text-emerald-700",
  "已流失": "bg-zinc-100 text-zinc-500",
}
const STATUS_COLORS = {
  "active": "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
  "potential": "bg-blue-500/15 text-blue-700 border-blue-500/20",
  "silent": "bg-zinc-500/15 text-zinc-500 border-zinc-500/20",
}
const STATUS_LABELS = { active: "活跃", potential: "潜在", silent: "沉默" }

export default {
  apiBase: "/api/crazor/contacts",
  icon: UsersIcon,
  badge: "CRM",
  title: "客户管理",
  description: "管理客户关系、商机管线与跟进记录",
  searchPlaceholder: "搜索客户...",
  createLabel: "新增",
  createDialogTitle: "新增客户",
  createDialogDesc: "填写客户完整信息",
  createToast: "客户已创建",
  filterParam: "status",
  editable: true,
  deletable: false,

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

  columns: [
    {
      accessorKey: "name",
      header: "姓名",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      accessorKey: "company",
      header: "公司",
      cell: ({ getValue, row }) => (
        <div className="flex items-center gap-1.5">
          <Building2Icon className="size-3 text-muted-foreground" />
          <span>{getValue() || "-"}</span>
          {row.original.role && <span className="text-muted-foreground">· {row.original.role}</span>}
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "电话",
    },
    {
      accessorKey: "project_type",
      header: "项目",
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? <Badge variant="outline" className="text-[10px] h-4">{v}</Badge> : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: "stage",
      header: "阶段",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={STAGE_COLORS} />,
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ getValue }) => {
        const v = getValue()
        const cls = STATUS_COLORS[v] || ""
        return <BadgeCell value={STATUS_LABELS[v] || v} colorMap={{}} />
      },
    },
    {
      accessorKey: "deal",
      header: "商机",
      cell: ({ getValue }) => <CurrencyCell value={getValue()} />,
    },
    {
      accessorKey: "sales_person",
      header: "Sales",
    },
    {
      accessorKey: "source",
      header: "来源",
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? <Badge variant="outline" className="text-[10px] h-4">{v}</Badge> : <span className="text-muted-foreground">-</span>
      },
    },
  ],

  kanban: {
    laneKey: "stage",
    lanes: [
      { id: "新线索", label: "新线索", color: "bg-slate-400" },
      { id: "跟进中", label: "跟进中", color: "bg-blue-400" },
      { id: "意向确认", label: "意向确认", color: "bg-violet-400" },
      { id: "报价中", label: "报价中", color: "bg-amber-400" },
      { id: "谈判中", label: "谈判中", color: "bg-orange-400" },
      { id: "已成交", label: "已成交", color: "bg-emerald-400" },
      { id: "已流失", label: "已流失", color: "bg-zinc-400" },
    ],
    renderCard: (item) => {
      const statusInfo = STATUS_LABELS[item.status] || item.status
      return (
        <div className="rounded-lg border bg-card p-2.5 shadow-none hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium">{item.name}</span>
            <span className="text-[10px] text-muted-foreground">{statusInfo}</span>
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
  },

  formFields: [
    { key: "name", label: "姓名", required: true, placeholder: "姓名 *" },
    { key: "company", label: "公司", placeholder: "公司" },
    { key: "role", label: "职位", placeholder: "职位" },
    { key: "phone", label: "电话", placeholder: "电话" },
    { key: "wechat", label: "微信号", placeholder: "微信号" },
    { key: "email", label: "邮箱", placeholder: "邮箱", type: "text" },
    { key: "source", label: "来源渠道", type: "asyncSelect", placeholder: "选择来源渠道", asyncOptions: async () => {
      try {
        const r = await fetch("/api/crazor/channels")
        if (!r.ok) return []
        const channels = await r.json()
        return channels.map((c) => c.name)
      } catch { return [] }
    }},
    { key: "project_type", label: "所属项目", placeholder: "所属项目" },
    { key: "identity", label: "身份", placeholder: "身份" },
    { key: "budget_range", label: "预算范围", placeholder: "预算范围" },
    { key: "sales_person", label: "内部Sales", placeholder: "内部Sales" },
    { key: "situation", label: "情况说明", type: "textarea", placeholder: "情况说明", fullWidth: true },
  ],

  beforeCreate: (data) => ({
    ...data,
    status: data.status || "potential",
    stage: data.stage || "新线索",
  }),

  detail: {
    detailMaxWidth: "max-w-2xl",
    detailTitleKey: "name",
    detailIcon: UsersIcon,
    detailIconBg: "bg-blue-500/15 text-blue-600",
    detailSubtitle: (item) => `${item.company || "未填写公司"}${item.role ? ` · ${item.role}` : ""}`,
    detailBadges: (item) => {
      const badges = []
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
    detailFields: [
      { key: "phone", label: "电话", icon: PhoneIcon },
      { key: "wechat", label: "微信", icon: MessageSquareIcon },
      { key: "email", label: "邮箱", icon: MailIcon },
      { key: "source", label: "来源渠道", icon: TagIcon },
      { key: "sales_person", label: "内部Sales", icon: UserIcon },
      { key: "project_type", label: "所属项目", icon: TagIcon },
      { key: "identity", label: "身份", icon: UserIcon },
      { key: "budget_range", label: "预算范围", icon: DollarSignIcon },
      { key: "deal", label: "商机", icon: DollarSignIcon, render: (v) => v ? `¥${v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString()}` : "-" },
    ],
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
}
