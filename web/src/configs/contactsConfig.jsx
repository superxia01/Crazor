// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BellIcon,
  Building2Icon,
  DownloadIcon,
  DollarSignIcon,
  EyeIcon,
  FileTextIcon,
  GlobeIcon,
  ExternalLinkIcon,
  MailIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PhoneIcon,
  PlusIcon,
  PencilIcon,
  KanbanSquareIcon,
  SearchIcon,
  TagIcon,
  TrendingUpIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  UsersIcon,
  CalendarIcon,
  CheckSquareIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const REFERRAL_FIELDS = [
  { key: "channel_id", label: "渠道", type: "asyncSelect", required: true, placeholder: "选择渠道 *", asyncOptions: async () => {
    try {
      const r = await fetch("/api/crazor/channels")
      if (!r.ok) return []
      const channels = await r.json()
      return channels.map((c) => ({ value: c.id, label: `${c.name}${c.rating ? ` · ${c.rating}` : ""}` }))
    } catch { return [] }
  }},
  { key: "product_type", label: "产品/项目", placeholder: "培训、软件开发、课程..." },
  { key: "deal_amount", label: "商机金额", type: "number", defaultValue: 0 },
  { key: "date", label: "引入日期", type: "date", defaultValue: today() },
]

const PROJECT_FIELDS = [
  { key: "name", label: "项目名称", required: true, placeholder: "项目名称 *" },
  { key: "budget", label: "预算", type: "number", defaultValue: 0 },
  { key: "team", label: "团队成员", placeholder: "团队成员" },
  { key: "deadline", label: "截止日期", type: "date" },
  { key: "description", label: "项目说明", type: "textarea", placeholder: "交付范围、客户目标、约束条件", fullWidth: true },
]

const TASK_PRIORITIES = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
]
const TASK_STATUSES = [
  { value: "todo", label: "待办" },
  { value: "in_progress", label: "进行中" },
  { value: "done", label: "完成" },
]
const TASK_STATUS_LABELS = {
  todo: "待办",
  in_progress: "进行中",
  done: "完成",
}
const TASK_PRIORITY_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
}
const REMINDER_DONE_STATUS = "已完成"

function buildTaskFields(projects) {
  return [
    {
      key: "project_id",
      label: "所属项目",
      type: "select",
      required: true,
      options: projects.map((project) => ({ value: project.id, label: project.name })),
      placeholder: "选择项目 *",
    },
    { key: "title", label: "任务标题", required: true, placeholder: "任务标题 *" },
    { key: "priority", label: "优先级", type: "select", options: TASK_PRIORITIES, defaultValue: "medium" },
    { key: "status", label: "状态", type: "select", options: TASK_STATUSES, defaultValue: "todo" },
    { key: "assignee", label: "负责人", placeholder: "负责人" },
    { key: "due_date", label: "截止日期", type: "date" },
    { key: "estimated_hours", label: "预估工时", type: "number", defaultValue: 0 },
    { key: "description", label: "任务说明", type: "textarea", placeholder: "交付动作、验收标准或依赖事项", fullWidth: true },
  ]
}

