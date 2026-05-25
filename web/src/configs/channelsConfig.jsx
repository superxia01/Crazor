// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useState } from "react"
import {
  DollarSignIcon,
  GlobeIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BadgeCell, CurrencyCell } from "@/components/data-view/DataGrid"
import { cn } from "@/lib/utils"

const COMPANY_TYPES = ["个人", "公司", "MCN", "培训机构", "代运营", "其他"]
const COOP_MODES = ["返佣", "分成", "互推", "一次性推荐", "代理", "课程分销", "其他"]
const SETTLEMENTS = ["单次结算", "月结", "季结"]
const RATINGS = ["核心", "一般", "潜力"]
const STATUSES = ["活跃", "休眠", "已终止"]

const RATING_COLORS = {
  "核心": "bg-amber-100 text-amber-700 border-amber-200",
  "一般": "bg-blue-100 text-blue-700 border-blue-200",
  "潜力": "bg-emerald-100 text-emerald-700 border-emerald-200",
}
const STATUS_COLORS = {
  "活跃": "bg-emerald-100 text-emerald-700",
  "休眠": "bg-zinc-100 text-zinc-600",
  "已终止": "bg-red-100 text-red-700",
}

function fmt(n) {
  if (!n) return "¥0"
  if (Math.abs(n) >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toLocaleString()}`
}

export default {
  apiBase: "/api/crazor/channels",
  icon: GlobeIcon,
  badge: "CRM",
  title: "渠道管理",
  description: "管理合作渠道与公域渠道，追踪引流效果",
  searchPlaceholder: "搜索渠道...",
  createLabel: "新增",
  createDialogTitle: "新增渠道",
  createDialogDesc: "填写渠道合作信息",
  createToast: "渠道已创建",
  filterParam: "status",
  editable: true,
  deletable: true,

  filters: [
    { id: "all", label: "全部" },
    { id: "活跃", label: "活跃" },
    { id: "休眠", label: "休眠" },
    { id: "已终止", label: "已终止" },
  ],

  stats: (items) => ({
    total: items.length,
    active: items.filter((c) => c.status === "活跃").length,
    totalRevenue: items.reduce((s, c) => s + (c.total_revenue || 0), 0),
    totalCustomers: items.reduce((s, c) => s + (c.total_customers || 0), 0),
  }),

  statsGridCols: "grid-cols-2 lg:grid-cols-4",

  statsCards: (stats) => [
    { icon: GlobeIcon, label: "总渠道", value: stats.total },
    { icon: TrendingUpIcon, label: "活跃渠道", value: stats.active, color: "text-emerald-600" },
    { icon: DollarSignIcon, label: "渠道总收入", value: fmt(stats.totalRevenue), color: "text-violet-600" },
    { icon: UsersIcon, label: "引入客户", value: stats.totalCustomers, color: "text-blue-600" },
  ],

  columns: [
    {
      accessorKey: "name",
      header: "名称",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      accessorKey: "company_type",
      header: "类型",
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? <Badge variant="outline" className="text-[10px] h-4">{v}</Badge> : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: "cooperation_mode",
      header: "合作模式",
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? <Badge variant="outline" className="text-[10px] h-4">{v}</Badge> : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: "rating",
      header: "评级",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={RATING_COLORS} />,
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={STATUS_COLORS} />,
    },
    {
      accessorKey: "total_customers",
      header: "客户",
    },
    {
      accessorKey: "total_revenue",
      header: "收入",
      cell: ({ getValue }) => <CurrencyCell value={getValue()} />,
    },
    {
      accessorKey: "contact_person",
      header: "联系人",
    },
  ],

  kanban: {
    laneKey: "status",
    lanes: [
      { id: "活跃", label: "活跃", color: "bg-emerald-400" },
      { id: "休眠", label: "休眠", color: "bg-zinc-400" },
      { id: "已终止", label: "已终止", color: "bg-red-400" },
    ],
    renderCard: (item) => (
      <div className="rounded-lg border bg-card p-2.5 shadow-none">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium">{item.name}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_COLORS[item.status] || "bg-zinc-100 text-zinc-600")}>
            {item.status}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.company_type && <Badge variant="outline" className="text-[10px] h-4">{item.company_type}</Badge>}
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", RATING_COLORS[item.rating] || "")}>{item.rating}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">{item.total_customers} 客户</span>
          {item.total_revenue > 0 && <span className="font-medium text-primary">{fmt(item.total_revenue)}</span>}
        </div>
      </div>
    ),
  },

  formFields: [
    { key: "name", label: "合作方名称", required: true, placeholder: "合作方名称 *" },
    { key: "contact_person", label: "联系人", placeholder: "联系人" },
    { key: "wechat", label: "微信号", placeholder: "微信号" },
    { key: "phone", label: "电话", placeholder: "电话" },
    { key: "company_type", label: "公司类型", type: "select", options: COMPANY_TYPES },
    { key: "company_name", label: "公司名", placeholder: "公司/机构名" },
    { key: "cooperation_mode", label: "合作模式", type: "select", options: COOP_MODES },
    { key: "commission_rate", label: "佣金比例", placeholder: "佣金/分成比例" },
    { key: "settlement_method", label: "结算方式", type: "select", options: SETTLEMENTS },
    { key: "main_products", label: "主要产品", placeholder: "主要引入产品" },
    { key: "status", label: "状态", type: "select", options: STATUSES, defaultValue: "活跃" },
    { key: "rating", label: "评级", type: "select", options: RATINGS, defaultValue: "潜力" },
  ],

  beforeCreate: (data) => ({
    ...data,
    followers: data.followers ? Number(data.followers) : 0,
  }),

  detail: {
    detailTitleKey: "name",
    detailIcon: GlobeIcon,
    detailIconBg: "bg-violet-500/10 text-violet-600",
    detailSubtitle: (item) => `${item.company_type || "渠道"}${item.company_name ? ` · ${item.company_name}` : ""}`,
    detailBadges: (item) => {
      const badges = []
      badges.push({ label: item.status, cls: STATUS_COLORS[item.status] || "bg-zinc-100 text-zinc-600" })
      badges.push({ label: item.rating, cls: `rounded-full border ${RATING_COLORS[item.rating] || ""}` })
      if (item.cooperation_mode) {
        badges.push({ label: item.cooperation_mode, cls: "border rounded-full px-2 py-0.5 text-[10px] font-medium" })
      }
      if (item.is_public) {
        badges.push({ label: "公域", cls: "border rounded-full px-2 py-0.5 text-[10px] font-medium" })
      }
      return badges
    },
    detailFields: [
      { key: "contact_person", label: "联系人" },
      { key: "wechat", label: "微信" },
      { key: "phone", label: "电话" },
      { key: "commission_rate", label: "佣金比例" },
      { key: "settlement_method", label: "结算" },
      { key: "main_products", label: "产品" },
      { key: "total_customers", label: "引入客户" },
      { key: "total_revenue", label: "累计成交", render: (v) => fmt(v) },
    ],
  },

  detailExtra: function ChannelReferrals({ item }) {
    const [referrals, setReferrals] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
      try {
        const r = await fetch(`/api/crazor/channels/${item.id}/referrals`)
        if (r.ok) setReferrals(await r.json())
      } catch { /* ignore */ }
      setLoading(false)
    }, [item.id])

    useEffect(() => { load() }, [load])

    if (loading) return <div className="text-[11px] text-muted-foreground border-t pt-3">加载中...</div>
    if (referrals.length === 0) return null

    return (
      <div className="border-t pt-3">
        <div className="text-[11px] font-medium text-muted-foreground mb-2">引入的客户 ({referrals.length})</div>
        <div className="flex flex-col gap-1.5">
          {referrals.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[12px]">
              <div>
                <span className="font-medium">{r.contact_name || r.contact_id?.slice(0, 8)}</span>
                {r.product_type && <Badge variant="outline" className="text-[10px] h-4 ml-1.5">{r.product_type}</Badge>}
              </div>
              {r.deal_amount > 0 && <span className="text-primary font-medium">{fmt(r.deal_amount)}</span>}
            </div>
          ))}
        </div>
      </div>
    )
  },
}
