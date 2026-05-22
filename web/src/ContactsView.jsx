// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2Icon,
  CalendarIcon,
  DollarSignIcon,
  PlusIcon,
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

export default function ContactsView() {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", company: "", role: "", phone: "", status: "potential" })

  const loadContacts = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (search) params.set("q", search)
    const resp = await fetch(`/api/crazor/contacts?${params}`)
    if (resp.ok) setContacts(await resp.json())
  }, [statusFilter, search])

  useEffect(() => { void loadContacts() }, [loadContacts])

  const selected = useMemo(() => contacts.find((c) => c.id === selectedId), [contacts, selectedId])

  const stats = useMemo(() => ({
    total: contacts.length,
    active: contacts.filter((c) => c.status === "active").length,
    potential: contacts.filter((c) => c.status === "potential").length,
  }), [contacts])

  const handleCreate = useCallback(async () => {
    if (!createForm.name.trim()) return
    await fetch("/api/crazor/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    })
    setShowCreate(false)
    setCreateForm({ name: "", company: "", role: "", phone: "", status: "potential" })
    await loadContacts()
  }, [createForm, loadContacts])

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
            <Input placeholder="搜索客户..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-[12px]" />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 px-2.5 text-[12px]">
            <PlusIcon className="size-3.5" />
            新增
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard icon={UsersIcon} label="总客户" value={stats.total} />
          <StatCard icon={TrendingUpIcon} label="活跃客户" value={stats.active} color="text-emerald-600" />
          <StatCard icon={CalendarIcon} label="潜在客户" value={stats.potential} color="text-blue-600" />
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5">
          {STATUS_TABS.map((tab) => (
            <Button key={tab.id} variant="ghost" size="sm" onClick={() => setStatusFilter(tab.id)}
              className={cn("h-7 rounded-full px-3 text-[12px]", statusFilter === tab.id ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} onClick={() => setSelectedId(contact.id)} />
          ))}
          {contacts.length === 0 && (
            <div className="col-span-2 py-12 text-center text-sm text-muted-foreground">暂无客户，点击"新增"添加</div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增客户</DialogTitle>
            <DialogDescription>填写客户基本信息</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="姓名 *" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            <Input placeholder="公司" value={createForm.company} onChange={(e) => setCreateForm((f) => ({ ...f, company: e.target.value }))} />
            <Input placeholder="职位" value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))} />
            <Input placeholder="电话" value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} />
            <Button onClick={handleCreate} disabled={!createForm.name.trim()}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {selected && (
        <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className={cn("size-10", AVATAR_COLORS[selected.id.charCodeAt(0) % AVATAR_COLORS.length])}>
                  <AvatarFallback className={cn("text-sm font-medium", AVATAR_COLORS[selected.id.charCodeAt(0) % AVATAR_COLORS.length])}>
                    {selected.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div>{selected.name}</div>
                  <DialogDescription className="text-[12px]">{selected.company} · {selected.role}</DialogDescription>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span>电话：{selected.phone || "-"}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <DollarSignIcon className="size-3.5" />
                  <span className="font-medium">{formatCurrency(selected.deal)}</span>
                  <span className="text-muted-foreground">商机</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_MAP[selected.status]?.variant)}>
                  {STATUS_MAP[selected.status]?.label}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ViewFrame>
  )
}

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
  const colorClass = AVATAR_COLORS[contact.name.charCodeAt(0) % AVATAR_COLORS.length]
  const statusInfo = STATUS_MAP[contact.status] || STATUS_MAP.potential

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onClick}>
      <CardContent className="flex items-start gap-3 p-3.5">
        <Avatar className={cn("size-10 shrink-0", colorClass)}>
          <AvatarFallback className={cn("text-sm font-medium", colorClass)}>{contact.name.slice(0, 1)}</AvatarFallback>
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
            {contact.company || "未填写公司"}{contact.role ? ` · ${contact.role}` : ""}
          </div>
          {contact.deal > 0 && (
            <div className="mt-1.5 text-[12px] font-medium text-primary">{formatCurrency(contact.deal)}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
