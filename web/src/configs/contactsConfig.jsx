// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useState } from "react"
import {
  Building2Icon,
  DollarSignIcon,
  FileTextIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneIcon,
  PlusIcon,
  TagIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  CalendarIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataForm } from "@/components/data-view"
import { BadgeCell, CurrencyCell } from "@/components/data-view/DataGrid"

const FOLLOW_METHODS = ["微信", "面谈", "电话", "群聊"]
const FOLLOW_STATUSES = ["待跟进", "已跟进", "已完成"]
const PAYMENT_STATUSES = ["已回款", "部分回款", "未回款"]

const FOLLOW_UP_FIELDS = [
  { key: "date", label: "跟进日期", type: "date", defaultValue: today() },
  { key: "method", label: "方式", type: "select", options: FOLLOW_METHODS, defaultValue: "微信" },
  { key: "status", label: "状态", type: "select", options: FOLLOW_STATUSES, defaultValue: "已跟进" },
  { key: "content", label: "跟进内容", required: true, type: "textarea", placeholder: "记录本次沟通、需求变化或客户反馈 *", fullWidth: true },
  { key: "next_step", label: "下一步", type: "textarea", placeholder: "下一步动作、负责人或时间点", fullWidth: true },
]

const DOC_FIELDS = [
  { key: "filename", label: "文档标题", required: true, placeholder: "例如：需求访谈纪要 *" },
  { key: "content", label: "初始内容", type: "textarea", placeholder: "可以先写一个摘要，后续在知识库继续完善", fullWidth: true },
]

