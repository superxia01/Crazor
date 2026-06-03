// Copyright (c) 2026 MeeJoy

import { useState } from "react"
import {
  BarChart3Icon,
  CalendarIcon,
  CheckCircleIcon,
  EyeIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HeartIcon,
  LinkIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  NewspaperIcon,
  SearchIcon,
  Share2Icon,
  TagIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataForm } from "@/components/data-view"
import { BadgeCell } from "@/components/data-view/DataGrid"

const PLATFORM_COLORS = {
  "公众号": "bg-green-100 text-green-700",
  "小红书": "bg-rose-100 text-rose-700",
  "抖音": "bg-zinc-100 text-zinc-700",
  "视频号": "bg-orange-100 text-orange-700",
  "YouTube": "bg-red-100 text-red-700",
  "Twitter": "bg-sky-100 text-sky-700",
  "Instagram": "bg-pink-100 text-pink-700",
  "TikTok": "bg-zinc-200 text-zinc-800",
}
const FORM_COLORS = {
  "文章": "bg-sky-100 text-sky-700",
  "图文": "bg-pink-100 text-pink-700",
  "口播稿": "bg-amber-100 text-amber-700",
  "Talk": "bg-teal-100 text-teal-700",
}
const STATUS_COLORS = {
  "选题中": "bg-violet-100 text-violet-700",
  "草稿": "bg-blue-100 text-blue-700",
  "拍摄中": "bg-orange-100 text-orange-700",
  "待发布": "bg-amber-100 text-amber-700",
  "已发布": "bg-emerald-100 text-emerald-700",
  "关闭": "bg-zinc-100 text-zinc-500",
}

const PLATFORMS = ["公众号", "小红书", "抖音", "视频号", "知识星球", "朋友圈", "YouTube", "Twitter", "Instagram", "Amazon", "TikTok", "Shopify"]
const FORMS = ["文章", "图文", "口播稿", "Talk"]
const STATUSES = ["选题中", "草稿", "拍摄中", "待发布", "已发布", "关闭"]

const FORM_FIELDS = [
  { key: "title", label: "标题", required: true, placeholder: "标题 *", fullWidth: true },
  { key: "platform", label: "平台", type: "select", options: PLATFORMS, defaultValue: "公众号" },
  { key: "form", label: "形式", type: "select", options: FORMS, defaultValue: "文章" },
  { key: "status", label: "状态", type: "select", options: STATUSES, defaultValue: "选题中" },
  { key: "published_at", label: "发布日期", type: "date" },
  { key: "topic_source", label: "选题来源", placeholder: "选题来源" },
  { key: "doc_id", label: "知识库文档ID", placeholder: "knowledge/..." },
  { key: "views", label: "阅读量", type: "number" },
  { key: "likes", label: "点赞", type: "number" },
  { key: "comments", label: "评论", type: "number" },
  { key: "shares", label: "转发/收藏", type: "number" },
]

const CONTENT_DOC_FOLDER_ID = "knowledge/20-业务流程/10-公域流量/40-内容资产"
const DOC_EDIT_FIELDS = [
  { key: "title", label: "正文标题", required: true, placeholder: "正文标题 *" },
  { key: "content", label: "正文内容", type: "textarea", placeholder: "内容正文、脚本或素材说明", fullWidth: true },
]
const METRICS_FIELDS = [
  { key: "views", label: "阅读/播放", type: "number" },
  { key: "likes", label: "点赞", type: "number" },
  { key: "comments", label: "评论", type: "number" },
  { key: "shares", label: "转发/收藏", type: "number" },
]

