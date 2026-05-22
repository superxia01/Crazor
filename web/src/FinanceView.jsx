// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import { TrendingUpIcon, TrendingDownIcon, DollarSignIcon, FileTextIcon, LandmarkIcon, PlusIcon } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { ViewFrame } from "@/components/view-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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

export default function FinanceView() {
  const [transactions, setTransactions] = useState([])
  const [monthly, setMonthly] = useState([])
  const [stats, setStats] = useState({ totalIncome: 0, totalExpense: 0, net: 0, pendingInvoice: 0 })
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ type: "income", amount: "", description: "", date: new Date().toISOString().slice(0, 10) })

  const loadData = useCallback(async () => {
    const [txResp, revResp, statsResp] = await Promise.all([
      fetch("/api/crazor/transactions"),
      fetch("/api/crazor/analytics/revenue"),
      fetch("/api/crazor/analytics/overview"),
    ])
    if (txResp.ok) setTransactions(await txResp.json())
    if (revResp.ok) setMonthly(await revResp.json())
    if (statsResp.ok) {
      const d = await statsResp.json()
      setStats(d.finance)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const handleCreate = useCallback(async () => {
    if (!createForm.amount) return
    await fetch("/api/crazor/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createForm, amount: Number(createForm.amount) }),
    })
    setShowCreate(false)
    setCreateForm({ type: "income", amount: "", description: "", date: new Date().toISOString().slice(0, 10) })
    await loadData()
  }, [createForm, loadData])

  const invoiceStats = useMemo(() => {
    const paid = transactions.filter((t) => t.invoice_status === "paid").reduce((s, t) => s + t.amount, 0)
    const pending = stats.pendingInvoice
    const overdue = transactions.filter((t) => t.invoice_status === "overdue").reduce((s, t) => s + t.amount, 0)
    return { paid, pending, overdue }
  }, [transactions, stats])

  return (
    <ViewFrame icon={LandmarkIcon} badge="Finance" title="财务中心" description="收支流水、发票管理与财务趋势"
      actions={
        <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 px-2.5 text-[12px]">
          <PlusIcon className="size-3.5" />新增交易
        </Button>
      }
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={TrendingUpIcon} label="总收入" value={fmt(stats.totalIncome)} color="text-emerald-600" />
          <KpiCard icon={TrendingDownIcon} label="总支出" value={fmt(stats.totalExpense)} color="text-rose-600" />
          <KpiCard icon={DollarSignIcon} label="净利润" value={fmt(stats.net)} color="text-blue-600" />
          <KpiCard icon={FileTextIcon} label="待收发票" value={fmt(stats.pendingInvoice)} color="text-amber-600" />
        </div>

        {monthly.length > 0 && (
          <Card className="shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium">收支趋势（近6月）</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} barGap={4}>
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
        )}

        <div className="grid grid-cols-3 gap-3">
          <InvoiceCard label="已收" value={invoiceStats.paid} variant="bg-emerald-500/10 text-emerald-700 border-emerald-500/20" />
          <InvoiceCard label="待收" value={invoiceStats.pending} variant="bg-amber-500/10 text-amber-700 border-amber-500/20" />
          <InvoiceCard label="逾期" value={invoiceStats.overdue} variant="bg-rose-500/10 text-rose-700 border-rose-500/20" />
        </div>

        <Card className="shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium">最近交易</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium">{tx.description || (tx.type === "income" ? "收入" : "支出")}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{tx.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[13px] font-semibold", tx.type === "income" ? "text-emerald-600" : "text-rose-600")}>
                      {tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}
                    </span>
                    {tx.invoice_status === "pending" && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">待收</Badge>}
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="py-8 text-center text-[12px] text-muted-foreground">暂无交易记录</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>新增交易</DialogTitle><DialogDescription>录入收入或支出</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button size="sm" variant={createForm.type === "income" ? "default" : "outline"} onClick={() => setCreateForm((f) => ({ ...f, type: "income" }))}>收入</Button>
              <Button size="sm" variant={createForm.type === "expense" ? "default" : "outline"} onClick={() => setCreateForm((f) => ({ ...f, type: "expense" }))}>支出</Button>
            </div>
            <Input type="number" placeholder="金额" value={createForm.amount} onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))} />
            <Input placeholder="描述" value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
            <Input type="date" value={createForm.date} onChange={(e) => setCreateForm((f) => ({ ...f, date: e.target.value }))} />
            <Button onClick={handleCreate} disabled={!createForm.amount}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ViewFrame>
  )
}

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3 p-3">
        <div className={cn("flex size-8 items-center justify-center rounded-lg bg-muted/60", color)}><Icon className="size-4" /></div>
        <div><div className="text-[12px] text-muted-foreground">{label}</div><div className={cn("text-lg font-semibold", color)}>{value}</div></div>
      </CardContent>
    </Card>
  )
}

function InvoiceCard({ label, value, variant }) {
  return <div className={cn("rounded-lg border p-3", variant)}><div className="text-[12px] opacity-80">{label}</div><div className="mt-1 text-lg font-semibold">{fmt(value)}</div></div>
}
