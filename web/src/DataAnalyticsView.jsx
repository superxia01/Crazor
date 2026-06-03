// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3Icon, BellIcon, FilterIcon, GlobeIcon, MessageSquareIcon, SparklesIcon, TrendingUpIcon, UsersIcon,
} from "lucide-react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { Chip } from "@heroui/react"
import {
  HomeFrame,
  PanelShell,
  SoftIcon,
  TONE_STYLES,
} from "@/home/shared"
import { cn } from "@/lib/utils"

const FUNNEL_STAGES = ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交"]
const FUNNEL_COLORS = ["#3b82f6", "#06b6d4", "#14b8a6", "#10b981", "#f59e0b", "#8b5cf6"]

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

  const hermes = overview?.hermes || { todayConversations: 0, weekConversations: 0, toolCalls: 0, dailyTrend: [] }
  const contacts = overview?.contacts || { total: 0, active: 0, totalDeal: 0, followUpsDue: 0, byStage: {} }
  const finance = overview?.finance || { totalIncome: 0, totalExpense: 0, net: 0, channelRevenue: 0 }
  const projects = overview?.projects || { totalProjects: 0, todoTasks: 0, doingTasks: 0, doneTasks: 0 }
  const channels = overview?.channels || { total: 0, active: 0, totalRevenue: 0, totalCustomers: 0 }
  const followUpReminders = overview?.followUpReminders || []

  const kpis = [
    { icon: MessageSquareIcon, label: "今日对话", value: hermes.todayConversations, tone: "sky" },
    { icon: TrendingUpIcon, label: "本周对话", value: hermes.weekConversations, tone: "blue" },
    { icon: UsersIcon, label: "活跃客户", value: contacts.active, tone: "emerald" },
    { icon: SparklesIcon, label: "工具调用", value: hermes.toolCalls, tone: "amber" },
    { icon: BellIcon, label: "待跟进", value: contacts.followUpsDue, tone: "rose" },
    { icon: GlobeIcon, label: "活跃渠道", value: channels.active, tone: "blue" },
  ]

  // Task status bar
  const taskBar = [
    { name: "待办", value: projects.todoTasks },
    { name: "进行中", value: projects.doingTasks },
    { name: "已完成", value: projects.doneTasks },
  ]

  // Product type distribution
  const productEntries = finance.byProductType
    ? Object.entries(finance.byProductType).map(([name, value]) => ({ name, value }))
    : []

  // CRM Funnel data — cumulative from bottom (each stage includes itself + all later stages)
  const funnelData = useMemo(() => {
    const byStage = contacts.byStage || {}
    const raw = FUNNEL_STAGES.map((stage, i) => ({
      stage,
      count: byStage[stage] || 0,
      color: FUNNEL_COLORS[i],
    }))
    let cumSum = 0
    const cumRaw = [...raw].reverse().map((s) => {
      cumSum += s.count
      return { ...s, cumCount: cumSum }
    }).reverse()
    const topCount = cumRaw[0]?.cumCount || 1
    return cumRaw.map((s, i) => ({
      ...s,
      widthPct: Math.max(18, (s.cumCount / topCount) * 100),
      convRate: i > 0 && cumRaw[i - 1].cumCount > 0
        ? ((s.cumCount / cumRaw[i - 1].cumCount) * 100).toFixed(1)
        : null,
    }))
  }, [contacts.byStage])

  return (
    <HomeFrame>
      {/* Page header — full width */}
      <PanelShell className="border-sky-100/90 px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-violet-500 text-white shadow-[0_8px_16px_rgba(139,92,246,0.2)]">
              <BarChart3Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold leading-tight text-slate-950 dark:text-slate-50">
                数据分析
              </h1>
              <div className="mt-1 truncate text-[12px] text-slate-500 dark:text-slate-400">
                业务指标、使用趋势与客户洞察
              </div>
            </div>
          </div>
        </div>
      </PanelShell>

      {/* KPI grid — 6 metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const tone = TONE_STYLES[kpi.tone] || TONE_STYLES.slate
          return (
            <PanelShell key={kpi.label} className="px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <SoftIcon icon={kpi.icon} tone={kpi.tone} className="size-7 rounded-[7px]" />
              </div>
              <div className="mt-2 flex min-w-0 items-end gap-2">
                <span className="min-w-0 truncate tabular-nums text-[24px] font-semibold leading-none text-slate-950 dark:text-slate-50">
                  {kpi.value}
                </span>
                <span className={cn("mb-1 size-1.5 rounded-full", tone.dot)} />
              </div>
            </PanelShell>
          )
        })}
      </div>

      {/* Conversation trend + Revenue trend — two columns */}
      <div className="grid gap-3 lg:grid-cols-2">
        {hermes.dailyTrend.length > 0 && (
          <CardWithHeader
            icon={MessageSquareIcon}
            iconTone="sky"
            title="对话趋势"
            subtitle="近 7 天每日对话量"
          >
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
          </CardWithHeader>
        )}

        {revenue.length > 0 && (
          <CardWithHeader
            icon={TrendingUpIcon}
            iconTone="emerald"
            title="月度收支趋势"
            subtitle="按月统计收入与支出"
          >
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
          </CardWithHeader>
        )}
      </div>

      {/* Business overview + Task board */}
      <div className="grid gap-3 lg:grid-cols-2">
        <CardWithHeader
          icon={SparklesIcon}
          iconTone="amber"
          title="业务概览"
          subtitle="核心经营指标一览"
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="总收入" value={`¥${(finance.totalIncome / 10000).toFixed(1)}万`} tone="emerald" />
            <MiniStat label="净利润" value={`¥${(finance.net / 10000).toFixed(1)}万`} tone="sky" />
            <MiniStat label="客户总数" value={contacts.total} tone="blue" />
            <MiniStat label="项目数" value={projects.totalProjects} tone="violet" />
          </div>
        </CardWithHeader>

        {taskBar.some((t) => t.value > 0) && (
          <CardWithHeader
            icon={BarChart3Icon}
            iconTone="violet"
            title="任务看板"
            subtitle="项目任务状态分布"
          >
            <div className="h-[180px] w-full">
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
          </CardWithHeader>
        )}
      </div>

      {/* Channel stats + Follow-up reminders */}
      <div className="grid gap-3 lg:grid-cols-2">
        <CardWithHeader
          icon={GlobeIcon}
          iconTone="blue"
          title="渠道概览"
          subtitle="渠道活跃度与产出"
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="活跃渠道" value={channels.active} tone="blue" />
            <MiniStat label="渠道收入" value={`¥${(channels.totalRevenue / 10000).toFixed(1)}万`} tone="emerald" />
            <MiniStat label="引入客户" value={channels.totalCustomers} tone="amber" />
            <MiniStat label="渠道总数" value={channels.total} tone="slate" />
          </div>
          {channels.byRating && Object.keys(channels.byRating).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(channels.byRating).map(([rating, count]) => (
                <Chip key={rating} variant="tertiary" size="sm">
                  <Chip.Label className="text-[10px]">{rating}: {count}</Chip.Label>
                </Chip>
              ))}
            </div>
          )}
        </CardWithHeader>

        <CardWithHeader
          icon={BellIcon}
          iconTone="rose"
          title="待跟进提醒"
          subtitle="最近需触达的客户"
          rightSlot={followUpReminders.length > 0 && (
            <Chip variant="soft" color="danger" size="sm">
              <Chip.Label className="text-[10px]">{followUpReminders.length} 条</Chip.Label>
            </Chip>
          )}
        >
          {followUpReminders.length > 0 ? (
            <div className="flex flex-col gap-2">
              {followUpReminders.slice(0, 5).map((fu) => (
                <div key={fu.id} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-white/10 px-2.5 py-1.5 text-[12px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-950 dark:text-slate-50">{fu.contact_name}</span>
                    {fu.method && (
                      <Chip variant="tertiary" size="sm">
                        <Chip.Label className="text-[10px]">{fu.method}</Chip.Label>
                      </Chip>
                    )}
                  </div>
                  <span className="text-slate-500 dark:text-slate-400">{fu.date}</span>
                </div>
              ))}
              {followUpReminders.length > 5 && (
                <div className="text-center text-[11px] text-slate-400">
                  还有 {followUpReminders.length - 5} 条...
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-[12px] text-slate-400">暂无待跟进提醒</div>
          )}
        </CardWithHeader>
      </div>

      {/* CRM Funnel — full width */}
      {funnelData.some((d) => d.count > 0) && (
        <CardWithHeader
          icon={FilterIcon}
          iconTone="violet"
          title="客户转化漏斗"
          subtitle="各阶段累积客户数与转化率"
        >
          <div className="mx-auto" style={{ maxWidth: 520 }}>
            <div className="flex items-start gap-4">
              {/* Funnel shape: trapezoid segments stacked, top is widest */}
              <div className="flex-1 min-w-0">
                {funnelData.map((d, i) => {
                  const nextW = i < funnelData.length - 1
                    ? funnelData[i + 1].widthPct
                    : Math.max(14, d.widthPct * 0.5)
                  const tl = ((100 - d.widthPct) / 2).toFixed(2)
                  const tr = ((100 + d.widthPct) / 2).toFixed(2)
                  const bl = ((100 - nextW) / 2).toFixed(2)
                  const br = ((100 + nextW) / 2).toFixed(2)
                  return (
                    <div key={d.stage} className="relative" style={{ height: 40 }}>
                      <div
                        className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-medium"
                        style={{
                          clipPath: `polygon(${tl}% 0%, ${tr}% 0%, ${br}% 100%, ${bl}% 100%)`,
                          backgroundColor: d.color,
                        }}
                      >
                        {d.stage} {d.cumCount}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Conversion rates column */}
              <div className="w-[68px] shrink-0 flex flex-col pt-1">
                {funnelData.map((d) => (
                  <div key={d.stage} className="flex items-center justify-end" style={{ height: 40 }}>
                    {d.convRate !== null ? (
                      <span className={cn(
                        "text-[10px] font-medium tabular-nums",
                        Number(d.convRate) >= 60 ? "text-emerald-600" : "text-amber-600",
                      )}>
                        {d.convRate}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Total conversion summary */}
            {funnelData[0]?.cumCount > 0 && funnelData[5]?.cumCount > 0 && (
              <div className="mt-3 flex items-center justify-center gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400">总成交率</span>
                <span className="font-semibold text-violet-600 tabular-nums">
                  {((funnelData[5].cumCount / funnelData[0].cumCount) * 100).toFixed(1)}%
                </span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                  ({funnelData[5].cumCount}/{funnelData[0].cumCount})
                </span>
              </div>
            )}
          </div>
        </CardWithHeader>
      )}

      {/* Product type distribution */}
      {productEntries.length > 0 && (
        <CardWithHeader
          icon={BarChart3Icon}
          iconTone="amber"
          title="产品类型收入分布"
          subtitle="按产品类型聚合的收入"
        >
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
        </CardWithHeader>
      )}

      {/* Empty state */}
      {!overview && (
        <PanelShell className="py-12 text-center text-sm text-slate-400">
          加载中...
        </PanelShell>
      )}
      {overview && hermes.dailyTrend.length === 0 && revenue.length === 0 && (
        <PanelShell className="py-12 text-center text-sm text-slate-400">
          暂无数据，开始使用后将自动生成分析图表
        </PanelShell>
      )}
    </HomeFrame>
  )
}

// ── Helper components ────────────────────────────────────────────

function CardWithHeader({ icon, iconTone = "slate", title, subtitle, rightSlot, children }) {
  return (
    <PanelShell className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <SoftIcon icon={icon} tone={iconTone} className="size-8" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-slate-950 dark:text-slate-50">
              {title}
            </div>
            {subtitle && (
              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {rightSlot}
      </div>
      {children}
    </PanelShell>
  )
}

function MiniStat({ label, value, tone = "slate" }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.slate
  return (
    <div className={cn("rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]")}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
        <span className={cn("size-1.5 rounded-full", styles.dot)} />
      </div>
      <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-950 dark:text-slate-50">
        {value}
      </div>
    </div>
  )
}
