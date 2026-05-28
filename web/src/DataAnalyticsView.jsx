// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3Icon, BellIcon, CalendarIcon, CheckSquareIcon, FilterIcon, GlobeIcon, MessageSquareIcon, SparklesIcon, TrendingUpIcon, UsersIcon,
} from "lucide-react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { ViewFrame } from "@/components/view-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function DataAnalyticsView() {
  const [overview, setOverview] = useState(null)
  const [revenue, setRevenue] = useState([])

  const loadData = useCallback(async () => {
    const [oResp, rResp] = await Promise.all([
      fetch("/api/crazor/analytics/overview"),
      fetch("/api/crazor/analytics/revenue"),
    ])
    if (oResp.ok) setOverview(await oResp.json())
    if (rResp.ok) setRevenue(await rResp.json())
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const handleCompleteReminder = useCallback(async (reminder) => {
    try {
      await patchJson(`/api/crazor/follow-ups/${reminder.id}`, { status: "已完成" })
      toast.success("跟进提醒已完成")
      await loadData()
    } catch (error) {
      toast.error("提醒处理失败", { description: String(error?.message || error) })
    }
  }, [loadData])

  const handleSnoozeReminder = useCallback(async (reminder, days) => {
    try {
      await patchJson(`/api/crazor/follow-ups/${reminder.id}`, { date: dateDaysFromNow(days), status: "待跟进" })
      toast.success(days >= 7 ? "已顺延到下周" : "已顺延到明天")
      await loadData()
    } catch (error) {
      toast.error("提醒顺延失败", { description: String(error?.message || error) })
    }
  }, [loadData])

  const hermes = overview?.hermes || { todayConversations: 0, weekConversations: 0, toolCalls: 0, dailyTrend: [] }
  const contacts = overview?.contacts || { total: 0, active: 0, totalDeal: 0, followUpsDue: 0, byStage: {} }
  const finance = overview?.finance || { totalIncome: 0, totalExpense: 0, net: 0, channelRevenue: 0 }
  const projects = overview?.projects || { totalProjects: 0, todoTasks: 0, doingTasks: 0, doneTasks: 0 }
  const channels = overview?.channels || { total: 0, active: 0, totalRevenue: 0, totalCustomers: 0 }
  const followUpReminders = overview?.followUpReminders || []

  const kpis = [
    { icon: MessageSquareIcon, label: "今日对话", value: hermes.todayConversations, color: "text-blue-600" },
    { icon: TrendingUpIcon, label: "本周对话", value: hermes.weekConversations, color: "text-violet-600" },
    { icon: UsersIcon, label: "活跃客户", value: contacts.active, color: "text-emerald-600" },
    { icon: SparklesIcon, label: "工具调用", value: hermes.toolCalls, color: "text-amber-600" },
    { icon: BellIcon, label: "待跟进", value: contacts.followUpsDue, color: "text-rose-600" },
    { icon: GlobeIcon, label: "活跃渠道", value: channels.active, color: "text-violet-600" },
  ]

  // Task status bar
  const taskBar = [
    { name: "待办", value: projects.todoTasks },
    { name: "进行中", value: projects.doingTasks },
    { name: "已完成", value: projects.doneTasks },
  ]

  // Product type distribution
  const productEntries = finance.byProductType ? Object.entries(finance.byProductType).map(([name, value]) => ({ name, value })) : []

  // Funnel stages (CRM pipeline)
  const FUNNEL_STAGES = ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交"]
  const FUNNEL_COLORS = [
    "#3b82f6", "#06b6d4", "#14b8a6", "#10b981", "#f59e0b", "#8b5cf6",
  ]
  const funnelData = useMemo(() => {
    const byStage = contacts.byStage || {}
    const raw = FUNNEL_STAGES.map((stage, i) => ({
      stage, count: byStage[stage] || 0, color: FUNNEL_COLORS[i],
    }))
    // Cumulative from bottom: each stage includes itself + all later stages
    let cumSum = 0
    const cumRaw = [...raw].reverse().map((s) => {
      cumSum += s.count
      return { ...s, cumCount: cumSum }
    }).reverse()
    const topCount = cumRaw[0]?.cumCount || 1
    return cumRaw.map((s, i) => ({
      ...s,
      cumCount: s.cumCount,
      widthPct: Math.max(18, (s.cumCount / topCount) * 100),
      // Stage-to-stage conversion rate
      convRate: i > 0 && cumRaw[i - 1].cumCount > 0
        ? ((s.cumCount / cumRaw[i - 1].cumCount) * 100).toFixed(1)
        : null,
    }))
  }, [contacts.byStage])

  return (
    <ViewFrame icon={BarChart3Icon} badge="Analytics" title="数据分析" description="业务指标、使用趋势与客户洞察">
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="shadow-none">
              <CardContent className="flex items-center gap-3 p-3">
                <div className={cn("flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary")}>
                  <kpi.icon className="size-4" />
                </div>
                <div>
                  <div className="text-[12px] text-muted-foreground">{kpi.label}</div>
                  <div className={cn("text-lg font-semibold", kpi.color)}>{kpi.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Hermes conversation trend */}
        {hermes.dailyTrend.length > 0 && (
          <Card className="shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium">对话趋势（近7天）</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hermes.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="conversations" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue + Business overview */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {revenue.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium">月度收支趋势</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="income" name="收入" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="expense" name="支出" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium">业务概览</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="总收入" value={`¥${(finance.totalIncome / 10000).toFixed(1)}万`} />
                  <MiniStat label="净利润" value={`¥${(finance.net / 10000).toFixed(1)}万`} />
                  <MiniStat label="客户总数" value={contacts.total} />
                  <MiniStat label="项目数" value={projects.totalProjects} />
                </div>
                {taskBar.some((t) => t.value > 0) && (
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskBar} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channel stats + Follow-up reminders */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Channel stats */}
          <Card className="shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium">渠道概览</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="活跃渠道" value={channels.active} />
                <MiniStat label="渠道收入" value={`¥${(channels.totalRevenue / 10000).toFixed(1)}万`} />
                <MiniStat label="引入客户" value={channels.totalCustomers} />
                <MiniStat label="渠道总数" value={channels.total} />
              </div>
              {channels.byRating && Object.keys(channels.byRating).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(channels.byRating).map(([rating, count]) => (
                    <Badge key={rating} variant="outline" className="text-[10px]">{rating}: {count}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Follow-up reminders */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-medium">待跟进提醒</CardTitle>
                {followUpReminders.length > 0 && (
                  <Badge variant="outline" className="text-[10px] border-rose-200 text-rose-600">{followUpReminders.length} 条</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {followUpReminders.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {followUpReminders.slice(0, 5).map((fu) => (
                    <div key={fu.id} className="rounded-lg border p-2 text-[12px]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">
                            <span>{fu.contact_name}</span>
                            {fu.method && <Badge variant="outline" className="ml-1.5 text-[10px] h-4">{fu.method}</Badge>}
                          </div>
                          {fu.content && <div className="mt-1 line-clamp-2 text-muted-foreground">{fu.content}</div>}
                        </div>
                        <span className="shrink-0 text-muted-foreground">{fu.date}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-end gap-1">
                        <Button size="xs" variant="outline" onClick={() => void handleSnoozeReminder(fu, 1)}>
                          <CalendarIcon className="size-3" />
                          明天
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => void handleSnoozeReminder(fu, 7)}>
                          <CalendarIcon className="size-3" />
                          下周
                        </Button>
                        <Button size="xs" onClick={() => void handleCompleteReminder(fu)}>
                          <CheckSquareIcon className="size-3" />
                          完成
                        </Button>
                      </div>
                    </div>
                  ))}
                  {followUpReminders.length > 5 && (
                    <div className="text-center text-[11px] text-muted-foreground">
                      还有 {followUpReminders.length - 5} 条...
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-[12px] text-muted-foreground">暂无待跟进提醒</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CRM Funnel Analysis */}
        {funnelData.some((d) => d.count > 0) && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FilterIcon className="size-4 text-violet-600" />
                <CardTitle className="text-[13px] font-medium">客户转化漏斗</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mx-auto" style={{ maxWidth: 480 }}>
                <div className="flex items-start gap-4">
                  {/* Funnel shape */}
                  <div className="flex-1 min-w-0">
                    {funnelData.map((d, i) => {
                      const nextW = i < funnelData.length - 1
                        ? funnelData[i + 1].widthPct
                        : Math.max(12, d.widthPct * 0.45)
                      const tl = ((100 - d.widthPct) / 2).toFixed(1)
                      const tr = ((100 + d.widthPct) / 2).toFixed(1)
                      const bl = ((100 - nextW) / 2).toFixed(1)
                      const br = ((100 + nextW) / 2).toFixed(1)
                      return (
                        <div key={d.stage} className="relative" style={{ height: 40 }}>
                          <div
                            className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-medium"
                            style={{
                              clipPath: `polygon(${tl}% 0%, ${tr}% 0%, ${br}% 100%, ${bl}% 100%)`,
                              backgroundColor: FUNNEL_COLORS[i],
                            }}
                          >
                            {d.stage} {d.cumCount}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Conversion rates */}
                  <div className="w-[72px] shrink-0 flex flex-col pt-1">
                    {funnelData.map((d, i) => (
                      <div key={d.stage} className="flex items-center justify-end" style={{ height: 40 }}>
                        {d.convRate !== null ? (
                          <span className={cn(
                            "text-[10px] font-medium",
                            Number(d.convRate) >= 60 ? "text-emerald-600" : "text-amber-600",
                          )}>
                            {d.convRate}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Total conversion */}
                {funnelData[0]?.cumCount > 0 && funnelData[5]?.cumCount > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-2 border-t pt-3 text-[11px]">
                    <span className="text-muted-foreground">总成交率</span>
                    <span className="font-semibold text-violet-600">
                      {((funnelData[5].cumCount / funnelData[0].cumCount) * 100).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">
                      ({funnelData[5].cumCount}/{funnelData[0].cumCount})
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product type distribution */}
        {productEntries.length > 0 && (
          <Card className="shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium">产品类型收入分布</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productEntries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="收入" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!overview && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            加载中...
          </div>
        )}
        {overview && hermes.dailyTrend.length === 0 && revenue.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            暂无数据，开始使用后将自动生成分析图表
          </div>
        )}
      </div>
    </ViewFrame>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  )
}

function dateDaysFromNow(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function patchJson(url, payload) {
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new Error(body?.error || body?.message || `请求失败：${resp.status}`)
  }
  return body
}