export default {
  apiBase: "/api/crazor/content-pieces",
  icon: MegaphoneIcon,
  badge: "内容",
  title: "平台流量",
  description: "管理各平台内容作品的状态追踪与数据回收",
  searchPlaceholder: "搜索标题...",
  createLabel: "新增作品",
  createDialogTitle: "新增内容作品",
  createDialogDesc: "记录内容标题、平台、状态和数据指标。",
  createToast: "内容作品已创建",
  updateToast: "内容作品已保存",
  filterParam: "platform",
  editable: true,
  deletable: true,

  filters: [
    { id: "all", label: "全部" },
    { id: "公众号", label: "公众号" },
    { id: "小红书", label: "小红书" },
    { id: "抖音", label: "抖音" },
    { id: "视频号", label: "视频号" },
    { id: "YouTube", label: "YouTube" },
    { id: "Twitter", label: "Twitter" },
    { id: "Instagram", label: "Instagram" },
    { id: "TikTok", label: "TikTok" },
  ],

  stats: (items) => {
    const published = items.filter((c) => c.status === "已发布")
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    return {
      total: items.length,
      published: published.length,
      totalViews: published.reduce((s, c) => s + (c.views || 0), 0),
      thisWeek: items.filter((c) => c.published_at && c.published_at >= weekAgo).length,
    }
  },

  statsGridCols: "grid-cols-2 lg:grid-cols-4",

  statsCards: (stats) => [
    { icon: FileTextIcon, label: "总作品", value: stats.total },
    { icon: MegaphoneIcon, label: "已发布", value: stats.published, color: "text-emerald-600" },
    { icon: EyeIcon, label: "总阅读", value: stats.totalViews?.toLocaleString() || 0, color: "text-blue-600" },
    { icon: CalendarIcon, label: "本周发布", value: stats.thisWeek, color: "text-violet-600" },
  ],

  columns: [
    {
      accessorKey: "title",
      header: "标题",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      accessorKey: "platform",
      header: "平台",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={PLATFORM_COLORS} />,
    },
    {
      accessorKey: "form",
      header: "形式",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={FORM_COLORS} />,
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ getValue }) => <BadgeCell value={getValue()} colorMap={STATUS_COLORS} />,
    },
    {
      accessorKey: "published_at",
      header: "发布日期",
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() || "-"}</span>,
    },
    {
      accessorKey: "views",
      header: "阅读",
      cell: ({ getValue }) => {
        const v = getValue()
        return v > 0 ? <span>{v.toLocaleString()}</span> : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: "likes",
      header: "点赞",
      cell: ({ getValue }) => {
        const v = getValue()
        return v > 0 ? v : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: "comments",
      header: "评论",
      cell: ({ getValue }) => {
        const v = getValue()
        return v > 0 ? v : <span className="text-muted-foreground">-</span>
      },
    },
  ],

  kanban: {
    laneKey: "status",
    lanes: [
      { id: "选题中", label: "选题中", color: "bg-violet-400" },
      { id: "草稿", label: "草稿", color: "bg-blue-400" },
      { id: "拍摄中", label: "拍摄中", color: "bg-orange-400" },
      { id: "待发布", label: "待发布", color: "bg-amber-400" },
      { id: "已发布", label: "已发布", color: "bg-emerald-400" },
      { id: "关闭", label: "关闭", color: "bg-zinc-400" },
    ],
    renderCard: (item) => (
      <div className="rounded-lg border bg-card p-2.5 shadow-none hover:shadow-sm transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium line-clamp-1">{item.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {item.platform && <Badge variant="outline" className="text-[10px] h-4">{item.platform}</Badge>}
          {item.form && <Badge variant="outline" className="text-[10px] h-4">{item.form}</Badge>}
        </div>
        {item.status === "已发布" && (item.views > 0 || item.likes > 0) && (
          <div className="mt-1 flex gap-2 text-[11px] text-muted-foreground">
            {item.views > 0 && <span>阅读 {item.views}</span>}
            {item.likes > 0 && <span>赞 {item.likes}</span>}
          </div>
        )}
      </div>
    ),
  },

  formFields: FORM_FIELDS,

  beforeCreate: (data) => normalizeContentPayload(data),
  beforeUpdate: (data) => normalizeContentPayload(data),

  detail: {
    detailMaxWidth: "max-w-2xl",
    detailTitleKey: "title",
    detailIcon: NewspaperIcon,
    detailIconBg: "bg-violet-500/15 text-violet-600",
    detailSubtitle: (item) => `${item.platform || "未指定平台"}${item.form ? ` · ${item.form}` : ""}`,
    detailBadges: (item) => {
      const badges = []
      if (item.platform) {
        badges.push({ label: item.platform, cls: PLATFORM_COLORS[item.platform] || "" })
      }
      if (item.form) {
        badges.push({ label: item.form, cls: FORM_COLORS[item.form] || "" })
      }
      if (item.status) {
        badges.push({ label: item.status, cls: STATUS_COLORS[item.status] || "" })
      }
      return badges
    },
    detailFields: [
      { key: "published_at", label: "发布日期", icon: CalendarIcon },
      { key: "topic_source", label: "选题来源", icon: TagIcon },
      { key: "doc_id", label: "知识库文档", icon: FileTextIcon },
      { key: "views", label: "阅读量", icon: EyeIcon, render: (v) => v ? v.toLocaleString() : "-" },
      { key: "likes", label: "点赞", icon: HeartIcon, render: (v) => v || "-" },
      { key: "comments", label: "评论", icon: MessageSquareIcon, render: (v) => v || "-" },
      { key: "shares", label: "转发/收藏", icon: Share2Icon, render: (v) => v || "-" },
    ],
    detailExtra: function ContentDocPanel({ item, onReload, onItemUpdate }) {
      const [activeDoc, setActiveDoc] = useState(null)
      const [docSearchQuery, setDocSearchQuery] = useState("")
      const [docResults, setDocResults] = useState([])
      const [loading, setLoading] = useState(false)
      const [metricsOpen, setMetricsOpen] = useState(false)

      const openDoc = async () => {
        if (!item.doc_id) {
          toast.error("当前内容作品还没有关联正文")
          return
        }
        setLoading(true)
        try {
          const note = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(item.doc_id)}`)
          setActiveDoc(note)
        } catch (error) {
          toast.error("正文读取失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const searchDocs = async () => {
        const query = (docSearchQuery || item.title || "").trim()
        if (!query) {
          toast.error("请输入正文关键词")
          return
        }
        setLoading(true)
        try {
          const results = await getJson(`/api/crazor/docs/knowledge/search?q=${encodeURIComponent(query)}`)
          setDocResults(results.slice(0, 6))
          if (results.length === 0) toast.info("没有找到可关联的正文")
        } catch (error) {
          toast.error("正文搜索失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const linkDoc = async (note) => {
        if (!note?.id) return
        setLoading(true)
        try {
          const updated = await patchJson(`/api/crazor/content-pieces/${item.id}`, { doc_id: note.id })
          onItemUpdate?.(updated)
          await onReload?.()
          const fullNote = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(note.id)}`)
          setActiveDoc(fullNote)
          toast.success("正文已关联")
        } catch (error) {
          toast.error("正文关联失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const openSearchResult = async (note) => {
        if (!note?.id) return
        setLoading(true)
        try {
          const fullNote = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(note.id)}`)
          setActiveDoc(fullNote)
        } catch (error) {
          toast.error("正文读取失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const createDoc = async () => {
        setLoading(true)
        try {
          const note = await postJson("/api/crazor/docs/knowledge/notes", {
            folderId: CONTENT_DOC_FOLDER_ID,
            title: item.title || "内容正文",
            content: buildDefaultContentDoc(item),
          })
          const updated = await patchJson(`/api/crazor/content-pieces/${item.id}`, { doc_id: note.id })
          onItemUpdate?.(updated)
          await onReload?.()
          const fullNote = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(note.id)}`)
          setActiveDoc(fullNote)
          toast.success("内容正文已创建")
        } catch (error) {
          toast.error("内容正文创建失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const publishContent = async () => {
        setLoading(true)
        try {
          const result = await postJson(`/api/crazor/content-pieces/${item.id}/publish`, {})
          if (result?.piece) onItemUpdate?.(result.piece)
          await onReload?.()
          toast.success("内容已标记发布")
        } catch (error) {
          toast.error("发布状态更新失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const saveMetrics = async (data) => {
        setLoading(true)
        try {
          const result = await patchJson(`/api/crazor/content-pieces/${item.id}/metrics`, normalizeMetricsPayload(data))
          if (result?.piece) onItemUpdate?.(result.piece)
          await onReload?.()
          setMetricsOpen(false)
          toast.success("内容指标已回收")
        } catch (error) {
          toast.error("内容指标保存失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const saveDoc = async (data) => {
        if (!activeDoc?.id) return
        setLoading(true)
        try {
          await patchJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(activeDoc.id)}`, {
            title: data.title,
            content: data.content || "",
          })
          const note = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(activeDoc.id)}`)
          setActiveDoc(note)
          toast.success("内容正文已保存")
        } catch (error) {
          toast.error("内容正文保存失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      const insertReviewTemplate = async () => {
        setLoading(true)
        try {
          let note = activeDoc
          if (!note?.id) {
            if (!item.doc_id) {
              toast.error("请先创建或关联正文")
              return
            }
            note = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(item.doc_id)}`)
          }
          const content = ensureReviewTemplate(note.content || "", item)
          await patchJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(note.id)}`, {
            title: note.title,
            content,
          })
          const saved = await getJson(`/api/crazor/docs/knowledge/notes-ops?id=${encodeURIComponent(note.id)}`)
          setActiveDoc(saved)
          toast.success("复盘模板已写入正文")
        } catch (error) {
          toast.error("复盘模板写入失败", { description: String(error?.message || error) })
        } finally {
          setLoading(false)
        }
      }

      return (
        <div className="flex flex-col gap-3 border-t pt-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-medium">发布与指标回收</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.status || "选题中"}{item.published_at ? ` · ${item.published_at}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={publishContent} disabled={loading || item.status === "已发布"}>
                  <CheckCircleIcon className="size-3.5" />
                  标记发布
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMetricsOpen((current) => !current)} disabled={loading}>
                  <BarChart3Icon className="size-3.5" />
                  更新指标
                </Button>
              </div>
            </div>
            {metricsOpen && (
              <div className="rounded-md border bg-muted/20 p-3">
                <DataForm
                  fields={METRICS_FIELDS}
                  initial={item}
                  onSubmit={saveMetrics}
                  onCancel={() => setMetricsOpen(false)}
                  submitLabel="保存指标"
                />
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-medium">知识库正文</div>
                <div className="mt-0.5 max-w-full truncate text-[11px] text-muted-foreground">{item.doc_id || "尚未关联正文文档"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={insertReviewTemplate} disabled={loading || !item.doc_id}>
                  <FileTextIcon className="size-3.5" />
                  复盘模板
                </Button>
                {item.doc_id ? (
                  <Button size="sm" variant="outline" onClick={openDoc} disabled={loading}>
                    <ExternalLinkIcon className="size-3.5" />
                    打开正文
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={createDoc} disabled={loading}>
                    <PlusIcon className="size-3.5" />
                    创建正文
                  </Button>
                )}
              </div>
            </div>

            <div className="mb-2 rounded-md border bg-muted/20 p-2.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={docSearchQuery}
                    onChange={(event) => setDocSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void searchDocs()
                    }}
                    placeholder="搜索已有正文..."
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={searchDocs} disabled={loading}>
                  <SearchIcon className="size-3.5" />
                  搜索
                </Button>
              </div>
              {docResults.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {docResults.map((note) => (
                    <div key={note.id} className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-[12px]">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{note.title}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{note.id}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="xs" variant="ghost" onClick={() => void linkDoc(note)} disabled={loading}>
                          <LinkIcon className="size-3" />
                          关联
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => void openSearchResult(note)} disabled={loading}>
                          <ExternalLinkIcon className="size-3" />
                          打开
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeDoc && (
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium">
                  <PencilIcon className="size-3.5 text-muted-foreground" />
                  编辑正文
                </div>
                <DataForm
                  key={activeDoc.id}
                  fields={DOC_EDIT_FIELDS}
                  initial={activeDoc}
                  onSubmit={saveDoc}
                  onCancel={() => setActiveDoc(null)}
                  submitLabel="保存正文"
                />
              </div>
            )}
          </div>
        </div>
      )
    },
  },
}

async function getJson(url) {
  const resp = await fetch(url)
  return parseJsonResponse(resp)
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

function buildDefaultContentDoc(item) {
  return [
    `# ${item.title || "内容正文"}`,
    "",
    `- 平台：${item.platform || ""}`,
    `- 形式：${item.form || ""}`,
    `- 状态：${item.status || ""}`,
    `- 选题来源：${item.topic_source || ""}`,
    "",
    "## 核心观点",
    "",
    "## 正文 / 脚本",
    "",
    "## 发布复盘",
    "",
    buildReviewTemplate(item),
    "",
  ].join("\n")
}

function ensureReviewTemplate(content, item) {
  const source = String(content || "").trimEnd()
  if (source.includes("### 指标回收")) return source
  const template = buildReviewTemplate(item)
  if (source.includes("## 发布复盘")) {
    return source.replace("## 发布复盘", `## 发布复盘\n\n${template}`)
  }
  return `${source}\n\n## 发布复盘\n\n${template}`.trim()
}

function buildReviewTemplate(item) {
  return [
    "### 指标回收",
    "",
    `- 发布日期：${item.published_at || dateToday()}`,
    `- 阅读/播放：${numberOrEmpty(item.views)}`,
    `- 点赞：${numberOrEmpty(item.likes)}`,
    `- 评论：${numberOrEmpty(item.comments)}`,
    `- 转发/收藏：${numberOrEmpty(item.shares)}`,
    "- 转化线索：",
    "",
    "### 复盘结论",
    "",
    "- 有效点：",
    "- 风险点：",
    "- 下一步动作：",
  ].join("\n")
}

function normalizeMetricsPayload(data) {
  return {
    views: data.views ? Number(data.views) : 0,
    likes: data.likes ? Number(data.likes) : 0,
    comments: data.comments ? Number(data.comments) : 0,
    shares: data.shares ? Number(data.shares) : 0,
  }
}

function normalizeContentPayload(data) {
  return {
    ...data,
    status: data.status || "选题中",
    views: data.views ? Number(data.views) : 0,
    likes: data.likes ? Number(data.likes) : 0,
    comments: data.comments ? Number(data.comments) : 0,
    shares: data.shares ? Number(data.shares) : 0,
  }
}

function numberOrEmpty(value) {
  return Number(value || 0) > 0 ? Number(value).toLocaleString() : ""
}

function dateToday() {
  return new Date().toISOString().slice(0, 10)
}
