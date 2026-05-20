// Copyright (c) 2026 MeeJoy

import { useMemo, useState } from "react"
import {
  Building2Icon,
  CalendarIcon,
  DollarSignIcon,
  PhoneIcon,
  SearchIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { ViewFrame } from "@/components/view-frame"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// ── Mock data ──────────────────────────────────────────────

const MOCK_CONTACTS = [
  { id: 1, name: "张明远", company: "深圳星河科技", role: "采购总监", status: "active", deal: 128000, phone: "138****6721", lastContact: "2026-05-18" },
  { id: 2, name: "李雪琳", company: "杭州云创网络", role: "创始人", status: "active", deal: 86000, phone: "159****3342", lastContact: "2026-05-17" },
  { id: 3, name: "王建国", company: "北京数联智造", role: "CTO", status: "potential", deal: 256000, phone: "186****9087", lastContact: "2026-05-10" },
  { id: 4, name: "陈思怡", company: "上海优选电商", role: "运营经理", status: "active", deal: 45000, phone: "177****4456", lastContact: "2026-05-16" },
  { id: 5, name: "赵德胜", company: "广州新贸通", role: "CEO", status: "silent", deal: 0, phone: "135****1128", lastContact: "2026-04-20" },
  { id: 6, name: "刘雨桐", company: "成都智汇教育", role: "产品总监", status: "potential", deal: 92000, phone: "182****7789", lastContact: "2026-05-12" },
  { id: 7, name: "黄志强", company: "东莞鑫达制造", role: "总经理", status: "silent", deal: 0, phone: "139****5543", lastContact: "2026-03-28" },
  { id: 8, name: "林小燕", company: "厦门跨境优选", role: "市场总监", status: "active", deal: 67000, phone: "158****2264", lastContact: "2026-05-15" },
]

const MOCK_FOLLOWUPS = {
  1: [
    { date: "2026-05-18", note: "电话沟通采购需求，客户对 AI 客服方案感兴趣" },
    { date: "2026-05-10", note: "发送产品方案 PDF" },
    { date: "2026-04-28", note: "首次接触，参加深圳科技展交换名片" },
  ],
  2: [
    { date: "2026-05-17", note: "线上 Demo 演示，客户反馈良好" },
    { date: "2026-05-08", note: "微信沟通，了解客户痛点" },
  ],
  3: [
    { date: "2026-05-10", note: "发送技术架构文档" },
    { date: "2026-04-22", note: "技术交流会结识" },
  ],
}

const AVATAR_COLORS = [
  "bg-blue-500/15 text-blue-600",
  "bg-violet-500/15 text-violet-600",
  "bg-emerald-500/15 text-emerald-600",
  "bg-amber-500/15 text-amber-600",
  "bg-rose-500/15 text-rose-600",
  "bg-cyan-500/15 text-cyan-600",
  "bg-indigo-500/15 text-indigo-600",
  "bg-teal-500/15 text-teal-600",
]

const STATUS_MAP = {
  active: { label: "活跃", variant: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" },
  potential: { label: "潜在", variant: "bg-blue-500/15 text-blue-700 border-blue-500/20" },
  silent: { label: "沉默", variant: "bg-zinc-500/15 text-zinc-500 border-zinc-500/20" },
}

const STATUS_TABS = [
  { id: "all", label: "全部" },
  { id: "active", label: "活跃" },
  { id: "potential", label: "潜在" },
  { id: "silent", label: "沉默" },
]

function formatCurrency(n) {
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toLocaleString()}`
}

// ── Component ──────────────────────────────────────────────

export default function ContactsView() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedId, setSelectedId] = useState(null)

  const selected = useMemo(
    () => MOCK_CONTACTS.find((c) => c.id === selectedId),
    [selectedId],
  )

  const filtered = useMemo(() => {
    return MOCK_CONTACTS.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [search, statusFilter])

  const stats = useMemo(() => ({
    total: MOCK_CONTACTS.length,
    active: MOCK_CONTACTS.filter((c) => c.status === "active").length,
    newThisMonth: 3,
    followups: MOCK_CONTACTS.filter((c) => c.status === "potential").length,
  }), [])

  return (
    <ViewFrame
      icon={UsersIcon}
      badge="CRM"
      title="客户管理"
      description="管理客户关系、商机管线与跟进记录"
      actions={
        <div className="flex w-full items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索客户..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-[12px]"
            />
          </div>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={UsersIcon} label="总客户" value={stats.total} />
          <StatCard icon={TrendingUpIcon} label="活跃客户" value={stats.active} color="text-emerald-600" />
          <StatCard icon={TrendingUpIcon} label="本月新增" value={stats.newThisMonth} color="text-blue-600" />
          <StatCard icon={CalendarIcon} label="待跟进" value={stats.followups} color="text-amber-600" />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "h-7 rounded-full px-3 text-[12px]",
                statusFilter === tab.id
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Contact cards grid */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onClick={() => setSelectedId(contact.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 py-12 text-center text-sm text-muted-foreground">
              没有匹配的客户
            </div>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      {selected && (
        <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className={cn("size-10", AVATAR_COLORS[selected.id % AVATAR_COLORS.length])}>
                  <AvatarFallback className={cn("text-sm font-medium", AVATAR_COLORS[selected.id % AVATAR_COLORS.length])}>
                    {selected.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div>{selected.name}</div>
                  <DialogDescription className="text-[12px]">
                    {selected.company} · {selected.role}
                  </DialogDescription>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Info row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <PhoneIcon className="size-3.5" />
                  {selected.phone}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <CalendarIcon className="size-3.5" />
                  最近联系：{selected.lastContact}
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <DollarSignIcon className="size-3.5" />
                  <span className="font-medium">{formatCurrency(selected.deal)}</span>
                  <span className="text-muted-foreground">商机金额</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_MAP[selected.status].variant)}>
                    {STATUS_MAP[selected.status].label}
                  </span>
                </div>
              </div>

              {/* Follow-up timeline */}
              <div className="border-t border-border pt-3">
                <h4 className="mb-2 text-[12px] font-medium text-muted-foreground">跟进记录</h4>
                <div className="flex flex-col gap-2.5">
                  {(MOCK_FOLLOWUPS[selected.id] || []).map((item, i) => (
                    <div key={i} className="flex gap-3 text-[12px]">
                      <div className="flex w-16 shrink-0 text-muted-foreground">{item.date.slice(5)}</div>
                      <div className="flex-1">{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ViewFrame>
  )
}

// ── Sub-components ─────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3 p-3">
        <div className={cn("flex size-8 items-center justify-center rounded-lg bg-muted/60", color)}>
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-[12px] text-muted-foreground">{label}</div>
          <div className={cn("text-lg font-semibold", color)}>{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function ContactCard({ contact, onClick }) {
  const colorClass = AVATAR_COLORS[contact.id % AVATAR_COLORS.length]
  const statusInfo = STATUS_MAP[contact.status]

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 p-3.5">
        <Avatar className={cn("size-10 shrink-0", colorClass)}>
          <AvatarFallback className={cn("text-sm font-medium", colorClass)}>
            {contact.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{contact.name}</span>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusInfo.variant)}>
              {statusInfo.label}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Building2Icon className="size-3" />
            {contact.company} · {contact.role}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              最近联系：{contact.lastContact.slice(5)}
            </span>
            {contact.deal > 0 && (
              <span className="text-[12px] font-medium text-primary">
                {formatCurrency(contact.deal)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
