// Copyright (c) 2026 MeeJoy

import {
  BarChart3Icon,
  MessageSquareIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ViewFrame } from "@/components/view-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// ── Mock data ──────────────────────────────────────────────

const DAILY_TREND = [
  { date: "05-13", conversations: 142 },
  { date: "05-14", conversations: 168 },
  { date: "05-15", conversations: 195 },
  { date: "05-16", conversations: 176 },
  { date: "05-17", conversations: 210 },
  { date: "05-18", conversations: 238 },
  { date: "05-19", conversations: 187 },
]

const CUSTOMER_SOURCE = [
  { name: "自然搜索", value: 35, color: "#3b82f6" },
  { name: "社交媒体", value: 28, color: "#8b5cf6" },
  { name: "口碑推荐", value: 22, color: "#10b981" },
  { name: "广告投放", value: 15, color: "#f59e0b" },
]

const TOP_SKILLS = [
  { name: "智能助理", usage: 342 },
  { name: "文案策划", usage: 256 },
  { name: "翻译专员", usage: 198 },
  { name: "数据分析师", usage: 167 },
  { name: "客服专员", usage: 134 },
]

const KPI_DATA = [
  { icon: MessageSquareIcon, label: "今日对话", value: "187", change: "+12%", up: true },
  { icon: TrendingUpIcon, label: "本周对话", value: "1,316", change: "+8.3%", up: true },
  { icon: UsersIcon, label: "活跃用户", value: "46", change: "+5", up: true },
  { icon: SparklesIcon, label: "技能调用", value: "892", change: "+15%", up: true },
]

// ── Custom tooltips ────────────────────────────────────────

const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-[12px] shadow-md">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-muted-foreground">
        对话量：<span className="font-medium text-foreground">{payload[0].value}</span>
      </div>
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-[12px] shadow-md">
      <div className="font-medium">{payload[0].name}</div>
      <div className="mt-1 text-muted-foreground">
        占比：<span className="font-medium text-foreground">{payload[0].value}%</span>
      </div>
    </div>
  )
}

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-[12px] shadow-md">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-muted-foreground">
        调用次数：<span className="font-medium text-foreground">{payload[0].value}</span>
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────

export default function DataAnalyticsView() {
  return (
    <ViewFrame
      icon={BarChart3Icon}
      badge="Analytics"
      title="数据分析"
      description="业务指标、使用趋势与客户洞察"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPI_DATA.map((kpi) => (
            <Card key={kpi.label} className="shadow-none">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <kpi.icon className="size-4" />
                </div>
                <div>
                  <div className="text-[12px] text-muted-foreground">{kpi.label}</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold">{kpi.value}</span>
                    <span className={cn("text-[11px] font-medium", kpi.up ? "text-emerald-600" : "text-rose-600")}>
                      {kpi.change}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Line chart — conversation trend */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium">对话趋势（近7天）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DAILY_TREND}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<LineTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="conversations"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#3b82f6" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Two-column charts */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Pie chart — customer source */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium">客户来源分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CUSTOMER_SOURCE}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {CUSTOMER_SOURCE.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Horizontal bar — top skills */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium">热门技能 Top 5</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TOP_SKILLS} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={72} />
                    <Tooltip content={<BarTooltip />} />
                    <Bar dataKey="usage" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ViewFrame>
  )
}
