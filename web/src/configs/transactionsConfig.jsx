// Copyright (c) 2026 MeeJoy

import { createElement as h, useState } from "react"
import {
  DollarSignIcon,
  FileTextIcon,
  GlobeIcon,
  LandmarkIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataForm } from "@/components/data-view"
import { BadgeCell, CurrencyCell } from "@/components/data-view/DataGrid"
import { cn } from "@/lib/utils"

const PRODUCT_TYPES = ["建站", "技术服务", "培训", "AI技术", "APP&小程序", "课程", "企业培训"]
const PROGRESS_OPTIONS = ["进行中", "完成", "已完成", "已关闭", "开发中"]
const PAYMENT_STATUSES = ["已回款", "部分回款", "未回款", "已付款", "已退款"]
const PAYMENT_CHANNELS = ["微信", "对公户", "其他"]

const PAYMENT_STATUS_COLORS = {
  "已回款": "bg-emerald-100 text-emerald-700",
  "部分回款": "bg-amber-100 text-amber-700",
  "未回款": "bg-red-100 text-red-700",
  "已付款": "bg-emerald-100 text-emerald-700",
  "已退款": "bg-zinc-100 text-zinc-600",
}

function fmt(n) {
  if (!n) return "¥0"
  if (Math.abs(n) >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toLocaleString()}`
}

const FORM_FIELDS = [
  { key: "amount", label: "金额", type: "number", required: true, placeholder: "金额 *" },
  { key: "quote", label: "报价", type: "number", placeholder: "报价" },
  { key: "description", label: "描述", placeholder: "描述" },
  { key: "date", label: "日期", type: "date", defaultValue: new Date().toISOString().slice(0, 10) },
  { key: "product_type", label: "产品/项目", type: "select", options: PRODUCT_TYPES },
  { key: "progress", label: "进度", type: "select", options: PROGRESS_OPTIONS },
  { key: "payment_status", label: "回款状态", type: "select", options: PAYMENT_STATUSES },
  { key: "payment_channel", label: "收款渠道", type: "select", options: PAYMENT_CHANNELS },
]

export default {
  apiBase: "/api/crazor/transactions",
  icon: LandmarkIcon,
  badge: "Finance",
  title: "财务中心",
  description: "收支流水、业绩追踪与财务趋势",
  searchPlaceholder: "搜索交易...",
  createLabel: "新增交易",
  createDialogTitle: "新增交易",
  createDialogDesc: "录入收入或支出",
  createToast: "交易已创建",
  searchable: false,
  editable: false,
  deletable: false,

  // Load overview stats for KPI cards
  loadExtra: async () => {
    const resp = await fetch("/api/crazor/analytics/overview")
    const overview = resp.ok ? await resp.json() : {}
    return { financeStats: overview.finance || {} }
  },

  filters: [
    { id: "all", label: "全部" },
    { id: "income", label: "收入" },
    { id: "expense", label: "支出" },
  ],

  stats: (items, extraData) => {
    const fs = extraData?.financeStats || {}
    return {
      totalIncome: fs.totalIncome || 0,
      totalExpense: fs.totalExpense || 0,
      net: fs.net || 0,
      pendingInvoice: fs.pendingInvoice || 0,
      channelRevenue: fs.channelRevenue || 0,
    }
  },

  statsGridCols: "grid-cols-2 lg:grid-cols-5",

  statsCards: (stats) => [
    { icon: TrendingUpIcon, label: "总收入", value: fmt(stats.totalIncome), color: "text-emerald-600" },
    { icon: TrendingDownIcon, label: "总支出", value: fmt(stats.totalExpense), color: "text-rose-600" },
    { icon: DollarSignIcon, label: "净利润", value: fmt(stats.net), color: "text-blue-600" },
    { icon: FileTextIcon, label: "待收发票", value: fmt(stats.pendingInvoice), color: "text-amber-600" },
    { icon: GlobeIcon, label: "渠道收入", value: fmt(stats.channelRevenue), color: "text-violet-600" },
  ],

  columns: [
    {
      accessorKey: "date",
      header: "日期",
      cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span>,
    },
    {
      accessorKey: "description",
      header: "描述",
      cell: ({ getValue, row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{getValue() || (row.original.type === "income" ? "收入" : "支出")}</span>
          {row.original.product_type && <Badge variant="outline" className="text-[10px] h-4">{row.original.product_type}</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "类型",
      cell: ({ getValue }) => {
        const v = getValue()
        return v === "income"
          ? <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700">收入</span>
          : <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-rose-100 text-rose-700">支出</span>
      },
    },
    {
      accessorKey: "amount",
      header: "金额",
      cell: ({ getValue, row }) => {
        const v = getValue()
        const isIncome = row.original.type === "income"
        return (
          <span className={cn("font-semibold", isIncome ? "text-emerald-600" : "text-rose-600")}>
            {isIncome ? "+" : "-"}{fmt(v)}
          </span>
        )
      },
    },
    {
      accessorKey: "product_type",
      header: "产品",
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? <Badge variant="outline" className="text-[10px] h-4">{v}</Badge> : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: "payment_status",
      header: "回款",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={PAYMENT_STATUS_COLORS} />,
    },
    {
      accessorKey: "progress",
      header: "进度",
    },
  ],

  kanban: {
    laneKey: "payment_status",
    lanes: [
      { id: "未回款", label: "未回款", color: "bg-red-400" },
      { id: "部分回款", label: "部分回款", color: "bg-amber-400" },
      { id: "已回款", label: "已回款", color: "bg-emerald-400" },
    ],
    renderCard: (item) => (
      <div className="rounded-lg border bg-card p-2.5 shadow-none">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium">{item.description || "交易"}</span>
          <span className={cn("text-[12px] font-semibold", item.type === "income" ? "text-emerald-600" : "text-rose-600")}>
            {item.type === "income" ? "+" : "-"}{fmt(item.amount)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{item.date}</span>
          {item.product_type && <Badge variant="outline" className="text-[10px] h-4">{item.product_type}</Badge>}
        </div>
      </div>
    ),
  },

  formFields: FORM_FIELDS,

  // Custom create form with income/expense toggle
  createFormExtra: ({ onSubmit, onCancel }) => h(FinanceCreateForm, { onSubmit, onCancel }),

  beforeCreate: (data) => ({
    ...data,
    amount: Number(data.amount),
    quote: data.quote ? Number(data.quote) : undefined,
  }),

  detail: {
    detailTitleKey: "description",
    detailIcon: LandmarkIcon,
    detailIconBg: "bg-emerald-500/10 text-emerald-600",
    detailSubtitle: (item) => item.date,
    detailFields: [
      {
        key: "amount",
        label: "金额",
        render: (v, item) => (
          <span className={cn("font-semibold", item.type === "income" ? "text-emerald-600" : "text-rose-600")}>
            {item.type === "income" ? "+" : "-"}{fmt(v)}
          </span>
        ),
      },
      { key: "quote", label: "报价", render: (v) => v ? fmt(v) : "-" },
      { key: "product_type", label: "产品/项目" },
      { key: "progress", label: "进度" },
      { key: "payment_status", label: "回款状态" },
      { key: "payment_channel", label: "收款渠道" },
      { key: "category", label: "分类" },
    ],
  },
}

function FinanceCreateForm({ onSubmit, onCancel }) {
  const [type, setType] = useState("income")
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button size="sm" variant={type === "income" ? "default" : "outline"} onClick={() => setType("income")}>收入</Button>
        <Button size="sm" variant={type === "expense" ? "default" : "outline"} onClick={() => setType("expense")}>支出</Button>
      </div>
      <DataForm
        fields={FORM_FIELDS}
        onSubmit={(data) => onSubmit({ ...data, type })}
        onCancel={onCancel}
        submitLabel="保存"
      />
    </div>
  )
}
