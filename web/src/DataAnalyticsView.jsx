// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useState } from "react"
import {
  BarChart3Icon, MessageSquareIcon, SparklesIcon, TrendingUpIcon, UsersIcon,
} from "lucide-react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { ViewFrame } from "@/components/view-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e"]

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
  const contacts = overview?.contacts || { total: 0, active: 0, totalDeal: 0 }
  const finance = overview?.finance || { totalIncome: 0, totalExpense: 0, net: 0 }
  const projects = overview?.projects || { totalProjects: 0, todoTasks: 0, doingTasks: 0, doneTasks: 0 }

  const kpis = [
    { icon: MessageSquareIcon, label: "今日对话", value: hermes.todayConversations, color: "text-blue-600" },
    { icon: TrendingUpIcon, label: "本周对话", value: hermes.weekConversations, color: "text-violet-600" },
    { icon: UsersIcon, label: "活跃客户", value: contacts.active, color: "text-emerald-600" },
    { icon: SparklesIcon, label: "工具调用", value: hermes.toolCalls, color: "text-amber-600" },
  ]

  // Build contact status distribution
  const contactPie = [
    { name: "活跃", value: contacts.active, color: "#10b981" },
    { name: "潜在", value: contacts.total - contacts.active, color: "#3b82f6" },
  ].filter((d) => d.value > 0)

  // Task status bar
  const taskBar = [
    { name: "待办", value: projects.todoTasks },
    { name: "进行中", value: projects.doingTasks },
    { name: "已完成", value: projects.doneTasks },
  ]

  return (
    <ViewFrame icon={BarChart3Icon} badge="Analytics" title="数据分析" description="业务指标、使用趋势与客户洞察">
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

        {/* Revenue + Task status */}
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
                {/* Mini stats */}
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="总收入" value={`¥${(finance.totalIncome / 10000).toFixed(1)}万`} />
                  <MiniStat label="净利润" value={`¥${(finance.net / 10000).toFixed(1)}万`} />
                  <MiniStat label="客户总数" value={contacts.total} />
                  <MiniStat label="项目数" value={projects.totalProjects} />
                </div>
                {/* Task status */}
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