const DOC_EDIT_FIELDS = [
  { key: "title", label: "文档标题", required: true, placeholder: "文档标题 *" },
  { key: "content", label: "文档内容", type: "textarea", placeholder: "需求正文", fullWidth: true },
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
    const [docSearchQuery, setDocSearchQuery] = useState("")
    const [docSearchResults, setDocSearchResults] = useState([])
    const [docSearchActive, setDocSearchActive] = useState(false)
    const [docSearchLoading, setDocSearchLoading] = useState(false)
    const [attachments, setAttachments] = useState([])
    const [attachmentPolicy, setAttachmentPolicy] = useState(null)
    const [activeAttachmentPreview, setActiveAttachmentPreview] = useState(null)
    const [attachmentPreviewLoading, setAttachmentPreviewLoading] = useState(false)
    const [uploadingAttachment, setUploadingAttachment] = useState(false)
    const [projects, setProjects] = useState([])
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeForm, setActiveForm] = useState(null)
    const [activeDoc, setActiveDoc] = useState(null)
    const [activeTaskProjectId, setActiveTaskProjectId] = useState("")
    const fileInputRef = useRef(null)

    const load = useCallback(async () => {
      setLoading(true)
      try {
        const [channelsResp, followUpsResp, docsResp, attachmentsResp, attachmentPolicyResp, projectsResp, tasksResp] = await Promise.all([
          fetch(`/api/crazor/contacts/${item.id}/channels`),
          fetch(`/api/crazor/follow-ups?contact_id=${encodeURIComponent(item.id)}`),
          fetch(`/api/crazor/contacts/${item.id}/docs`),
          fetch(`/api/crazor/contacts/${item.id}/attachments`),
          fetch("/api/crazor/attachments/policy"),
          fetch("/api/crazor/projects"),
          fetch(`/api/crazor/tasks?contact_id=${encodeURIComponent(item.id)}`),
        ])
        setChannels(channelsResp.ok ? await channelsResp.json() : [])
        setFollowUps(followUpsResp.ok ? await followUpsResp.json() : [])
        setDocs(docsResp.ok ? await docsResp.json() : [])
        setAttachments(attachmentsResp.ok ? await attachmentsResp.json() : [])
        setAttachmentPolicy(attachmentPolicyResp.ok ? await attachmentPolicyResp.json() : null)
        const allProjects = projectsResp.ok ? await projectsResp.json() : []
        setProjects(allProjects.filter((project) => project.contact_id === item.id))
        setTasks(tasksResp.ok ? await tasksResp.json() : [])
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

    const handleOpenDoc = async (doc) => {
      if (!doc?.id || doc.source === "legacy" || doc.id.startsWith("legacy:")) {
        toast.error("旧目录文档暂不支持在客户详情内编辑")
        return
      }
      try {
        const note = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(doc.id)}`)
        setActiveDoc(note)
        setActiveForm("doc-edit")
      } catch (error) {
        toast.error("文档读取失败", { description: String(error?.message || error) })
      }
    }

    const handleUpdateDoc = async (data) => {
      if (!activeDoc?.id) return
      try {
        await patchJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(activeDoc.id)}`, {
          title: data.title,
          content: data.content || "",
        })
        toast.success("需求文档已保存")
        setActiveForm(null)
        setActiveDoc(null)
        await load()
      } catch (error) {
        toast.error("需求文档保存失败", { description: String(error?.message || error) })
      }
    }

    const handleCompleteReminder = async (followUp) => {
      try {
        await patchJson(`/api/crazor/follow-ups/${followUp.id}`, { status: REMINDER_DONE_STATUS })
        toast.success("跟进提醒已完成")
        await load()
        await onReload?.()
      } catch (error) {
        toast.error("提醒处理失败", { description: String(error?.message || error) })
      }
    }

    const handleSnoozeReminder = async (followUp, days) => {
      const nextDate = dateDaysFromNow(days)
      try {
        await patchJson(`/api/crazor/follow-ups/${followUp.id}`, { date: nextDate, status: "待跟进" })
        const updatedContact = await patchJson(`/api/crazor/contacts/${item.id}`, { next_follow_up: nextDate })
        onItemUpdate?.(updatedContact)
        toast.success(days >= 7 ? "已顺延到下周" : "已顺延到明天")
        await load()
        await onReload?.()
      } catch (error) {
        toast.error("提醒顺延失败", { description: String(error?.message || error) })
      }
    }

    const handleSearchDocs = async () => {
      const q = docSearchQuery.trim()
      if (!q) {
        setDocSearchResults([])
        setDocSearchActive(false)
        return
      }
      setDocSearchLoading(true)
      try {
        const results = await getJson(`/api/crazor/contacts/${item.id}/docs/search?q=${encodeURIComponent(q)}`)
        setDocSearchResults(Array.isArray(results) ? results : [])
        setDocSearchActive(true)
      } catch (error) {
        toast.error("文档搜索失败", { description: String(error?.message || error) })
      } finally {
        setDocSearchLoading(false)
      }
    }

    const handleClearDocSearch = () => {
      setDocSearchQuery("")
      setDocSearchResults([])
      setDocSearchActive(false)
    }

    const handleUploadAttachment = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      const policyError = validateAttachmentFile(file, attachmentPolicy)
      if (policyError) {
        toast.error(policyError)
        event.target.value = ""
        return
      }
      setUploadingAttachment(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const resp = await fetch(`/api/crazor/contacts/${item.id}/attachments`, {
          method: "POST",
          body: formData,
        })
        await parseJsonResponse(resp)
        toast.success("附件已归档")
        await load()
      } catch (error) {
        toast.error("附件上传失败", { description: String(error?.message || error) })
      } finally {
        setUploadingAttachment(false)
        event.target.value = ""
      }
    }

    const handlePreviewAttachment = async (attachment) => {
      if (!attachment?.preview_url) return
      setAttachmentPreviewLoading(true)
      try {
        const preview = await getJson(attachment.preview_url)
        setActiveAttachmentPreview({ ...preview, attachment })
      } catch (error) {
        toast.error("附件预览失败", { description: String(error?.message || error) })
      } finally {
        setAttachmentPreviewLoading(false)
      }
    }

    const handleDeleteAttachment = async (attachment) => {
      if (!attachment?.download_url) return
      try {
        const resp = await fetch(attachment.download_url, { method: "DELETE" })
        await parseJsonResponse(resp)
        toast.success("附件已删除")
        if (activeAttachmentPreview?.attachment?.id === attachment.id) setActiveAttachmentPreview(null)
        await load()
      } catch (error) {
        toast.error("附件删除失败", { description: String(error?.message || error) })
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

    const handleCreateReferral = async (data) => {
      try {
        if (!data.channel_id) throw new Error("请选择渠道")
        await postJson(`/api/crazor/channels/${data.channel_id}/referrals`, {
          contact_id: item.id,
          product_type: data.product_type || item.project_type || "",
          deal_amount: Number(data.deal_amount || 0),
          date: data.date || today(),
        })
        toast.success("渠道转介绍已建立")
        setActiveForm(null)
        await load()
        await onReload?.()
      } catch (error) {
        toast.error("渠道转介绍创建失败", { description: String(error?.message || error) })
      }
    }

    const handleCreateProject = async (data) => {
      try {
        const project = await postJson("/api/crazor/projects", {
          ...data,
          name: data.name || `${item.name} 项目机会`,
          contact_id: item.id,
          budget: Number(data.budget || item.deal || 0),
          description: data.description || buildDefaultProjectDescription(item),
        })
        toast.success("项目机会已创建")
        setActiveForm(null)
        await load()
        await onReload?.()
        window.__activeProject = project.id
        window.dispatchEvent(new CustomEvent("dataview-reload"))
      } catch (error) {
        toast.error("项目机会创建失败", { description: String(error?.message || error) })
      }
    }

    const handleOpenTaskForm = (projectId = "") => {
      if (projects.length === 0) {
        toast.error("请先从客户生成项目机会")
        return
      }
      setActiveTaskProjectId(projectId || projects[0]?.id || "")
      setActiveForm(activeForm === "task" && (!projectId || projectId === activeTaskProjectId) ? null : "task")
    }

    const handleCreateTask = async (data) => {
      try {
        if (!data.project_id) throw new Error("请选择所属项目")
        await postJson("/api/crazor/tasks", {
          ...data,
          title: data.title,
          project_id: data.project_id,
          priority: data.priority || "medium",
          status: data.status || "todo",
          estimated_hours: Number(data.estimated_hours || 0),
        })
        toast.success("项目任务已拆解")
        setActiveForm(null)
        setActiveTaskProjectId("")
        await load()
        await onReload?.()
      } catch (error) {
        toast.error("项目任务创建失败", { description: String(error?.message || error) })
      }
    }

    const visibleDocs = docSearchActive ? docSearchResults : docs
    const dueFollowUps = followUps.filter(isDueFollowUpReminder)

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
          <Button size="sm" variant={activeForm === "referral" ? "default" : "outline"} onClick={() => setActiveForm(activeForm === "referral" ? null : "referral")}>
            <GlobeIcon className="size-3.5" />
            渠道转介绍
          </Button>
          <Button size="sm" variant={activeForm === "project" ? "default" : "outline"} onClick={() => setActiveForm(activeForm === "project" ? null : "project")}>
            <KanbanSquareIcon className="size-3.5" />
            生成项目
          </Button>
          <Button size="sm" variant={activeForm === "task" ? "default" : "outline"} onClick={() => handleOpenTaskForm()}>
            <CheckSquareIcon className="size-3.5" />
            拆任务
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingAttachment}>
            <UploadIcon className="size-3.5" />
            {uploadingAttachment ? "上传中" : "上传附件"}
          </Button>
          <input ref={fileInputRef} type="file" accept={attachmentPolicy?.accept || undefined} className="hidden" onChange={handleUploadAttachment} />
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

        {activeForm === "doc-edit" && activeDoc && (
          <ActionForm title="编辑需求文档">
            <DataForm fields={DOC_EDIT_FIELDS} initial={activeDoc} onSubmit={handleUpdateDoc} onCancel={() => { setActiveForm(null); setActiveDoc(null) }} submitLabel="保存文档" />
          </ActionForm>
        )}

        {activeForm === "deal" && (
          <ActionForm title="登记成交">
            <DataForm fields={DEAL_FIELDS} onSubmit={handleRecordDeal} onCancel={() => setActiveForm(null)} submitLabel="登记成交" />
          </ActionForm>
        )}

        {activeForm === "referral" && (
          <ActionForm title="建立渠道转介绍">
            <DataForm fields={REFERRAL_FIELDS} onSubmit={handleCreateReferral} onCancel={() => setActiveForm(null)} submitLabel="建立关联" />
          </ActionForm>
        )}

        {activeForm === "project" && (
          <ActionForm title="从客户生成项目机会">
            <DataForm
              fields={PROJECT_FIELDS}
              initial={{
                name: `${item.name || "客户"} 项目机会`,
                budget: Number(item.deal || 0),
                team: item.sales_person || "",
                description: buildDefaultProjectDescription(item),
              }}
              onSubmit={handleCreateProject}
              onCancel={() => setActiveForm(null)}
              submitLabel="创建项目"
            />
          </ActionForm>
        )}

        {activeForm === "task" && (
          <ActionForm title="从客户项目拆解任务">
            <DataForm
              key={activeTaskProjectId || projects[0]?.id || "task"}
              fields={buildTaskFields(projects)}
              initial={{
                project_id: activeTaskProjectId || projects[0]?.id || "",
                priority: "medium",
                status: "todo",
                assignee: item.sales_person || "",
                estimated_hours: 0,
              }}
              onSubmit={handleCreateTask}
              onCancel={() => { setActiveForm(null); setActiveTaskProjectId("") }}
              submitLabel="创建任务"
            />
          </ActionForm>
        )}

        {dueFollowUps.length > 0 && (
          <CaseSection title={`待处理提醒 (${dueFollowUps.length})`}>
            {dueFollowUps.map((f) => (
              <div key={f.id} className="rounded-md border border-rose-500/20 bg-rose-500/5 px-2.5 py-2 text-[12px]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-300">
                      <BellIcon className="size-3.5 shrink-0" />
                      <span>{isPastDate(f.date) ? "已逾期" : "今日跟进"}</span>
                      {f.method && <Badge variant="outline" className="h-4 text-[10px]">{f.method}</Badge>}
                    </div>
                    {f.content && <div className="mt-1 line-clamp-2 leading-5">{f.content}</div>}
                    {f.next_step && <div className="mt-1 text-muted-foreground">下一步：{f.next_step}</div>}
                    <div className="mt-1 text-[11px] text-muted-foreground">计划日期：{f.date || "-"}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button size="xs" variant="outline" onClick={() => void handleSnoozeReminder(f, 1)}>
                      <CalendarIcon className="size-3" />
                      明天
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => void handleSnoozeReminder(f, 7)}>
                      <CalendarIcon className="size-3" />
                      下周
                    </Button>
                    <Button size="xs" onClick={() => void handleCompleteReminder(f)}>
                      <CheckSquareIcon className="size-3" />
                      完成
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CaseSection>
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
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={docSearchQuery}
                onChange={(event) => setDocSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleSearchDocs()
                  }
                }}
                placeholder="搜索需求文档正文"
                className="h-8 pl-7 text-[12px]"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => void handleSearchDocs()} disabled={docSearchLoading} className="h-8">
              <SearchIcon className="size-3" />
              {docSearchLoading ? "搜索中" : "搜索"}
            </Button>
            {docSearchActive && (
              <Button size="icon-sm" variant="ghost" onClick={handleClearDocSearch} aria-label="清除文档搜索">
                <XIcon className="size-3.5" />
              </Button>
            )}
          </div>
          {visibleDocs.length === 0 ? (
            <EmptyLine>{docSearchActive ? "没有匹配文档" : "暂无关联文档"}</EmptyLine>
          ) : (
            visibleDocs.map((doc) => (
              <div key={doc.id || doc.path || doc.name} className="rounded-md border px-2.5 py-2 text-[12px]">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => handleOpenDoc(doc)} className="flex min-w-0 items-center gap-1.5 text-left font-medium hover:text-primary">
                    <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.title || doc.name}</span>
                    <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                  </button>
                  {doc.source !== "legacy" && (
                    <Button size="sm" variant="ghost" onClick={() => handleOpenDoc(doc)} className="h-6 shrink-0 rounded-md px-2 text-[11px]">
                      <PencilIcon className="size-3" />
                      编辑
                    </Button>
                  )}
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">{doc.id || doc.path}</div>
                {doc.snippet && <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{doc.snippet}</div>}
              </div>
            ))
          )}
        </CaseSection>

        <CaseSection title={`附件归档 (${attachments.length})`}>
          {attachmentPolicy && (
            <div className="text-[11px] text-muted-foreground">
              单个附件不超过 {formatFileSize(attachmentPolicy.max_bytes)}，允许 {formatAttachmentExtensions(attachmentPolicy.allowed_extensions)}
            </div>
          )}
          {attachments.length === 0 ? (
            <EmptyLine>暂无归档附件</EmptyLine>
          ) : (
            attachments.map((attachment) => (
              <div key={attachment.id || attachment.name} className="rounded-md border px-2.5 py-2 text-[12px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-1.5">
                    <PaperclipIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{attachment.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatFileSize(attachment.size)} · {formatDateTime(attachment.updated_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {attachment.can_preview && (
                      <Button size="icon-xs" variant="ghost" onClick={() => void handlePreviewAttachment(attachment)} disabled={attachmentPreviewLoading} aria-label="预览附件">
                        <EyeIcon className="size-3" />
                      </Button>
                    )}
                    <Button asChild size="icon-xs" variant="ghost" aria-label="下载附件">
                      <a href={attachment.download_url} download={attachment.name}>
                        <DownloadIcon className="size-3" />
                      </a>
                    </Button>
                    <Button size="icon-xs" variant="ghost" onClick={() => void handleDeleteAttachment(attachment)} aria-label="删除附件">
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          {activeAttachmentPreview && (
            <AttachmentPreviewPanel preview={activeAttachmentPreview} onClose={() => setActiveAttachmentPreview(null)} />
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

        <CaseSection title={`项目机会 (${projects.length})`}>
          {projects.length === 0 ? (
            <EmptyLine>暂无关联项目</EmptyLine>
          ) : (
            projects.map((project) => {
              const projectTasks = tasks.filter((task) => task.project_id === project.id)
              return (
                <div key={project.id} className="rounded-md border px-2.5 py-2 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 font-medium">
                      <KanbanSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{project.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {Number(project.budget || 0) > 0 && (
                        <span className="text-primary font-medium">
                          ¥{Number(project.budget) >= 10000 ? (Number(project.budget) / 10000).toFixed(1) + "万" : Number(project.budget).toLocaleString()}
                        </span>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleOpenTaskForm(project.id)} className="h-6 rounded-md px-2 text-[11px]">
                        <CheckSquareIcon className="size-3" />
                        拆任务
                      </Button>
                    </div>
                  </div>
                  {project.description && <div className="mt-1 line-clamp-2 text-muted-foreground">{project.description}</div>}
                  <div className="mt-2 border-t pt-2">
                    {projectTasks.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground">暂无任务</div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {projectTasks.map((task) => (
                          <div key={task.id} className="flex flex-col gap-1 text-[11px] sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <CheckSquareIcon className="size-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{task.title}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="h-4 text-[10px]">{TASK_STATUS_LABELS[task.status] || task.status}</Badge>
                              <Badge variant="outline" className="h-4 text-[10px]">{TASK_PRIORITY_LABELS[task.priority] || task.priority}</Badge>
                              {task.due_date && <span className="text-muted-foreground">{task.due_date}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CaseSection>
      </div>
    )
  },
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function dateDaysFromNow(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function isDueFollowUpReminder(followUp) {
  return followUp?.status === "待跟进" && Boolean(followUp.date) && String(followUp.date) <= today()
}

function isPastDate(value) {
  return Boolean(value) && String(value) < today()
}

function formatFileSize(value) {
  const size = Number(value || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDateTime(value) {
  if (!value) return "-"
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(value)
  }
}

function formatAttachmentExtensions(extensions) {
  const list = Array.isArray(extensions) ? extensions : []
  if (list.includes("*")) return "全部类型"
  if (list.length === 0) return "默认类型"
  return list.map((ext) => `.${ext}`).join("、")
}

function attachmentExtension(filename) {
  const name = String(filename || "")
  const dotIndex = name.lastIndexOf(".")
  if (dotIndex <= 0 || dotIndex === name.length - 1) return ""
  return name.slice(dotIndex + 1).toLowerCase()
}

function validateAttachmentFile(file, policy) {
  if (!policy) return ""
  if (policy.max_bytes && file.size > Number(policy.max_bytes)) {
    return `附件不能超过 ${formatFileSize(policy.max_bytes)}`
  }
  const allowed = Array.isArray(policy.allowed_extensions) ? policy.allowed_extensions : []
  if (allowed.length > 0 && !allowed.includes("*")) {
    const ext = attachmentExtension(file.name)
    if (!ext || !allowed.includes(ext)) {
      return `不支持 .${ext || "无扩展名"} 文件`
    }
  }
  return ""
}

function AttachmentPreviewPanel({ preview, onClose }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2.5 text-[12px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{preview.name || preview.attachment?.name || "附件预览"}</div>
          <div className="text-[11px] text-muted-foreground">{formatFileSize(preview.size)} · {preview.mime_type || preview.kind || "file"}</div>
        </div>
        <Button size="icon-xs" variant="ghost" onClick={onClose} aria-label="关闭附件预览">
          <XIcon className="size-3" />
        </Button>
      </div>
      {!preview.previewable ? (
        <EmptyLine>{preview.reason || "该附件暂不支持预览，请下载查看"}</EmptyLine>
      ) : preview.kind === "image" ? (
        <div className="overflow-hidden rounded-md border bg-background">
          <img
            src={`data:${preview.mime_type || "image/png"};base64,${preview.content_base64 || ""}`}
            alt={preview.name || "附件预览"}
            className="max-h-64 w-full object-contain"
          />
        </div>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-md border bg-background p-2 text-[11px] leading-5 whitespace-pre-wrap break-words">
          {preview.content || ""}
        </pre>
      )}
    </div>
  )
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

async function getJson(url) {
  const resp = await fetch(url)
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

function buildDefaultProjectDescription(contact) {
  return [
    `客户：${contact.name || ""}`,
    `公司：${contact.company || ""}`,
    `来源：${contact.source || ""}`,
    `项目类型：${contact.project_type || ""}`,
    `预算范围：${contact.budget_range || ""}`,
    "",
    "## 客户背景",
    contact.situation || "",
    "",
    "## 交付目标",
    "",
    "## 下一步",
    contact.next_follow_up || "",
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
