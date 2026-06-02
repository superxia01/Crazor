// Copyright (c) 2026 MeeJoy

import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  PackageIcon,
} from "lucide-react"
import { BadgeCell } from "@/components/data-view/DataGrid"
import { cn } from "@/lib/utils"

const DELIVERY_TYPES = ["企业培训", "课程二开", "软件开发", "AI系统部署", "咨询服务", "资料交付"]
const DELIVERY_STAGES = ["准备中", "交付中", "验收中", "已完成", "已归档"]
const ACCEPTANCE_STATUSES = ["未验收", "待客户确认", "返工中", "已验收"]

const STAGE_COLORS = {
  "准备中": "bg-slate-100 text-slate-700",
  "交付中": "bg-blue-100 text-blue-700",
  "验收中": "bg-amber-100 text-amber-700",
  "已完成": "bg-emerald-100 text-emerald-700",
  "已归档": "bg-zinc-100 text-zinc-600",
}

const ACCEPTANCE_COLORS = {
  "未验收": "bg-slate-100 text-slate-700",
  "待客户确认": "bg-blue-100 text-blue-700",
  "返工中": "bg-rose-100 text-rose-700",
  "已验收": "bg-emerald-100 text-emerald-700",
}

const FORM_FIELDS = [
  { key: "title", label: "交付名称", required: true, placeholder: "交付名称 *", fullWidth: true },
  {
    key: "contact_id",
    label: "关联客户",
    type: "asyncSelect",
    placeholder: "选择客户",
    asyncOptions: async () => {
      try {
        const resp = await fetch("/api/crazor/contacts")
        if (!resp.ok) return []
        const contacts = await resp.json()
        return contacts.map((item) => ({ value: item.id, label: [item.name, item.company].filter(Boolean).join(" · ") }))
      } catch {
        return []
      }
    },
  },
  {
    key: "project_id",
    label: "关联项目",
    type: "asyncSelect",
    placeholder: "选择项目",
    asyncOptions: async () => {
      try {
        const resp = await fetch("/api/crazor/projects")
        if (!resp.ok) return []
        const projects = await resp.json()
        return projects.map((item) => ({ value: item.id, label: item.name }))
      } catch {
        return []
      }
    },
  },
  { key: "delivery_type", label: "交付类型", type: "select", options: DELIVERY_TYPES, defaultValue: "企业培训" },
  { key: "stage", label: "交付阶段", type: "select", options: DELIVERY_STAGES, defaultValue: "准备中" },
  { key: "acceptance_status", label: "验收状态", type: "select", options: ACCEPTANCE_STATUSES, defaultValue: "未验收" },
  { key: "owner", label: "内部负责人", placeholder: "内部负责人" },
  { key: "customer_owner", label: "客户负责人", placeholder: "客户负责人" },
  { key: "start_date", label: "开始日期", type: "date" },
  { key: "due_date", label: "计划验收", type: "date" },
  { key: "accepted_at", label: "验收时间", type: "date" },
  { key: "handover_doc_id", label: "交接文档 ID", placeholder: "知识库文档 ID" },
  { key: "deliverables", label: "交付物清单", type: "textarea", placeholder: "每行一个交付物", fullWidth: true },
  { key: "risks", label: "风险与阻塞", type: "textarea", placeholder: "每行一个风险或阻塞", fullWidth: true },
  { key: "remark", label: "备注", type: "textarea", placeholder: "交付背景、验收口径或客户反馈", fullWidth: true },
]

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean)
  return String(value || "")
    .split(/\r?\n|[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizePayload(data) {
  return {
    ...data,
    deliverables: normalizeList(data.deliverables),
    risks: normalizeList(data.risks),
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function isActive(item) {
  return item.stage !== "已归档" && item.acceptance_status !== "已验收"
}

function isOverdue(item) {
  return isActive(item) && item.due_date && item.due_date <= today()
}

function formatList(value) {
  const list = normalizeList(value)
  return list.length ? list.join("、") : "-"
}

export default {
  apiBase: "/api/crazor/deliveries",
  icon: PackageIcon,
  badge: "Delivery",
  title: "交付管理",
  description: "追踪客户交付阶段、验收状态、交付物和风险",
  searchPlaceholder: "搜索交付、客户、项目、负责人...",
  createLabel: "新增交付",
  createDialogTitle: "新增交付记录",
  createDialogDesc: "把成交后的客户工作沉淀为可追踪的交付记录。",
  editDialogTitle: "编辑交付记录",
  editDialogDesc: "更新阶段、验收状态、交付物或风险。",
  createToast: "交付记录已创建",
  updateToast: "交付记录已保存",
  filterParam: "stage",
  editable: true,
  deletable: true,

  filters: [
    { id: "all", label: "全部" },
    ...DELIVERY_STAGES.map((stage) => ({ id: stage, label: stage })),
  ],

  stats: (items) => ({
    total: items.length,
    active: items.filter(isActive).length,
    accepted: items.filter((item) => item.acceptance_status === "已验收").length,
    overdue: items.filter(isOverdue).length,
  }),

  statsGridCols: "grid-cols-2 lg:grid-cols-4",

  statsCards: (stats) => [
    { icon: PackageIcon, label: "交付总数", value: stats.total },
    { icon: CalendarClockIcon, label: "进行中", value: stats.active, color: "text-blue-600" },
    { icon: CheckCircle2Icon, label: "已验收", value: stats.accepted, color: "text-emerald-600" },
    { icon: AlertTriangleIcon, label: "需关注", value: stats.overdue, color: "text-rose-600" },
  ],

  columns: [
    {
      accessorKey: "title",
      header: "交付",
      cell: ({ getValue, row }) => (
        <div>
          <span className="font-medium">{getValue()}</span>
          <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
            {[row.original.contact_name, row.original.project_name].filter(Boolean).join(" · ") || "未关联客户/项目"}
          </div>
        </div>
      ),
    },
    { accessorKey: "delivery_type", header: "类型" },
    {
      accessorKey: "stage",
      header: "阶段",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={STAGE_COLORS} />,
    },
    {
      accessorKey: "acceptance_status",
      header: "验收",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={ACCEPTANCE_COLORS} />,
    },
    { accessorKey: "owner", header: "内部负责人" },
    { accessorKey: "customer_owner", header: "客户负责人" },
    {
      accessorKey: "due_date",
      header: "计划验收",
      cell: ({ getValue, row }) => {
        const value = getValue()
        if (!value) return <span className="text-muted-foreground">-</span>
        return (
          <span className={cn("whitespace-nowrap text-[12px]", isOverdue(row.original) && "font-medium text-rose-600")}>
            {value}
          </span>
        )
      },
    },
  ],

  kanban: {
    laneKey: "stage",
    lanes: DELIVERY_STAGES.map((stage) => ({ id: stage, label: stage, color: stage === "已完成" || stage === "已归档" ? "bg-emerald-400" : stage === "验收中" ? "bg-amber-400" : stage === "交付中" ? "bg-blue-400" : "bg-slate-400" })),
    renderCard: (item) => (
      <div className="rounded-lg border bg-card p-3 shadow-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium">{item.title}</div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">
              {[item.contact_name, item.project_name].filter(Boolean).join(" · ") || item.delivery_type}
            </div>
          </div>
          <BadgeCell value={item.acceptance_status} colorMap={ACCEPTANCE_COLORS} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate">{item.owner || "未指定负责人"}</span>
          <span className={cn("whitespace-nowrap", isOverdue(item) && "font-medium text-rose-600")}>{item.due_date || "未排期"}</span>
        </div>
      </div>
    ),
  },

  formFields: FORM_FIELDS,
  beforeCreate: normalizePayload,
  beforeUpdate: normalizePayload,

  detail: {
    detailTitleKey: "title",
    detailIcon: PackageIcon,
    detailIconBg: "bg-blue-500/10 text-blue-600",
    detailSubtitle: (item) => [item.contact_name, item.project_name, item.delivery_type].filter(Boolean).join(" · "),
    detailBadges: (item) => [
      { label: item.stage, cls: STAGE_COLORS[item.stage] || "bg-zinc-100 text-zinc-600" },
      { label: item.acceptance_status, cls: ACCEPTANCE_COLORS[item.acceptance_status] || "bg-zinc-100 text-zinc-600" },
    ],
    detailFields: [
      { key: "owner", label: "内部负责人" },
      { key: "customer_owner", label: "客户负责人" },
      { key: "start_date", label: "开始日期" },
      { key: "due_date", label: "计划验收" },
      { key: "accepted_at", label: "验收时间" },
      { key: "handover_doc_id", label: "交接文档" },
      { key: "deliverables", label: "交付物", render: formatList },
      { key: "risks", label: "风险" , render: formatList },
      { key: "remark", label: "备注" },
    ],
  },
}
