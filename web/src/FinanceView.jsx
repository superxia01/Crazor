// Copyright (c) 2026 MeeJoy

import { TrendingUpIcon, TrendingDownIcon, DollarSignIcon, FileTextIcon, LandmarkIcon } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ViewFrame } from "@/components/view-frame"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// ── Mock data ──────────────────────────────────────────────

const MONTHLY_DATA = [
  { month: "12月", income: 186000, expense: 92000 },
  { month: "1月", income: 215000, expense: 108000 },
  { month: "2月", income: 178000, expense: 85000 },
  { month: "3月", income: 243000, expense: 126000 },
  { month: "4月", income: 267000, expense: 118000 },
  { month: "5月", income: 298000, expense: 135000 },
]

const RECENT_TRANSACTIONS = [
  { id: 1, date: "2026-05-18", desc: "客户 A — 跨境电商代运营", amount: 45000, type: "income", status: "done" },
  { id: 2, date: "2026-05-17", desc: "阿里云服务器续费", amount: -8600, type: "expense", status: "done" },
  { id: 3, date: "2026-05-15", desc: "客户 B — 小程序开发尾款", amount: 32000, type: "income", status: "pending" },
  { id: 4, date: "2026-05-14", desc: "团队建设活动费", amount: -4500, type: "expense", status: "done" },
  { id: 5, date: "2026-05-12", desc: "客户 C — 品牌咨询项目", amount: 68000, type: "income", status: "done" },
  { id: 6, date: "2026-05-10", desc: "SaaS 工具订阅（月度）", amount: -2980, type: "expense", status: "done" },
]

const INVOICE_STATS = { paid: 326000, pending: 78000, overdue: 12000 }

const THIS_MONTH = { income: 298000, expense: 135000, net: 163000 }

// ── Helpers ────────────────────────────────────────────────

function fmt(n) {
  if (Math.abs(n) >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toLocaleString()}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-[12px] shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────

export default function FinanceView() {
  return (
    <ViewFrame
      icon={LandmarkIcon}
      badge="Finance"
      title="财务中心"
      description="收支流水、发票管理与财务趋势"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={TrendingUpIcon} label="本月收入" value={fmt(THIS_MONTH.income)} color="text-emerald-600" />
          <KpiCard icon={TrendingDownIcon} label="本月支出" value={fmt(THIS_MONTH.expense)} color="text-rose-600" />
          <KpiCard icon={DollarSignIcon} label="净利润" value={fmt(THIS_MONTH.net)} color="text-blue-600" />
          <KpiCard icon={FileTextIcon} label="待收发票" value={fmt(INVOICE_STATS.pending)} color="text-amber-600" />
        </div>

        {/* Chart */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium">收支趋势（近6月）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MONTHLY_DATA} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 10000}万`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="收入" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expense" name="支出" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Invoice status */}
        <div className="grid grid-cols-3 gap-3">
          <InvoiceCard label="已收" value={INVOICE_STATS.paid} variant="bg-emerald-500/10 text-emerald-700 border-emerald-500/20" />
          <InvoiceCard label="待收" value={INVOICE_STATS.pending} variant="bg-amber-500/10 text-amber-700 border-amber-500/20" />
          <InvoiceCard label="逾期" value={INVOICE_STATS.overdue} variant="bg-rose-500/10 text-rose-700 border-rose-500/20" />
        </div>

        {/* Recent transactions */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium">最近交易</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {RECENT_TRANSACTIONS.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium">{tx.desc}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{tx.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[13px] font-semibold", tx.amount > 0 ? "text-emerald-600" : "text-rose-600")}>
                      {tx.amount > 0 ? "+" : ""}{fmt(Math.abs(tx.amount))}
                    </span>
                    {tx.status === "pending" && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                        待收
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ViewFrame>
  )
}

// ── Sub-components ─────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color }) {
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

function InvoiceCard({ label, value, variant }) {
  return (
    <div className={cn("rounded-lg border p-3", variant)}>
      <div className="text-[12px] opacity-80">{label}</div>
      <div className="mt-1 text-lg font-semibold">{fmt(value)}</div>
    </div>
  )
}
