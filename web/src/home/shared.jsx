// Copyright (c) 2026 MeeJoy
//
// Shared primitives for homepage cards and layout.

import { motion as Motion } from "framer-motion"
import { ArrowRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Motion ─────────────────────────────────────────────────────

export const PANEL_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
}

// ── Tone styles ─────────────────────────────────────────────────

export const TONE_STYLES = {
  sky: {
    icon: "border-sky-100 bg-sky-50 text-sky-600 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
    soft: "border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  blue: {
    icon: "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300",
    soft: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  emerald: {
    icon: "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
    soft: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  amber: {
    icon: "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
    soft: "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  rose: {
    icon: "border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
    soft: "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  slate: {
    icon: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300",
    soft: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300",
    dot: "bg-slate-400",
  },
}

// ── Helpers ─────────────────────────────────────────────────────

export function getLocaleTag(language) {
  if (language === "zh-TW") return "zh-TW"
  if (language === "en") return "en-US"
  return "zh-CN"
}

export function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value, language) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString(getLocaleTag(language), {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatCompactTime(value, language) {
  const date = toDate(value)
  if (!date) return "—"

  return date.toLocaleString(getLocaleTag(language), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatWorkspacePath(path) {
  return String(path || "").replace(/^\/Users\/[^/]+/, "~") || "—"
}

export function getToneForStatus(tone) {
  if (tone === "good") return "emerald"
  if (tone === "bad") return "rose"
  if (tone === "warning") return "amber"
  if (tone === "info") return "blue"
  return "slate"
}

// ── Primitives ──────────────────────────────────────────────────

export function SoftIcon({ icon: Icon, tone = "slate", className }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.slate
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[8px] border", styles.icon, className)}>
      <Icon className="size-4" />
    </span>
  )
}

export function StatusPill({ tone = "neutral", icon: Icon, children }) {
  const styles = TONE_STYLES[getToneForStatus(tone)]
  return (
    <Badge
      variant="outline"
      className={cn("min-h-7 rounded-full px-2.5 py-1 text-[12px] font-medium", styles.soft)}>
      {Icon ? <Icon className="size-3.5" /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </Badge>
  )
}

export function HomeFrame({ children }) {
  return (
    <div className="h-full w-full overflow-y-auto bg-white text-slate-950 dark:bg-[#151821] dark:text-slate-50">
      <div className="grid min-h-full w-full content-start gap-4 px-4 py-4 md:px-5 lg:px-6 2xl:px-8">
        {children}
      </div>
    </div>
  )
}

export function PanelShell({ children, className }) {
  return (
    <Motion.section
      {...PANEL_MOTION}
      className={cn(
        "w-full overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]",
        "dark:border-white/10 dark:bg-[#20232c] dark:shadow-[0_14px_34px_rgba(0,0,0,0.22)]",
        className
      )}>
      {children}
    </Motion.section>
  )
}

export function MiniAreaChart({ data, tone = "sky" }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 160 : 12 + (index / (data.length - 1)) * 296
    const y = 78 - (Math.max(item.value, 0) / maxValue) * 58
    return { x, y, ...item }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const area = points.length > 0
    ? `M ${points[0].x} 86 L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} 86 Z`
    : ""
  const stroke = tone === "emerald" ? "#10b981" : tone === "blue" ? "#3b82f6" : "#0ea5e9"
  const fill = tone === "emerald" ? "rgba(16,185,129,0.14)" : tone === "blue" ? "rgba(59,130,246,0.14)" : "rgba(14,165,233,0.14)"

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <svg role="img" aria-label="activity trend" viewBox="0 0 320 96" className="min-h-24 flex-1 w-full overflow-visible">
        <path d={area} fill={fill} />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke={stroke} strokeWidth="2" />
        ))}
      </svg>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
        {data.map((item) => (
          <span key={item.label} className="truncate">{item.label}</span>
        ))}
      </div>
    </div>
  )
}

export function MetricStrip({ metrics }) {
  return (
    <div className="grid overflow-hidden rounded-[8px] border border-slate-200 bg-slate-200/80 sm:grid-cols-2 xl:grid-cols-4 dark:border-white/10 dark:bg-white/10">
      {metrics.map((metric) => {
        const Icon = metric.icon
        const tone = metric.tone || "slate"
        return (
          <div key={metric.label} className="min-w-0 bg-white px-3.5 py-3 dark:bg-white/[0.035]">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {metric.label}
              </span>
              <SoftIcon icon={Icon} tone={tone} className="size-7 rounded-[7px]" />
            </div>
            <div className="mt-2 flex min-w-0 items-end gap-2">
              <span className="min-w-0 truncate tabular-nums text-[24px] font-semibold leading-none text-slate-950 dark:text-slate-50">
                {metric.value}
              </span>
              <span className={cn("mb-1 size-1.5 rounded-full", TONE_STYLES[tone]?.dot || TONE_STYLES.slate.dot)} />
            </div>
            <div className="mt-1.5 truncate text-[10px] leading-4 text-slate-500 dark:text-slate-400">
              {metric.helper}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Recent work helpers ─────────────────────────────────────────

export function WorkRow({ icon: Icon, title, meta, onClick }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="group flex min-h-12 w-full cursor-pointer items-center gap-2.5 border-t border-slate-100 px-3 py-2.5 text-left transition-colors first:border-t-0 hover:bg-sky-50/70 dark:border-white/10 dark:hover:bg-white/[0.04]">
      <SoftIcon icon={Icon} tone="slate" className="size-8 group-hover:border-sky-100 group-hover:bg-sky-50 group-hover:text-sky-600 dark:group-hover:border-sky-400/20 dark:group-hover:bg-sky-400/10 dark:group-hover:text-sky-300" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-950 dark:text-slate-50">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{meta}</span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
    </button>
  )
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-[8px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button size="sm" className="mt-4 rounded-[8px]" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