const DEAL_FIELDS = [
  { key: "amount", label: "成交金额", type: "number", required: true, placeholder: "成交金额 *" },
  { key: "date", label: "成交日期", type: "date", defaultValue: today() },
  { key: "product_type", label: "产品/项目", placeholder: "课程、培训、软件开发..." },
  { key: "payment_status", label: "回款状态", type: "select", options: PAYMENT_STATUSES, defaultValue: "未回款" },
  { key: "description", label: "成交说明", type: "textarea", placeholder: "成交背景、交付范围或后续事项", fullWidth: true },
]

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

  detailExtra: function ContactCasePanel({ item, onReload, onItemUpdate }) {
    const [channels, setChannels] = useState([])
    const [followUps, setFollowUps] = useState([])
    const [docs, setDocs] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeForm, setActiveForm] = useState(null)

    const load = useCallback(async () => {
      setLoading(true)
      try {
        const [channelsResp, followUpsResp, docsResp] = await Promise.all([
          fetch(`/api/crazor/contacts/${item.id}/channels`),
          fetch(`/api/crazor/follow-ups?contact_id=${encodeURIComponent(item.id)}`),
          fetch(`/api/crazor/contacts/${item.id}/docs`),
        ])
        setChannels(channelsResp.ok ? await channelsResp.json() : [])
        setFollowUps(followUpsResp.ok ? await followUpsResp.json() : [])
        setDocs(docsResp.ok ? await docsResp.json() : [])
      } catch { /* ignore */ }
      setLoading(false)
    }, [item.id])

    useEffect(() => { load() }, [load])

    const handleCreateFollowUp = async (data) => {
      try {
        await postJson("/api/crazor/follow-ups", {
          ...data,
          contact_id: item.id,
          date: data.date || today(),
          method: data.method || "微信",
          status: data.status || "已跟进",
        })

        const contactPatch = {}
        if (data.next_step) contactPatch.next_follow_up = data.next_step
        if (item.stage === "新线索") contactPatch.stage = "跟进中"

        if (Object.keys(contactPatch).length > 0) {
          const updatedContact = await patchJson(`/api/crazor/contacts/${item.id}`, contactPatch)
          onItemUpdate?.(updatedContact)
        }

        toast.success("跟进记录已保存")
        setActiveForm(null)
        await load()
        await onReload?.()
      } catch (error) {
        toast.error("跟进记录保存失败", { description: String(error?.message || error) })
      }
    }

    const handleCreateDoc = async (data) => {
      try {
        await postJson(`/api/crazor/contacts/${item.id}/docs`, {
          filename: data.filename,
          contactName: item.name,
          content: data.content || buildDefaultDocContent(item, data.filename),
        })
        toast.success("需求文档已创建")
        setActiveForm(null)
        await load()
      } catch (error) {
        toast.error("需求文档创建失败", { description: String(error?.message || error) })
      }
    }

    const handleRecordDeal = async (data) => {
      try {
        const amount = Number(data.amount || 0)
        if (!amount) throw new Error("成交金额必填")
        await postJson("/api/crazor/transactions", {
          contact_id: item.id,
          type: "income",
          amount,
          date: data.date || today(),
          description: data.description || `${item.name} 成交`,
          product_type: data.product_type || item.project_type || "",
          payment_status: data.payment_status || "未回款",
        })
        const updatedContact = await patchJson(`/api/crazor/contacts/${item.id}`, {
          stage: "已成交",
          deal: Number(item.deal || 0) + amount,
        })
        onItemUpdate?.(updatedContact)
        toast.success("成交已登记")
        setActiveForm(null)
        await load()
        await onReload?.()
      } catch (error) {
        toast.error("成交登记失败", { description: String(error?.message || error) })
      }
    }

    if (loading) return <div className="text-[11px] text-muted-foreground border-t pt-3">加载中...</div>

    return (
      <div className="flex flex-col gap-4 border-t pt-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={activeForm === "follow-up" ? "default" : "outline"} onClick={() => setActiveForm(activeForm === "follow-up" ? null : "follow-up")}>
            <PlusIcon className="size-3.5" />
            跟进
          </Button>
          <Button size="sm" variant={activeForm === "doc" ? "default" : "outline"} onClick={() => setActiveForm(activeForm === "doc" ? null : "doc")}>
            <FileTextIcon className="size-3.5" />
            需求文档
          </Button>
          <Button size="sm" variant={activeForm === "deal" ? "default" : "outline"} onClick={() => setActiveForm(activeForm === "deal" ? null : "deal")}>
            <DollarSignIcon className="size-3.5" />
            成交
          </Button>
        </div>

        {activeForm === "follow-up" && (
          <ActionForm title="新增跟进记录">
            <DataForm fields={FOLLOW_UP_FIELDS} onSubmit={handleCreateFollowUp} onCancel={() => setActiveForm(null)} submitLabel="保存跟进" />
          </ActionForm>
        )}

        {activeForm === "doc" && (
          <ActionForm title="新建需求文档">
            <DataForm fields={DOC_FIELDS} onSubmit={handleCreateDoc} onCancel={() => setActiveForm(null)} submitLabel="创建文档" />
          </ActionForm>
        )}

        {activeForm === "deal" && (
          <ActionForm title="登记成交">
            <DataForm fields={DEAL_FIELDS} onSubmit={handleRecordDeal} onCancel={() => setActiveForm(null)} submitLabel="登记成交" />
          </ActionForm>
        )}

        <CaseSection title={`跟进记录 (${followUps.length})`}>
          {followUps.length === 0 ? (
            <EmptyLine>暂无跟进记录</EmptyLine>
          ) : (
            followUps.map((f) => (
              <div key={f.id} className="rounded-md border px-2.5 py-2 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <MessageSquareIcon className="size-3.5 text-muted-foreground" />
                    <span>{f.method || "跟进"}</span>
                    <Badge variant="outline" className="h-4 text-[10px]">{f.status || "待跟进"}</Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{f.date || "-"}</span>
                </div>
                {f.content && <div className="mt-1 leading-5">{f.content}</div>}
                {f.next_step && <div className="mt-1 text-muted-foreground">下一步：{f.next_step}</div>}
              </div>
            ))
          )}
        </CaseSection>

        <CaseSection title={`需求文档 (${docs.length})`}>
          {docs.length === 0 ? (
            <EmptyLine>暂无关联文档</EmptyLine>
          ) : (
            docs.map((doc) => (
              <div key={doc.id || doc.path || doc.name} className="rounded-md border px-2.5 py-2 text-[12px]">
                <div className="flex items-center gap-1.5 font-medium">
                  <FileTextIcon className="size-3.5 text-muted-foreground" />
                  <span>{doc.title || doc.name}</span>
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">{doc.id || doc.path}</div>
              </div>
            ))
          )}
        </CaseSection>

        <CaseSection title={`关联渠道 (${channels.length})`}>
          {channels.length === 0 ? (
            <EmptyLine>暂无关联渠道</EmptyLine>
          ) : (
            channels.map((ch) => (
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
            ))
          )}
        </CaseSection>
      </div>
    )
  },
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function postJson(url, payload) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return parseJsonResponse(resp)
}

async function patchJson(url, payload) {
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return parseJsonResponse(resp)
}

async function parseJsonResponse(resp) {
  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new Error(body?.error || body?.message || `请求失败：${resp.status}`)
  }
  return body
}

function buildDefaultDocContent(contact, title) {
  return [
    `# ${title}`,
    "",
    `- 客户：${contact.name || ""}`,
    `- 公司：${contact.company || ""}`,
    `- 创建日期：${today()}`,
    "",
    "## 需求摘要",
    "",
    "## 关键约束",
    "",
    "## 下一步",
    "",
  ].join("\n")
}

function ActionForm({ title, children }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 text-[12px] font-medium">{title}</div>
      {children}
    </div>
  )
}

function CaseSection({ title, children }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function EmptyLine({ children }) {
  return <div className="rounded-md border border-dashed px-2.5 py-2 text-[12px] text-muted-foreground">{children}</div>
}
