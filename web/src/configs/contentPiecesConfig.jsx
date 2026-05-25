// Copyright (c) 2026 MeeJoy

import {
  CalendarIcon,
  EyeIcon,
  FileTextIcon,
  HeartIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  NewspaperIcon,
  Share2Icon,
  TagIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BadgeCell } from "@/components/data-view/DataGrid"

const PLATFORM_COLORS = {
  "公众号": "bg-green-100 text-green-700",
  "小红书": "bg-rose-100 text-rose-700",
  "抖音": "bg-zinc-100 text-zinc-700",
  "视频号": "bg-orange-100 text-orange-700",
  "知识星球": "bg-blue-100 text-blue-700",
  "朋友圈": "bg-violet-100 text-violet-700",
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

export default {
  apiBase: "/api/crazor/content-pieces",
  icon: MegaphoneIcon,
  badge: "内容",
  title: "平台流量",
  description: "管理各平台内容作品的状态追踪与数据回收",
  searchPlaceholder: "搜索标题...",
  filterParam: "platform",
  editable: true,
  deletable: true,

  filters: [
    { id: "all", label: "全部" },
    { id: "公众号", label: "公众号" },
    { id: "小红书", label: "小红书" },
    { id: "抖音", label: "抖音" },
    { id: "视频号", label: "视频号" },
    { id: "知识星球", label: "知识星球" },
    { id: "朋友圈", label: "朋友圈" },
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
  },
}
